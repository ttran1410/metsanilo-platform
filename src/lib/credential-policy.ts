export const CANONICAL_UTC_ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_UTC_ISO_REGEX.test(value)) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString() === value;
}

export function isCredentialStateValid(user: {
  mustChangePassword?: boolean | null;
  temporaryPasswordIssuedAt?: string | null;
  temporaryPasswordExpiresAt?: string | null;
}): boolean {
  if (typeof user.mustChangePassword !== "boolean") {
    return false;
  }
  if (user.mustChangePassword) {
    if (!isCanonicalIsoDate(user.temporaryPasswordIssuedAt) || !isCanonicalIsoDate(user.temporaryPasswordExpiresAt)) {
      return false;
    }
    return Date.parse(user.temporaryPasswordIssuedAt) <= Date.parse(user.temporaryPasswordExpiresAt);
  }
  return user.temporaryPasswordIssuedAt === null && user.temporaryPasswordExpiresAt === null;
}

export function isTemporaryCredentialActive(
  user: {
    mustChangePassword?: boolean | null;
    temporaryPasswordIssuedAt?: string | null;
    temporaryPasswordExpiresAt?: string | null;
  },
  now: Date = new Date()
): boolean {
  if (!user.mustChangePassword || !isCredentialStateValid(user)) return false;
  return now.getTime() < new Date(user.temporaryPasswordExpiresAt!).getTime();
}

export function isTemporaryCredentialExpired(
  user: {
    mustChangePassword?: boolean | null;
    temporaryPasswordIssuedAt?: string | null;
    temporaryPasswordExpiresAt?: string | null;
  },
  now: Date = new Date()
): boolean {
  if (!user.mustChangePassword) return false;
  if (!isCredentialStateValid(user)) return true;
  return now.getTime() >= new Date(user.temporaryPasswordExpiresAt!).getTime();
}
