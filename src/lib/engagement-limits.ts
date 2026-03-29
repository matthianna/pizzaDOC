/** Hours each "Più tardi" hides the engagement row (server + client display). */
export const ENGAGEMENT_SNOOZE_HOURS = 24

/**
 * Max times a user can tap "Più tardi" per category (PWA vs push), lifetime counter.
 * Override with env ENGAGEMENT_MAX_SNOOZES_PER_TYPE (server only).
 */
export function getMaxEngagementSnoozesPerType(): number {
  const raw = process.env.ENGAGEMENT_MAX_SNOOZES_PER_TYPE
  if (raw == null || raw === '') return 7
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 7
  return Math.min(n, 100)
}
