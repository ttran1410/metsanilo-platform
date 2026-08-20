import type { Meta, StoryObj } from "@storybook/react";

const days = [
  { day: "Mon", date: "24 Aug", reserved: "42 L", capacity: "80 L", percent: 52, tone: "open" },
  { day: "Tue", date: "25 Aug", reserved: "68 L", capacity: "80 L", percent: 85, tone: "near" },
  { day: "Wed", date: "26 Aug", reserved: "80 L", capacity: "80 L", percent: 100, tone: "full" },
  { day: "Thu", date: "27 Aug", reserved: "0 L", capacity: "0 L", percent: 0, tone: "unplanned" },
  { day: "Fri", date: "28 Aug", reserved: "24 L", capacity: "80 L", percent: 30, tone: "open" },
];

function AvailabilityPreview({ attention = false }: { attention?: boolean }) {
  const visibleDays = attention ? days.filter((day) => day.tone === "near" || day.tone === "full") : days;
  return <main className="availability-workspace shell py-8"><div className="admin-page-header"><p className="eyebrow">Harvest planning</p><h1>Capacity &amp; availability</h1><p className="admin-section-description">Plan the selling window before reservations consume it.</p></div><section className="card p-4 flex flex-col gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-1 bg-surface-muted p-1 rounded-xl border border-line"><button className="btn" type="button">Week</button><button className="btn btn-secondary" type="button">Month</button><button className="btn btn-secondary" type="button">Table</button></div><button className="btn btn-secondary" type="button">Open batch planner</button></div><div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line"><span>24–30 August 2026</span><span><strong>320 L</strong> planned <strong>214 L</strong> reserved <strong>67%</strong> used</span></div></section><section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">{visibleDays.map((day) => <article className={`card p-3 flex flex-col justify-between gap-3 ${day.tone === "full" ? "bg-rose-50/50 border-rose-300" : day.tone === "near" ? "bg-amber-50/50 border-amber-300" : ""}`} key={day.date}><div><p className="eyebrow">{day.day}</p><h2>{day.date}</h2></div><div><strong>{day.reserved}</strong> <small>of {day.capacity}</small><div className="capacity-track mt-2"><span style={{ width: `${day.percent}%` }} /></div></div><span className="pill">{day.tone === "full" ? "Sold out" : day.tone === "near" ? "Near limit" : day.tone === "unplanned" ? "Unplanned" : "Open"}</span></article>)}</section></main>;
}

const meta = { title: "Admin / Availability", component: AvailabilityPreview, parameters: { layout: "fullscreen" }, argTypes: { attention: { control: "boolean" } } } satisfies Meta<typeof AvailabilityPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PlanningWindow: Story = { args: { attention: false } };
export const AttentionOnly: Story = { args: { attention: true } };
