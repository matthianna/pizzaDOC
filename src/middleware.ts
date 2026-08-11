import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkLoginRateLimit, getClientIp } from '@/lib/login-rate-limit'

/** Route NextAuth che devono restare anonime (login, CSRF, sessione, ecc.). */
function isNextAuthPublicRoute(pathname: string): boolean {
  if (
    pathname === '/api/auth/session' ||
    pathname === '/api/auth/csrf' ||
    pathname === '/api/auth/providers'
  ) {
    return true
  }
  if (pathname.startsWith('/api/auth/signin')) return true
  if (pathname.startsWith('/api/auth/callback')) return true
  if (pathname === '/api/auth/signout' || pathname.startsWith('/api/auth/signout/')) {
    return true
  }
  if (pathname.startsWith('/api/auth/error')) return true
  return false
}

/** API raggiungibili senza sessione NextAuth (protezione propria negli handler se applicabile). */
function isPublicApi(pathname: string): boolean {
  if (pathname === '/api/health') return true
  if (pathname === '/api/push/vapid-key') return true
  // Seed is public to NextAuth but always requires Bearer SEED_SECRET in the handler
  if (pathname === '/api/seed') return true
  // Solo job cron reali (Bearer CRON_SECRET nell'handler) — NON /test
  const cronJobs = new Set([
    '/api/cron/availability-reminder',
    '/api/cron/daily-backup',
    '/api/cron/hours-reminder',
    '/api/cron/substitution-expiry',
  ])
  if (cronJobs.has(pathname)) return true
  // Personal ICS feed: authenticated by secret calendarToken in the path
  if (pathname.startsWith('/api/calendar/')) return true
  if (isNextAuthPublicRoute(pathname)) return true
  return false
}

export default withAuth(
  async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname
    const method = req.method
    const token = req.nextauth.token
    const isAuth = !!token

    // Rate limit: solo POST sul callback credentials (brute force password)
    if (path.startsWith('/api/auth/callback/credentials') && method === 'POST') {
      const ip = getClientIp(req)
      const result = await checkLoginRateLimit(`login:${ip}`)
      if (!result.success) {
        return NextResponse.json(
          {
            error: 'Troppi tentativi di accesso. Riprova più tardi.',
            retryAfterSeconds: result.retryAfterSeconds,
          },
          {
            status: 429,
            headers: result.retryAfterSeconds
              ? { 'Retry-After': String(result.retryAfterSeconds) }
              : {},
          }
        )
      }
    }

    // Tutte le altre API: sessione obbligatoria (JSON 401, mai redirect HTML)
    if (path.startsWith('/api')) {
      if (isPublicApi(path)) {
        return NextResponse.next()
      }
      if (!isAuth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (path.startsWith('/api/admin') && !token.roles?.includes('ADMIN')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.next()
    }

    // --- Pagine ---
    const isDesignPreview = path.startsWith('/design-preview')
    if (isDesignPreview) {
      return NextResponse.next()
    }

    // Offline PWA: accessibile senza sessione (fallback service worker)
    if (path === '/offline') {
      return NextResponse.next()
    }

    const isAuthPage = path.startsWith('/auth')

    if (isAuthPage && isAuth) {
      if (path === '/auth/first-login' && !token.isFirstLogin) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      if (path !== '/auth/first-login' && token.isFirstLogin) {
        return NextResponse.redirect(new URL('/auth/first-login', req.url))
      }
      if (path === '/auth/signin' && !token.isFirstLogin) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    if (!isAuthPage && !isDesignPreview && !isAuth) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    if (isAuth && token.isFirstLogin && path !== '/auth/first-login') {
      return NextResponse.redirect(new URL('/auth/first-login', req.url))
    }

    const isAdminRoute = path.startsWith('/admin')
    if (isAdminRoute && isAuth && !token.roles?.includes('ADMIN')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith('/auth')) {
          return true
        }
        if (req.nextUrl.pathname.startsWith('/design-preview')) {
          return true
        }
        if (req.nextUrl.pathname === '/offline') {
          return true
        }
        if (req.nextUrl.pathname.startsWith('/api')) {
          return true
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
}
