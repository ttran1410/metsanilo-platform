import type { Meta, StoryObj } from "@storybook/react";
import { MasterAuditWorkspace } from "../audit/master-audit-workspace";

const initialData = { items: [], total: 0, page: 1, limit: 15, totalPages: 1, actors: ["Aino Korhonen"], metrics: { highRisk: 1, sensitiveEdits: 3, opsActions: 18, failedLogins: 1, total7Days: 23 } };

function AuditStory({ canExportAudit = true }: { canExportAudit?: boolean }) {
  return <MasterAuditWorkspace initialData={initialData} canExportAudit={canExportAudit} />;
}

const meta = { title: "Admin / Audit", component: AuditStory, parameters: { layout: "fullscreen" }, argTypes: { canExportAudit: { control: "boolean" } } } satisfies Meta<typeof AuditStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ledger: Story = { args: { canExportAudit: true } };
export const ReadOnly: Story = { args: { canExportAudit: false } };
