import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";
import { ReviewsWorkspace } from "./reviews-workspace";

export const dynamic = "force-dynamic";
export default async function ReviewsPage() { const { request } = await adminContext(); if (!(await hasAdminPermission(request, "reviews.read"))) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to reviews.</p></main></AdminRouteFrame>; return <AdminRouteFrame><ReviewsWorkspace initial={[]} loadInitialFromApi canCreate={await hasAdminPermission(request, "reviews.create")} canModerate={await hasAdminPermission(request, "reviews.moderate")} canFeature={await hasAdminPermission(request, "reviews.feature")} /></AdminRouteFrame>; }
