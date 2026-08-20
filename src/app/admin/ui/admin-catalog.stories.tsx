import type { Meta, StoryObj } from "@storybook/react";
import { ProductModule } from "../products";
import type { packages, products } from "@/db/schema";

const product: typeof products.$inferSelect = { id: "story-product", shopId: "story-shop", code: "BERRY-01", slug: "metsamustikka", nameFi: "Metsamustikka", nameEn: "Wild blueberry", descriptionFi: "Fresh local berries.", descriptionEn: "Fresh local berries.", availableFrom: "2026-07-01", availableThrough: "2026-09-30", active: true, showOnHomepage: true, showOnReserve: true, sortOrder: 0 };
const productPackage: typeof packages.$inferSelect = { id: "story-package", shopId: "story-shop", productId: product.id, labelFi: "1 litra", labelEn: "1 litre", volumeMl: 1000, priceCents: 4800, active: true, sortOrder: 0, isDefault: true };
const initialProducts = [{ product, packages: [productPackage], media: [{ id: "story-media", url: "/metsanilo-leaf.svg", altFi: "Metsamustikka", altEn: "Wild blueberry", isPrimary: true }] }];

function CatalogStory({ canManageProducts = true }: { canManageProducts?: boolean }) {
  return <ProductModule initialProducts={initialProducts} canManageProducts={canManageProducts} />;
}

const meta = { title: "Admin / Catalog", component: CatalogStory, parameters: { layout: "fullscreen" }, argTypes: { canManageProducts: { control: "boolean" } } } satisfies Meta<typeof CatalogStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MasterDetail: Story = { args: { canManageProducts: true } };
export const ReadOnly: Story = { args: { canManageProducts: false } };
