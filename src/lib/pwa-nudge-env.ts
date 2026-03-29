/** PWA install nudge off in dev (unless forced), or fully off via env. */
export function isPwaNudgeDisabledByEnv(): boolean {
  if (process.env.NEXT_PUBLIC_SKIP_PWA_INSTALL_GATE === 'true') return true
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FORCE_PWA_IN_DEV !== 'true') {
    return true
  }
  return false
}
