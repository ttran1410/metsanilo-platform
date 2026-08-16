import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NewManualOrderRedirect() {
  redirect("/admin/manual-orders");
}
