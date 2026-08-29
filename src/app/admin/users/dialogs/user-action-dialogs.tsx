"use client";

import { OnboardingModal } from "./onboarding-modal";
import { UserConfirmationDialog } from "./user-confirmation-dialog";
import { UserPasswordDialog } from "./user-password-dialog";

type CreatedUser = { id: string; email: string | null; displayName: string; role: string };
type Confirmation = { title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => Promise<void> };

export function UserActionDialogs({ actorRole, showWizard, confirmation, createdInfo, onCloseWizard, onCreated, onCancelConfirmation, onConfirm, onDismissPassword, onCopyPassword }: {
  actorRole?: "ADMIN" | "MANAGER" | "STAFF" | "CONTENT_CREATOR";
  showWizard: boolean;
  confirmation: Confirmation | null;
  createdInfo: { user: CreatedUser; tempPassword: string } | null;
  onCloseWizard: () => void;
  onCreated: (user: CreatedUser, tempPassword: string) => void;
  onCancelConfirmation: () => void;
  onConfirm: () => Promise<void>;
  onDismissPassword: () => void;
  onCopyPassword: (password: string) => void;
}) {
  return <>
    {showWizard && <OnboardingModal actorRole={actorRole} onClose={onCloseWizard} onCreated={onCreated} />}
    <UserConfirmationDialog confirmation={confirmation} onCancel={onCancelConfirmation} onConfirm={onConfirm} />
    <UserPasswordDialog createdInfo={createdInfo} onDismiss={onDismissPassword} onCopy={onCopyPassword} />
  </>;
}
