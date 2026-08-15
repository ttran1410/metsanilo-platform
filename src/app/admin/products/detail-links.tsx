import type { listManagerProducts } from "@/domain/products";

type ProductRows = Awaited<ReturnType<typeof listManagerProducts>>;

export function ProductDetailLinks({ products }: { products: ProductRows }) {
  return <nav className="card product-detail-links" aria-label="Product detail pages"><strong>Product detail</strong>{products.map((item) => <a className="btn btn-secondary" href={`/admin/products/${item.product.id}`} key={item.product.id}>{item.product.nameFi} →</a>)}</nav>;
}
