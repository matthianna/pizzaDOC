import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        try {
          console.log('[AUTH] Authorize called')
          console.log('[AUTH] Prisma defined:', !!prisma)
          console.log('[AUTH] Credentials present:', !!credentials)
          
          if (!credentials?.username || !credentials?.password) {
            console.error('[AUTH] Missing credentials')
            return null
          }

          console.log('[AUTH] Attempting login for:', credentials.username)
          
          // Verifica critica che Prisma sia inizializzato
          if (typeof prisma === 'undefined' || !prisma) {
            console.error('[AUTH] CRITICAL: Prisma client is undefined!')
            console.error('[AUTH] This should never happen - check src/lib/prisma.ts')
            throw new Error('Database connection failed - Prisma client not initialized')
          }

          console.log('[AUTH] Prisma client OK, querying user...')
          const user = await prisma.user.findUnique({
            where: {
              username: credentials.username
            },
            include: {
              user_roles: true
            }
          })

          if (!user || !user.isActive) {
            console.error('[AUTH] User not found or inactive:', credentials.username)
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            console.error('[AUTH] Invalid password for:', credentials.username)
            return null
          }

          console.log('[AUTH] Login successful for:', credentials.username)
          return {
            id: user.id,
            username: user.username,
            isFirstLogin: user.isFirstLogin,
            primaryRole: user.primaryRole,
            roles: user.user_roles.map(ur => ur.role)
          }
        } catch (error) {
          console.error('[AUTH] Authorization error:', error)
          throw error
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour - refresh session every hour
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.isFirstLogin = user.isFirstLogin
        token.primaryRole = user.primaryRole
        token.roles = user.roles
        token.lastActivity = Date.now()
      }
      
      // Check if user is still active and update token periodically
      if (token.id && (!token.lastActivity || Date.now() - (token.lastActivity as number) > 5 * 60 * 1000)) {
        try {
          const currentUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { user_roles: true }
          })
          
          if (!currentUser || !currentUser.isActive) {
            // User has been deactivated, invalidate session
            return null
          }
          
          // Update token with latest user data
          token.isFirstLogin = currentUser.isFirstLogin
          token.primaryRole = currentUser.primaryRole
          token.roles = currentUser.user_roles.map(ur => ur.role)
          token.lastActivity = Date.now()
        } catch (error) {
          console.error('Error refreshing user data:', error)
          // Continue with existing token if DB error
        }
      }
      
      // Handle session update (e.g., after password change)
      if (trigger === 'update' && session) {
        const updatedUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { user_roles: true }
        })
        
        if (updatedUser) {
          token.isFirstLogin = updatedUser.isFirstLogin
          token.primaryRole = updatedUser.primaryRole
          token.roles = updatedUser.user_roles.map(ur => ur.role)
          token.lastActivity = Date.now()
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.isFirstLogin = token.isFirstLogin as boolean
        session.user.primaryRole = token.primaryRole as Role
        session.user.roles = token.roles as Role[]
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  },
  events: {
    async signOut() {
      // Custom logout logic if needed
    }
  }
}
