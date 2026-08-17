import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabaseConnection, type Database } from "@/db/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { orders, packages, products, reviews, shops } from "@/db/schema";
import { resetEnvForTests } from "@/lib/env";
import {
  confirmManualReview,
  createManualReview,
  createPublicReview,
  getReviewRollup,
  listFeaturedReviews,
  listManagerReviews,
  listPublishedReviews,
  moderateReview,
  recalculateReviewRollup,
  replyToReview,
} from "@/domain/reviews";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-review-test-"));
let databaseUrl = "";
let database: Database;
let closeDatabase: () => void;

describe("Review Engine & Social Proof Trust System", () => {
  beforeEach(async () => {
    databaseUrl = `file:${join(directory, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)}`;
    process.env.TURSO_DATABASE_URL = databaseUrl;
    process.env.SHOP_ID = "shop-main";
    resetEnvForTests();
    const connection = createDatabaseConnection(databaseUrl);
    database = connection.database;
    closeDatabase = connection.close;
    await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

    await database.insert(shops).values({
      id: "shop-main",
      slug: "main",
      nameFi: "Testikauppa",
      nameEn: "Test Shop",
      timezone: "Europe/Helsinki",
      active: true,
      pickupNameFi: "Nouto",
      pickupNameEn: "Pickup",
      pickupAddress: "Torikatu 1",
      pickupInstructionsFi: "Ohje",
      pickupInstructionsEn: "Instruction",
      pickupTime: "20:00",
      reviewsVisible: true,
    });
  });

  afterEach(() => {
    if (closeDatabase) closeDatabase();
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });


  it("auto-matches public review with digital order for verified buyer status", async () => {
    // Seed product, package & order
    await database.insert(products).values({
      id: "prod-1",
      shopId: "shop-main",
      code: "MUSTIKKA",
      slug: "mustikka",
      nameFi: "Mustikka",
      nameEn: "Blueberry",
      availableFrom: "2026-06-01",
      availableThrough: "2026-09-30",
    });

    await database.insert(packages).values({
      id: "pkg-1",
      shopId: "shop-main",
      productId: "prod-1",
      labelFi: "10L",
      labelEn: "10L",
      volumeMl: 10000,
      priceCents: 5000,
    });

    await database.insert(orders).values({
      id: "ord-1001",
      shopId: "shop-main",
      publicReference: "R-9102",
      idempotencyKey: "idemp-1",
      productId: "prod-1",
      packageId: "pkg-1",
      productNameFi: "Mustikka",
      productNameEn: "Blueberry",
      packageLabelFi: "10L",
      packageLabelEn: "10L",
      quantity: 1,
      volumeMl: 10000,
      itemSubtotalCents: 5000,
      fulfillmentDate: "2026-08-20",
      fulfillmentMethod: "PICKUP",
      customerName: "Maija Virtanen",
      mobile: "0401234567",
      locale: "fi",
      status: "PICKED_UP",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });


    const result = await createPublicReview(database, {
      displayName: "Maija V.",
      rating: 5,
      originalText: "Aivan mahtavia mustikoita! Suoraan pakkaseen.",
      publicationAcknowledgement: true,
      contact: "R-9102",
      locale: "fi",
    });

    expect(result.verifiedBuyer).toBe(true);
    expect(result.verificationType).toBe("DIGITAL_ORDER");

    const created = await database.query.reviews.findFirst({
      where: (tbl, { eq }) => eq(tbl.id, result.id),
    });
    expect(created?.orderId).toBe("ord-1001");
  });

  it("calculates rating rollups accurately on review moderation", async () => {
    const r1 = await createPublicReview(database, {
      displayName: "Antti K.",
      rating: 5,
      originalText: "Loistava laatu ja nopea toimitus!",
      publicationAcknowledgement: true,
      locale: "fi",
    });

    const r2 = await createPublicReview(database, {
      displayName: "Pekka M.",
      rating: 4,
      originalText: "Hyvät marjat mutta noudossa oli pientä ruuhkaa.",
      publicationAcknowledgement: true,
      locale: "fi",
    });

    await moderateReview(database, {
      id: r1.id,
      status: "APPROVED",
      actor: "admin@test.fi",
    });

    await moderateReview(database, {
      id: r2.id,
      status: "APPROVED",
      actor: "admin@test.fi",
    });

    const rollup = await getReviewRollup(database);
    expect(rollup.ratingAvg).toBe(4.5);
    expect(rollup.reviewCount).toBe(2);
    expect(rollup.starDistribution["5"]).toBe(1);
    expect(rollup.starDistribution["4"]).toBe(1);
  });

  it("supports seller replies and logs audit trails", async () => {
    const rev = await createPublicReview(database, {
      displayName: "Liisa S.",
      rating: 5,
      originalText: "Puhtaita ja suuria marjoja!",
      publicationAcknowledgement: true,
      locale: "fi",
    });

    await moderateReview(database, {
      id: rev.id,
      status: "APPROVED",
      actor: "admin@test.fi",
    });

    const updated = await replyToReview(database, {
      id: rev.id,
      replyText: "Lämmin kiitos palautteesta Liisa!",
      actor: "admin@test.fi",
    });

    expect(updated.sellerReplyText).toBe("Lämmin kiitos palautteesta Liisa!");
    expect(updated.sellerRepliedBy).toBe("admin@test.fi");
  });

  it("supports offline manual review import with consent tracking", async () => {
    const imported = await createManualReview(database, {
      displayName: "Matti V.",
      rating: 5,
      originalText: "Kiitos marjoista WhatsAppin kautta!",
      verifiedBuyer: true,
      acknowledgementSource: "WHATSAPP",
      actor: "staff@test.fi",
    });

    expect(imported.publicationAcknowledgement).toBe(true);
    expect(imported.acknowledgementSource).toBe("WHATSAPP");
    expect(imported.verifiedBuyer).toBe(true);
    expect(imported.verificationType).toBe("STAFF_MANUAL");
  });

  it("allows featuring an approved review without providing status parameter", async () => {
    const rev = await createPublicReview(database, {
      displayName: "Sari H.",
      rating: 5,
      originalText: "Erinomaisia marjoja, tilaan uudelleen!",
      publicationAcknowledgement: true,
      locale: "fi",
    });

    await moderateReview(database, {
      id: rev.id,
      status: "APPROVED",
      actor: "admin@test.fi",
    });

    const featured = await moderateReview(database, {
      id: rev.id,
      featured: true,
      featuredUntil: "2026-11-15T14:34:00.452Z",
      actor: "admin@test.fi",
    });

    expect(featured.featured).toBe(true);
    expect(featured.status).toBe("APPROVED");
    expect(featured.featuredUntil).toBe("2026-11-15T14:34:00.452Z");
  });

  it("supports listFeaturedReviews top 3 limit and fallback behavior", async () => {
    for (let i = 1; i <= 5; i++) {
      const rev = await createPublicReview(database, {
        displayName: `User ${i}`,
        rating: 5,
        originalText: `Review text ${i} for testing featured limit.`,
        publicationAcknowledgement: true,
        locale: "fi",
      });
      await moderateReview(database, {
        id: rev.id,
        status: "APPROVED",
        featured: i <= 2,
        actor: "admin@test.fi",
      });
    }

    const featured = await listFeaturedReviews(database, 3);
    expect(featured.length).toBe(3);
    expect(featured[0].displayName).toBe("User 2");
    expect(featured[1].displayName).toBe("User 1");
  });

  it("supports pagination in listPublishedReviews", async () => {
    for (let i = 1; i <= 15; i++) {
      const rev = await createPublicReview(database, {
        displayName: `Customer ${i}`,
        rating: 5,
        originalText: `Test review number ${i} for published reviews pagination.`,
        publicationAcknowledgement: true,
        locale: "fi",
      });
      await moderateReview(database, {
        id: rev.id,
        status: "APPROVED",
        actor: "admin@test.fi",
      });
    }

    const page1 = (await listPublishedReviews(database, { page: 1, limit: 10 })) as any;
    expect(page1.items.length).toBe(10);
    expect(page1.total).toBe(15);
    expect(page1.totalPages).toBe(2);

    const page2 = (await listPublishedReviews(database, { page: 2, limit: 10 })) as any;
    expect(page2.items.length).toBe(5);
  });
});
