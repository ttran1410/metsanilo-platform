import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { listManagerOrdersWithPaymentSummary } from "@/domain/orders";
import { failure } from "../../../response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "orders.export");
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    const selectedIds = idsParam ? idsParam.split(",").filter(Boolean) : [];

    let ordersList = await listManagerOrdersWithPaymentSummary(db());

    if (selectedIds.length > 0) {
      const idSet = new Set(selectedIds);
      ordersList = ordersList.filter((o) => idSet.has(o.id));
    }

    const headers = [
      "Public Reference",
      "Created At",
      "Customer Name",
      "Mobile",
      "Email",
      "Fulfillment Method",
      "Fulfillment Date",
      "Pickup Time",
      "Street Address",
      "City",
      "Package",
      "Volume (L)",
      "Status",
      "Payment Status",
      "Total Amount (€)",
    ];

    const csvRows = [headers.join(",")];

    for (const o of ordersList) {
      const row = [
        `"${o.publicReference}"`,
        `"${o.createdAt.slice(0, 10)}"`,
        `"${(o.customerName || "").replaceAll('"', '""')}"`,
        `"${o.mobile}"`,
        `"${o.email ?? ""}"`,
        `"${o.fulfillmentMethod}"`,
        `"${o.fulfillmentDate}"`,
        `"${o.pickupTime ?? ""}"`,
        `"${(o.streetAddress || "").replaceAll('"', '""')}"`,
        `"${o.city || "Pori"}"`,
        `"${(o.packageLabelFi || "").replaceAll('"', '""')}"`,
        (o.volumeMl / 1000).toFixed(1),
        `"${o.status}"`,
        `"${o.paymentStatus ?? "UNPAID"}"`,
        ((o.finalTotalCents ?? o.itemSubtotalCents) / 100).toFixed(2),
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="metsanilo-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
