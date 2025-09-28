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
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            username: credentials.username
          },
          include: {
            userRoles: true
          }
        })

        if (!user || !user.isActive) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          username: user.username,
          isFirstLogin: user.isFirstLogin,
          primaryRole: user.primaryRole,
          roles: user.userRoles.map(ur => ur.role)
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.isFirstLogin = user.isFirstLogin
        token.primaryRole = user.primaryRole
        token.roles = user.roles
      }
      
      // Handle session update (e.g., after password change)
      if (trigger === 'update' && session) {
        // Update token with latest user data
        const updatedUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { userRoles: true }
        })
        
        if (updatedUser) {
          token.isFirstLogin = updatedUser.isFirstLogin
          token.primaryRole = updatedUser.primaryRole
          token.roles = updatedUser.userRoles.map(ur => ur.role)
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
