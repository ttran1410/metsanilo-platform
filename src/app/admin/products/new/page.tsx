import Link from "next/link";
import { AdminRouteFrame } from "../../route-frame";
import { adminContext, hasAdminPermission } from "../../portal-auth";
import { ProductCreateView } from "./view";

export const dynamic = "force-dynamic";

export default async function ProductCreatePage() { const { request } = await adminContext(); if (!(await hasAdminPermission(request, "catalog.product.write"))) return <AdminRouteFrame permission="catalog.product.write"><div /></AdminRouteFrame>; return <AdminRouteFrame><main className="shell pb-10"><div className="admin-page-heading"><Link className="back-link" href="/admin/products">← Product listing</Link><p className="eyebrow">CATALOG INTAKE</p><h1>New product</h1><p>Create a product first, then manage packages and media from its detail workspace.</p></div><ProductCreateView /></main></AdminRouteFrame>; }
