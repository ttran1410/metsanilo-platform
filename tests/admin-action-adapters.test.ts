import { afterEach, describe, expect, it, vi } from "vitest";
import { archiveProduct, deleteProduct, restoreProduct, updateProduct } from "@/app/admin/products/actions/product-admin-actions";
import { inviteUser, resetUserPassword, updateUserPermission, updateUserRole, updateUserStatus } from "@/app/admin/users/actions/user-admin-actions";

afterEach(() => vi.restoreAllMocks());

describe("admin mutation action adapters", () => {
  it("maps product archive and restore commands to the product API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { id: "p1" } }), { status: 200 }));
    await archiveProduct("p1");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/products/p1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "active", active: false }) }));
    await restoreProduct("p1");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/products/p1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "active", active: true }) }));
  });

  it("maps product update and delete commands", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { id: "p1" } }), { status: 200 }));
    await updateProduct("p1", { nameFi: "Mustikka" });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/products/p1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "update", product: { nameFi: "Mustikka" } }) }));
    await deleteProduct("p1");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/products/p1", expect.objectContaining({ method: "DELETE" }));
  });

  it("maps user status, password, invite, and permission commands", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { temporaryPassword: "x" } }), { status: 200 }));
    await updateUserStatus("u1", false);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/users/u1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "active", active: false }) }));
    await resetUserPassword("u1");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/users/u1/password", expect.objectContaining({ method: "POST" }));
    await inviteUser({ displayName: "A", email: "a@example.com", role: "STAFF", password: "secret" });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/users", expect.objectContaining({ method: "POST" }));
    await updateUserPermission({ userId: "u1", permission: "orders.read", granted: true });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/users/u1/permissions", expect.objectContaining({ method: "PUT" }));
  });

  it("sends the typed role command and leaves self-downgrade enforcement to the server", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { id: "u1" } }), { status: 200 }));
    await updateUserRole({ userId: "u1", displayName: "Admin", nextRole: "STAFF" });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/u1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "update", displayName: "Admin", role: "STAFF" }) }));
  });
});
