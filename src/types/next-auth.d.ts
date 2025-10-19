import { Role } from '@prisma/client'
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      isFirstLogin: boolean
      trackHours: boolean
      primaryRole: Role
      roles: Role[]
      email?: string
      name?: string
    }
  }

  interface User {
    id: string
    username: string
    isFirstLogin: boolean
    trackHours: boolean
    primaryRole: Role
    roles: Role[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    isFirstLogin: boolean
    trackHours: boolean
    primaryRole: Role
    roles: Role[]
  }
}
