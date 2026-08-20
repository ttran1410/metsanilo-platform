import type { Meta, StoryObj } from "@storybook/react";

const reviews = [
  { name: "Aino Korhonen", rating: 5, status: "Pending triage", text: "Fresh berries and a very smooth pickup experience." },
  { name: "Mika Salonen", rating: 4, status: "Approved", text: "Good quality and clear communication." },
  { name: "Laura Niemi", rating: 5, status: "Featured", text: "The best local harvest we have ordered this season." },
];

function ReviewsPreview({ pending = true }: { pending?: boolean }) {
  return <main className="admin-reviews-workspace shell py-8 space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Content &amp; trust</p><h1>Review moderation</h1><p className="admin-section-description">Triage customer feedback, verify identity, and curate storefront proof.</p></div><div className="flex flex-wrap items-center gap-3"><span className="pill">Public storefront on</span><button className="btn btn-secondary" type="button">Manual feedback import</button></div></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><div className="card p-4"><span className="eyebrow">Public rating</span><strong className="text-3xl">4.82 ★</strong><small>128 reviews</small></div><div className="card p-4"><span className="eyebrow">Pending triage</span><strong className="text-3xl">{pending ? "7" : "0"}</strong><small>Needs staff review</small></div><div className="card p-4"><span className="eyebrow">Featured</span><strong className="text-3xl">12</strong><small>Homepage highlights</small></div><div className="card p-4"><span className="eyebrow">5-star share</span><strong className="text-3xl">86%</strong><small>Public rating quality</small></div></div><section className="card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1"><button className="btn" type="button">Pending (7)</button><button className="btn btn-secondary" type="button">Approved (118)</button><button className="btn btn-secondary" type="button">Featured (12)</button></div><input aria-label="Search reviews" placeholder="Search reviewer or feedback" /></div><div className="grid gap-3 mt-4">{reviews.filter((review) => pending || review.status !== "Pending triage").map((review) => <article className="rounded-xl border p-4 space-y-3" key={review.name}><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{review.name}</strong><small className="block muted">Verified buyer · Order M-1048</small></div><span className="pill">{review.status}</span></div><div className="text-amber-500">{"★".repeat(review.rating)}<span className="text-slate-300">{"★".repeat(5 - review.rating)}</span></div><p className="text-sm">“{review.text}”</p><div className="profile-actions"><button className="btn btn-secondary" type="button">Edit</button><button className="btn" type="button">Approve</button></div></article>)}</div></section></main>;
}

const meta = { title: "Admin / Reviews", component: ReviewsPreview, parameters: { layout: "fullscreen" }, argTypes: { pending: { control: "boolean" } } } satisfies Meta<typeof ReviewsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ModerationQueue: Story = { args: { pending: true } };
export const ClearedQueue: Story = { args: { pending: false } };
