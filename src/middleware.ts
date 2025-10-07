import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
    const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth')
    const isApiSeed = req.nextUrl.pathname.startsWith('/api/seed')
    const isApiHealth = req.nextUrl.pathname.startsWith('/api/health')
    const isApiUser = req.nextUrl.pathname.startsWith('/api/user')
    const isApiAdmin = req.nextUrl.pathname.startsWith('/api/admin')
    
    // Allow API auth routes, health check, user routes, admin routes, and seed
    if (isApiAuth || isApiSeed || isApiHealth || isApiUser || isApiAdmin) {
      return NextResponse.next()
    }

    // If user is on auth page and is authenticated, redirect to dashboard
    if (isAuthPage && isAuth) {
      // If user is on first-login page and has completed first login, redirect to dashboard
      if (req.nextUrl.pathname === '/auth/first-login' && !token.isFirstLogin) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      // If user hasn't completed first login, redirect to first-login
      if (req.nextUrl.pathname !== '/auth/first-login' && token.isFirstLogin) {
        return NextResponse.redirect(new URL('/auth/first-login', req.url))
      }
      // If user is authenticated and on sign-in page, redirect to dashboard
      if (req.nextUrl.pathname === '/auth/signin' && !token.isFirstLogin) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    // If user is not authenticated and trying to access protected route
    if (!isAuthPage && !isAuth) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // If user is authenticated but hasn't completed first login
    if (isAuth && token.isFirstLogin && req.nextUrl.pathname !== '/auth/first-login') {
      return NextResponse.redirect(new URL('/auth/first-login', req.url))
    }

    // Admin-only routes protection
    const adminOnlyRoutes = ['/admin']
    const isAdminRoute = adminOnlyRoutes.some(route => 
      req.nextUrl.pathname.startsWith(route)
    )
    
    if (isAdminRoute && isAuth && !token.roles?.includes('ADMIN')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Always allow access to auth pages
        if (req.nextUrl.pathname.startsWith('/auth')) {
          return true
        }
        
        // Allow access to API routes (will be handled by the middleware function)
        if (req.nextUrl.pathname.startsWith('/api')) {
          return true
        }
        
        // For all other routes, require authentication
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ]
}
