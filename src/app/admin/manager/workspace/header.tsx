"use client";

import { AdminNotice, AdminPageHeader } from "../../presentation";

export function ManagerWorkspaceHeader({ title, description, message, messageTone }: {
  title: string;
  description: string;
  message: string;
  messageTone: "success" | "error";
}) {
  return (
    <>
      <AdminPageHeader eyebrow="RESERVATIONS & CAPACITY" title={title} description={description} />
      {message && <AdminNotice tone={messageTone} live>{message}</AdminNotice>}
    </>
  );
}
