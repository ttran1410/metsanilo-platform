import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: { controls: { expanded: true }, a11y: { element: "#storybook-root" } },
};

export default preview;
