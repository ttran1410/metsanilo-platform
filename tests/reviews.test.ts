import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabaseConnection, type Database } from "@/db/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { customers, orders, packages, products, reviews, shops } from "@/db/schema";
import { resetEnvForTests } from "@/lib/env";
import {
  confirmManualReview,
  createManualReview,
  createPublicReview,
  deleteReview,
  getReviewRollup,
  linkReviewToCustomerOrOrder,
  listFeaturedReviews,
  listPublishedReviews,
  moderateReview,
  bulkModerateReviews,
  replyToReview,
  updateFullReview,
  updateReviewPublicationIdentity,
} from "@/domain/reviews";
import { moderateAdminReview } from "@/domain/admin-review-actions";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-review-test-"));
let databaseUrl = "";
let database: Database;
let closeDatabase: () => void;

describe("Review Engine & Social Proof Trust System", () => {
  it("rejects review actions with a mismatched admin shop context", async () => {
    await expect(moderateAdminReview(database, { actor: { id: "admin", role: "ADMIN", shopId: "shop-other" }, shop: { id: "shop-main" } }, { id: "review-1", status: "APPROVED" }))
      .rejects.toThrow("Admin action context shop mismatch");
  });
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

  it("moderates review batches atomically and returns refreshed items", async () => {
    const first = await createPublicReview(database, {
      displayName: "Batch One",
      rating: 5,
      originalText: "Erinomainen satokausi ja hyvä palvelu.",
      publicationAcknowledgement: true,
      locale: "fi",
    });
    const second = await createPublicReview(database, {
      displayName: "Batch Two",
      rating: 4,
      originalText: "Hyvä tuote ja nopea nouto.",
      publicationAcknowledgement: true,
      locale: "fi",
    });

    const result = await bulkModerateReviews(database, {
      ids: [first.id, second.id, first.id],
      status: "APPROVED",
      actor: "admin@test.fi",
    });

    expect(result.count).toBe(2);
    expect(result.items.every((review) => review.status === "APPROVED")).toBe(true);
  });

  it("supports offline manual review import with consent tracking", async () => {
    const imported = await createManualReview(database, {
      displayName: "Matti V.",
      isAnonymous: true,
      rating: 5,
      originalText: "Kiitos marjoista WhatsAppin kautta!",
      verifiedBuyer: true,
      acknowledgementSource: "WHATSAPP",
      publicationConsentNote: "Reviewer requested anonymous publication in WhatsApp.",
      actor: "staff@test.fi",
    });

    expect(imported.isAnonymous).toBe(true);
    expect(imported.reviewerName).toBe("Matti V.");
    expect(imported.publicationAcknowledgement).toBe(true);
    expect(imported.acknowledgementSource).toBe("WHATSAPP");
    expect(imported.publicNameConsentNote).toBe("Reviewer requested anonymous publication in WhatsApp.");
    expect(imported.verifiedBuyer).toBe(true);
    expect(imported.verificationType).toBe("STAFF_MANUAL");
  });

  it("supports FACEBOOK and custom channel sources for manual review import and consent confirmation", async () => {
    const fbImported = await createManualReview(database, {
      displayName: "Facebook User",
      rating: 5,
      originalText: "Ihanaa marjasatoa, tilattiin Facebookin kautta!",
      verifiedBuyer: true,
      acknowledgementSource: "FACEBOOK",
      actor: "staff@test.fi",
    });
    expect(fbImported.publicationAcknowledgement).toBe(true);
    expect(fbImported.acknowledgementSource).toBe("FACEBOOK");

    const unconfirmed = await createManualReview(database, {
      displayName: "Unconfirmed User",
      rating: 5,
      originalText: "Upea tuote ja ystävällinen palvelu!",
      actor: "staff@test.fi",
    });
    expect(unconfirmed.publicationAcknowledgement).toBe(false);

    const confirmed = await confirmManualReview(database, {
      id: unconfirmed.id,
      source: "FACEBOOK",
      note: "Confirmed via Facebook Messenger chat",
      actor: "staff@test.fi",
    });
    expect(confirmed.publicationAcknowledgement).toBe(true);
    expect(confirmed.acknowledgementSource).toBe("FACEBOOK");
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

  it("supports listFeaturedReviews random sampling and limit behavior", async () => {
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
        featured: i <= 4,
        actor: "admin@test.fi",
      });
    }

    const featured = await listFeaturedReviews(database, 3);
    expect(featured.length).toBe(3);
    const names = featured.map((f) => f.displayName);
    expect(new Set(names).size).toBe(3);
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

    const page1Result = await listPublishedReviews(database, { page: 1, limit: 10 });
    if (Array.isArray(page1Result)) throw new Error("Expected paginated review result");
    const page1 = page1Result;
    expect(page1.items.length).toBe(10);
    expect(page1.total).toBe(15);
    expect(page1.totalPages).toBe(2);

    const page2Result = await listPublishedReviews(database, { page: 2, limit: 10 });
    if (Array.isArray(page2Result)) throw new Error("Expected paginated review result");
    const page2 = page2Result;
    expect(page2.items.length).toBe(5);
  });

  it("auto-creates a CRM customer profile when public review contact is a new mobile or email", async () => {
    const rev = await createPublicReview(database, {
      displayName: "Matti Meikäläinen",
      rating: 5,
      originalText: "Huippulaatuista mansikkaa! Suosittelen kaikille.",
      contact: "+358409998877",
      crmConsent: true,
      publicationAcknowledgement: true,
      locale: "fi",
    });

    expect(rev.verifiedBuyer).toBe(true);
    expect(rev.verificationType).toBe("HISTORICAL_MATCH");

    const cust = await database.query.customers.findFirst({
      where: eq(customers.mobile, "+358409998877"),
    });

    expect(cust).toBeDefined();
    expect(cust?.name).toBe("Matti Meikäläinen");
  });

  it("keeps anonymous publication separate from verification and CRM consent", async () => {
    const rev = await createPublicReview(database, {
      isAnonymous: true,
      displayName: "Private Reviewer",
      rating: 5,
      originalText: "Anonyymi palaute, jonka tekstin pitää näkyä julkisesti.",
      contact: "+358409998876",
      publicationAcknowledgement: true,
      locale: "fi",
    });

    expect(rev.isAnonymous).toBe(true);
    expect(rev.verifiedBuyer).toBe(false);
    expect(await database.query.customers.findFirst({ where: eq(customers.mobile, "+358409998876") })).toBeUndefined();

    await moderateReview(database, { id: rev.id, status: "APPROVED", actor: "admin@test.fi" });
    const published = await listPublishedReviews(database, { locale: "fi" });
    expect(Array.isArray(published)).toBe(true);
    if (Array.isArray(published)) {
      expect(published[0]?.displayName).toBe("Anonyymi asiakas");
      expect(published[0]).not.toHaveProperty("contact");
    }
  });

  it("requires consent evidence and re-moderation when restoring a public name", async () => {
    const rev = await createPublicReview(database, {
      isAnonymous: true,
      rating: 5,
      originalText: "Anonyymi palaute, jonka tekstin pitää näkyä julkisesti.",
      publicationAcknowledgement: true,
      locale: "fi",
    });

    await expect(updateReviewPublicationIdentity(database, {
      id: rev.id,
      isAnonymous: false,
      reviewerName: "Matti Meikäläinen",
      consentSource: "",
      consentNote: "",
      actor: "admin@test.fi",
    })).rejects.toThrow();

    await moderateReview(database, { id: rev.id, status: "APPROVED", actor: "admin@test.fi" });
    const updated = await updateReviewPublicationIdentity(database, {
      id: rev.id,
      isAnonymous: false,
      reviewerName: "Matti Meikäläinen",
      consentSource: "EMAIL",
      consentNote: "Reviewer explicitly requested public attribution.",
      actor: "admin@test.fi",
    });
    expect(updated.status).toBe("PENDING_CONFIRMATION");
    expect(updated.displayName).toBe("Matti Meikäläinen");
  });

  it("anonymizes an approved named review immediately and records a dedicated audit action", async () => {
    const rev = await createPublicReview(database, {
      displayName: "Named Reviewer",
      rating: 5,
      originalText: "Named review that will be switched to anonymous publication.",
      publicationAcknowledgement: true,
      locale: "en",
    });
    await moderateReview(database, { id: rev.id, status: "APPROVED", actor: "admin@test.fi" });

    const updated = await updateReviewPublicationIdentity(database, {
      id: rev.id,
      isAnonymous: true,
      reviewerName: "Named Reviewer",
      consentSource: "PHONE",
      consentNote: "Reviewer requested anonymous publication by phone.",
      actor: "admin@test.fi",
    });

    expect(updated.isAnonymous).toBe(true);
    expect(updated.status).toBe("APPROVED");
    const audit = await database.query.auditEntries.findFirst({
      where: (entries, { and, eq }) => and(
        eq(entries.entityId, rev.id),
        eq(entries.action, "review.publication_identity_changed"),
      ),
    });
    expect(audit?.action).toBe("review.publication_identity_changed");
  });

  it("supports manual linking of review to customer/order via linkReviewToCustomerOrOrder", async () => {
    const rev = await createPublicReview(database, {
      displayName: "Liisa K.",
      rating: 5,
      originalText: "Ihania marjoja!",
      contact: "liisa@example.fi",
      publicationAcknowledgement: true,
      locale: "fi",
    });

    const updated = await linkReviewToCustomerOrOrder(database, {
      reviewId: rev.id,
      verifiedBuyer: true,
      actor: "admin@test.fi",
    });

    expect(updated.verifiedBuyer).toBe(true);
    expect(updated.verificationType).toBe("STAFF_MANUAL");
  });

  it("fetches review history and sentiment metrics inside getCustomerProfile", async () => {
    await database
      .insert(customers)
      .values({
        id: "cust-rev-1",
        shopId: "shop-main",
        name: "Sentiment Tester",
        email: "sentiment@test.fi",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    await database.insert(reviews).values({
      id: "rev-c1",
      shopId: "shop-main",
      customerId: "cust-rev-1",
      displayName: "Sentiment Tester",
      rating: 5,
      originalText: "Fantastic quality!",
      status: "APPROVED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await database.insert(reviews).values({
      id: "rev-c2",
      shopId: "shop-main",
      customerId: "cust-rev-1",
      displayName: "Sentiment Tester",
      rating: 4,
      originalText: "Great service",
      status: "APPROVED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { getCustomerProfile } = await import("@/domain/customers");
    const profile = await getCustomerProfile(database, "cust-rev-1");

    expect(profile).not.toBeNull();
    expect(profile?.reviews).toHaveLength(2);
    expect(profile?.metrics.reviewCount).toBe(2);
    expect(profile?.metrics.averageRating).toBe(4.5);
  });

  it("supports full review editing via updateFullReview and deletion via deleteReview", async () => {
    const created = await createManualReview(database, {
      displayName: "Matti Meikäläinen",
      rating: 4,
      originalText: "Hienot marjat mutta toimitus myöhästyi vartin.",
      actor: "admin@test.fi",
    });

    // 1. Full Edit
    const updated = await updateFullReview(database, {
      id: created.id,
      displayName: "Matti M.",
      rating: 5,
      displayText: "Hienot marjat!",
      verifiedBuyer: true,
      actor: "admin@test.fi",
    });

    expect(updated.displayName).toBe("Matti M.");
    expect(updated.rating).toBe(5);
    expect(updated.displayText).toBe("Hienot marjat!");
    expect(updated.verifiedBuyer).toBe(true);

    // 2. Delete Review
    const deleteRes = await deleteReview(database, {
      id: created.id,
      actor: "admin@test.fi",
    });

    expect(deleteRes.deleted).toBe(true);

    const check = await database.query.reviews.findFirst({
      where: eq(reviews.id, created.id),
    });
    expect(check).toBeUndefined();
  });
});
