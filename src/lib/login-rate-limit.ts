import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
// Entry per Edge / middleware (evita bundle nodejs.mjs)
import { Redis } from '@upstash/redis/cloudflare'

/** Tentativi consentiti per finestra (stesso IP o chiave). */
const LOGIN_MAX_PER_WINDOW = 12
const LOGIN_WINDOW_SECONDS = 60

declare global {
  var __pizzadocLoginRatelimit: Ratelimit | undefined
  var __pizzadocLoginMemory: Map<string, { count: number; windowStart: number }> | undefined
}

function getUpstashRatelimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!globalThis.__pizzadocLoginRatelimit) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    globalThis.__pizzadocLoginRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LOGIN_MAX_PER_WINDOW, `${LOGIN_WINDOW_SECONDS} s`),
      prefix: 'pizzadoc:login',
    })
  }
  return globalThis.__pizzadocLoginRatelimit
}

function memoryLimit(key: string): { success: boolean; retryAfterSeconds?: number } {
  const map = (globalThis.__pizzadocLoginMemory ??= new Map())
  const now = Date.now()
  const windowMs = LOGIN_WINDOW_SECONDS * 1000
  let b = map.get(key)
  if (!b || now - b.windowStart >= windowMs) {
    b = { count: 0, windowStart: now }
  }
  b.count += 1
  map.set(key, b)
  if (b.count > LOGIN_MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - b.windowStart)) / 1000)
    )
    return { success: false, retryAfterSeconds }
  }
  return { success: true }
}

export function getClientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  const vercel = req.headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0].trim()
  return req.ip?.trim() || 'unknown'
}

/**
 * Limita i tentativi di login (POST credentials). Usa Upstash se configurato,
 * altrimenti finestra in memoria (meno affidabile su più istanze serverless).
 */
export async function checkLoginRateLimit(key: string): Promise<{
  success: boolean
  retryAfterSeconds?: number
}> {
  const rl = getUpstashRatelimit()
  if (rl) {
    const result = await rl.limit(key)
    if (result.success) {
      return { success: true }
    }
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000)
    )
    return { success: false, retryAfterSeconds }
  }
  return memoryLimit(key)
}
