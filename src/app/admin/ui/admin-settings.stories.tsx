import type { Meta, StoryObj } from "@storybook/react";
import { OperationsSettings } from "../settings";

function SettingsStory({ canManageSettings = true }: { canManageSettings?: boolean }) {
  return <OperationsSettings canManageSettings={canManageSettings} />;
}

const meta = { title: "Admin / Settings", component: SettingsStory, parameters: { layout: "fullscreen" }, argTypes: { canManageSettings: { control: "boolean" } } } satisfies Meta<typeof SettingsStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = { args: { canManageSettings: true } };
export const ReadOnly: Story = { args: { canManageSettings: false } };
