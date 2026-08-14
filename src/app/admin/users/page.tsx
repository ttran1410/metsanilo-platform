import { UserModule } from "../users";
import { AdminRouteFrame } from "../route-frame";
export const dynamic = "force-dynamic";
export default function UsersPage() { return <AdminRouteFrame permission="shop_users.manage"><UserModule /></AdminRouteFrame>; }
