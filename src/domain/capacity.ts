import { DomainError } from "./errors";

/**
 * Pure capacity calculation shared by server domain actions and client previews.
 * Keep this module free of database and Node-only imports so it is safe to use
 * from Client Components.
 */
export function calculateCapacityAdjustment(currentCapacityMl: number, reservedMl: number, deltaMl: number) {
  const nextCapacityMl = currentCapacityMl + deltaMl;
  if (!Number.isInteger(nextCapacityMl) || nextCapacityMl < 0) {
    throw new DomainError("VALIDATION_ERROR", "Capacity must be non-negative millilitres", 422);
  }
  if (nextCapacityMl < reservedMl) {
    throw new DomainError("BELOW_RESERVED", "Capacity cannot be lower than reserved volume", 409);
  }
  return nextCapacityMl;
}
