import { UserModule } from "../users";
import { AdminRouteFrame } from "../route-frame";
import { AdminPageHeader } from "../presentation";
export const dynamic = "force-dynamic";
export default function UsersPage() { return <AdminRouteFrame permission="shop_users.manage"><main className="shell admin-users-page"><AdminPageHeader eyebrow="ADMINISTRATION" title="Users & permissions" description="Manage staff access and operational permissions." /><div className="admin-users-module"><UserModule /></div></main></AdminRouteFrame>; }
