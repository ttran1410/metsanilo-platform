import { UserModule } from "../users";
import { AdminRouteFrame } from "../route-frame";
export const dynamic = "force-dynamic";
export default function UsersPage() { return <AdminRouteFrame><UserModule /></AdminRouteFrame>; }
