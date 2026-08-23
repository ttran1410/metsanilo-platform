import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ReviewsManager } from "../reviews/view";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "../presentation";

const initial = [{ id: "story-review", displayName: "Aino Korhonen", contact: "aino@example.com", rating: 5, originalText: "Fresh berries and a smooth pickup experience.", displayText: null, source: "PUBLIC_FORM" as const, status: "PENDING" as const, publicationAcknowledgement: true, acknowledgementSource: "PUBLIC_FORM", acknowledgedAt: "2026-08-20T10:00:00.000Z", verifiedBuyer: true, verificationType: "DIGITAL_ORDER" as const, featured: false, featuredUntil: null, moderationReason: null, rejectionReason: null, sellerReplyText: null, sellerRepliedAt: null, orderId: "story-order", createdAt: "2026-08-20T10:00:00.000Z" }];

function ReviewsStory({ canCreate = true, canModerate = true, canFeature = true, hasConsent = true }: { canCreate?: boolean; canModerate?: boolean; canFeature?: boolean; hasConsent?: boolean }) {
  return <ReviewsManager initial={initial.map((review) => ({ ...review, publicationAcknowledgement: hasConsent }))} canCreate={canCreate} canModerate={canModerate} canFeature={canFeature} />;
}

const meta = { title: "Admin / Reviews", component: ReviewsStory, parameters: { layout: "fullscreen" }, argTypes: { canCreate: { control: "boolean" }, canModerate: { control: "boolean" }, canFeature: { control: "boolean" }, hasConsent: { control: "boolean" } } } satisfies Meta<typeof ReviewsStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ModerationQueue: Story = { args: { canCreate: true, canModerate: true, canFeature: true } };
export const ReadOnly: Story = { args: { canCreate: false, canModerate: false, canFeature: false } };
export const ConsentMissing: Story = { args: { canCreate: true, canModerate: true, canFeature: true, hasConsent: false } };
export const EmptyQueue: Story = { render: () => <ReviewsManager initial={[]} canCreate canModerate canFeature /> };

function ReviewStateDemo({ state }: { state: "loading" | "empty" | "error" | "filtered" | "success" | "conflict" }) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState(state === "success" ? "Reviews updated successfully." : state === "conflict" ? "This review changed elsewhere. Refresh before retrying." : "");
  const filtered = query ? initial.filter((review) => review.displayName.toLowerCase().includes(query.toLowerCase())) : initial;

  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="CONTENT & TRUST" title="Reviews" description="Deterministic Storybook states for the moderation workspace." />
    {state === "loading" ? <div className="card p-8 text-sm muted" role="status">Loading reviews…</div> : state === "empty" ? <AdminEmptyState title="No reviews found" description="Try changing the filters or invite a customer to leave feedback." /> : state === "error" ? <AdminNotice tone="error" live>Unable to load reviews. Retry the request.</AdminNotice> : <>
      {notice && <AdminNotice tone={state === "conflict" ? "warning" : "success"} live>{notice}</AdminNotice>}
      <label className="field mt-4 max-w-sm"><span>Search reviews</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by reviewer" /></label>
      {state === "filtered" && !filtered.length ? <AdminEmptyState title="No matching reviews" description="Clear the search to return to the moderation queue." /> : <div className="card mt-4 p-4 text-sm">{filtered.map((review) => <div key={review.id} className="flex items-center justify-between border-b border-line py-3"><strong>{review.displayName}</strong><span>{review.rating}/5</span></div>)}<button type="button" className="btn mt-4" onClick={() => setNotice("Reviews updated successfully.")}>Apply moderation</button></div>}
    </>}</main>;
}

export const Loading: Story = { render: () => <ReviewStateDemo state="loading" /> };
export const Empty: Story = { render: () => <ReviewStateDemo state="empty" /> };
export const Error: Story = { render: () => <ReviewStateDemo state="error" /> };
export const Filtered: Story = { render: () => <ReviewStateDemo state="filtered" /> };
export const MutationSuccess: Story = { render: () => <ReviewStateDemo state="success" /> };
export const MutationConflict: Story = { render: () => <ReviewStateDemo state="conflict" /> };
