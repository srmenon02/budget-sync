/**
 * Utilities for extracting credentials from the Teller Connect onSuccess payload.
 *
 * The Teller Connect SDK has shipped subtly different payload shapes across
 * versions and environments.  All known shapes are handled here so callers
 * do not need to care about which variant they receive.
 *
 * Known shapes
 * ─────────────────────────────────────────────────────────────────
 * Standard / current SDK (all environments):
 *   {
 *     accessToken: "token_...",
 *     user: { id: "user_..." },
 *     enrollment: { id: "enrollment_...", institution: { name: "..." } },
 *     signatures: [...]
 *   }
 *
 * Flat / older SDK:
 *   { token: "...", id: "...", institution: { name: "..." } }
 *
 * Camel + snake mix:
 *   { access_token: "...", enrollment_id: "..." }
 */

export type TellerEnrollmentPayload = {
  // Access token variants
  accessToken?: string
  access_token?: string
  token?: string
  // Enrollment ID — nested (standard) or flat
  enrollment?: { id?: string; institution?: { name?: string } }
  id?: string
  enrollmentId?: string
  enrollment_id?: string
  // Institution
  institution?: { name?: string }
  user?: { id?: string }
  signatures?: string[]
}

/** Extract the enrollment ID from any known Teller Connect payload shape. */
export function extractEnrollmentId(payload: TellerEnrollmentPayload): string | null {
  if (payload.enrollment?.id) return payload.enrollment.id
  if (payload.enrollmentId) return payload.enrollmentId
  if (payload.enrollment_id) return payload.enrollment_id
  if (payload.id) return payload.id
  return null
}

/** Extract the access token from any known Teller Connect payload shape. */
export function extractAccessToken(payload: TellerEnrollmentPayload): string | null {
  return payload.accessToken ?? payload.access_token ?? payload.token ?? null
}

/** Extract the institution name with a caller-supplied fallback. */
export function extractInstitutionName(
  payload: TellerEnrollmentPayload,
  fallback: string
): string {
  return (
    payload.enrollment?.institution?.name ??
    payload.institution?.name ??
    fallback
  )
}
