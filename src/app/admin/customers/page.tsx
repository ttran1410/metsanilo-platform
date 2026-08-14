import { CustomersModule } from "../customers";
import { AdminRouteFrame } from "../route-frame";
export const dynamic = "force-dynamic";
export default function CustomersPage() { return <AdminRouteFrame><CustomersModule /></AdminRouteFrame>; }
