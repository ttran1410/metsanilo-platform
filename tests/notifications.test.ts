import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { auditEntries, notifications, shops } from "@/db/schema";
import { listNotifications, markFilteredNotificationsRead, markNotificationReadState } from "@/domain/notifications";
import { resetEnvForTests } from "@/lib/env";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-notifications-test-"));
let database: Database;
let closeDatabase: () => void = () => {};
let testNumber = 0;

beforeEach(async () => {
  testNumber += 1;
  const databaseUrl = `file:${join(directory, `test-${testNumber}.db`)}`;
  process.env.TURSO_DATABASE_URL = databaseUrl;
  process.env.SHOP_ID = "shop-main";
  resetEnvForTests();
  const connection = createDatabaseConnection(databaseUrl);
  database = connection.database;
  closeDatabase = connection.close;
  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });
  await database.insert(shops).values([
    {
      id: "shop-main", slug: "main", nameFi: "Pääkauppa", nameEn: "Main shop", timezone: "Europe/Helsinki",
      pickupNameFi: "Nouto", pickupNameEn: "Pickup", pickupAddress: "Torikatu 1",
      pickupInstructionsFi: "Ohje", pickupInstructionsEn: "Instructions", pickupTime: "20:00",
    },
    {
      id: "shop-other", slug: "other", nameFi: "Muu", nameEn: "Other", timezone: "Europe/Helsinki",
      pickupNameFi: "Nouto", pickupNameEn: "Pickup", pickupAddress: "Torikatu 2",
      pickupInstructionsFi: "Ohje", pickupInstructionsEn: "Instructions", pickupTime: "20:00",
    },
  ]);
  await database.insert(notifications).values([
    { id: "read-newer", shopId: "shop-main", eventKey: "read-newer", category: "NEW_ORDER", title: "New reservation", body: "A newer event", readAt: "2026-08-23T10:30:00.000Z", createdAt: "2026-08-23T10:00:00.000Z" },
    { id: "unread-overdue", shopId: "shop-main", eventKey: "unread-overdue", category: "NEW_ORDER_OVERDUE", title: "Reservation overdue", body: "Needs attention", readAt: null, createdAt: "2026-08-23T09:00:00.000Z" },
    { id: "unread-review", shopId: "shop-main", eventKey: "unread-review", category: "READY_REVIEW", title: "Review ready", body: "Customer feedback is ready", readAt: null, createdAt: "2026-08-23T08:00:00.000Z" },
    { id: "other-shop", shopId: "shop-other", eventKey: "other-shop", category: "NEW_ORDER", title: "Private event", body: "Must stay isolated", readAt: null, createdAt: "2026-08-23T11:00:00.000Z" },
  ]);
});

afterEach(() => closeDatabase());
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("notification inbox domain", () => {
  it("keeps shop isolation and places unread events before newer read history", async () => {
    const result = await listNotifications(database, { state: "ALL" });

    expect(result.items.map((item) => item.id)).toEqual(["unread-overdue", "unread-review", "read-newer"]);
    expect(result.unreadCount).toBe(2);
    expect(result.total).toBe(3);
    expect(result.items.some((item) => item.id === "other-shop")).toBe(false);
  });

  it("filters retained history by state, category, severity, and search", async () => {
    const read = await listNotifications(database, { state: "READ" });
    const review = await listNotifications(database, { state: "ALL", category: "READY_REVIEW" });
    const high = await listNotifications(database, { state: "ALL", severity: "HIGH" });
    const search = await listNotifications(database, { state: "ALL", query: "feedback" });

    expect(read.items.map((item) => item.id)).toEqual(["read-newer"]);
    expect(review.items.map((item) => item.id)).toEqual(["unread-review"]);
    expect(high.items.map((item) => item.id)).toEqual(["unread-overdue", "unread-review"]);
    expect(search.items.map((item) => item.id)).toEqual(["unread-review"]);
  });

  it("marks one notification read or unread and audits both changes", async () => {
    await markNotificationReadState(database, "unread-review", true, "manager@example.fi");
    await markNotificationReadState(database, "unread-review", false, "manager@example.fi");

    const row = await database.query.notifications.findFirst({ where: eq(notifications.id, "unread-review") });
    const events = await database.select().from(auditEntries);
    expect(row?.readAt).toBeNull();
    expect(events.map((event) => event.action)).toEqual(expect.arrayContaining(["notification.marked_read", "notification.marked_unread"]));
  });

  it("marks only the filtered unread set and records one audit summary", async () => {
    const result = await markFilteredNotificationsRead(database, { state: "UNREAD", category: "READY_REVIEW" }, "staff@example.fi");
    const rows = await database.select().from(notifications).where(eq(notifications.shopId, "shop-main"));
    const event = await database.query.auditEntries.findFirst({ where: eq(auditEntries.action, "notification.filtered_set_marked_read") });

    expect(result.count).toBe(1);
    expect(rows.find((row) => row.id === "unread-review")?.readAt).not.toBeNull();
    expect(rows.find((row) => row.id === "unread-overdue")?.readAt).toBeNull();
    expect(JSON.parse(event?.detailsJson ?? "{}")).toMatchObject({ count: 1, filters: { category: "READY_REVIEW" } });
  });
});
