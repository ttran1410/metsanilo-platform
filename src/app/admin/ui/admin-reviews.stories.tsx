import type { Meta, StoryObj } from "@storybook/react";
import { ReviewsManager } from "../reviews/view";

const initial = [{ id: "story-review", displayName: "Aino Korhonen", contact: "aino@example.com", rating: 5, originalText: "Fresh berries and a smooth pickup experience.", displayText: null, source: "PUBLIC_FORM" as const, status: "PENDING" as const, publicationAcknowledgement: true, acknowledgementSource: "PUBLIC_FORM", acknowledgedAt: "2026-08-20T10:00:00.000Z", verifiedBuyer: true, verificationType: "DIGITAL_ORDER" as const, featured: false, featuredUntil: null, moderationReason: null, rejectionReason: null, sellerReplyText: null, sellerRepliedAt: null, orderId: "story-order", createdAt: "2026-08-20T10:00:00.000Z" }];

function ReviewsStory({ canCreate = true, canModerate = true, canFeature = true }: { canCreate?: boolean; canModerate?: boolean; canFeature?: boolean }) {
  return <ReviewsManager initial={initial} canCreate={canCreate} canModerate={canModerate} canFeature={canFeature} />;
}

const meta = { title: "Admin / Reviews", component: ReviewsStory, parameters: { layout: "fullscreen" }, argTypes: { canCreate: { control: "boolean" }, canModerate: { control: "boolean" }, canFeature: { control: "boolean" } } } satisfies Meta<typeof ReviewsStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ModerationQueue: Story = { args: { canCreate: true, canModerate: true, canFeature: true } };
export const ReadOnly: Story = { args: { canCreate: false, canModerate: false, canFeature: false } };
