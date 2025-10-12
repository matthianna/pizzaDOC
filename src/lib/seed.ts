import { prisma } from './prisma'
import { hashPassword } from './utils'
import { Role } from '@prisma/client'
import crypto from 'crypto'

export async function seedDatabase() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.User.findFirst({
      where: {
        user_roles: {
          some: {
            role: Role.ADMIN
          }
        }
      }
    })

    if (existingAdmin) {
      console.log('Admin already exists')
      return
    }

    // Create admin user
    const adminPassword = await hashPassword('admin')
    
    const admin = await prisma.User.create({
      data: {
        username: 'admin',
        password: adminPassword,
        isFirstLogin: true,
        isActive: true,
        primaryRole: Role.ADMIN,
        user_roles: {
          create: {
            role: Role.ADMIN
          }
        }
      }
    })

    // Create default shift limits
    const defaultLimits = [
      // Lunedì
      { dayOfWeek: 1, shiftType: 'PRANZO', role: 'CUCINA', requiredStaff: 2 },
      { dayOfWeek: 1, shiftType: 'PRANZO', role: 'FATTORINO', requiredStaff: 1 },
      { dayOfWeek: 1, shiftType: 'PRANZO', role: 'SALA', requiredStaff: 1 },
      { dayOfWeek: 1, shiftType: 'CENA', role: 'CUCINA', requiredStaff: 3 },
      { dayOfWeek: 1, shiftType: 'CENA', role: 'FATTORINO', requiredStaff: 2 },
      { dayOfWeek: 1, shiftType: 'CENA', role: 'SALA', requiredStaff: 2 },
      
      // Martedì
      { dayOfWeek: 2, shiftType: 'PRANZO', role: 'CUCINA', requiredStaff: 2 },
      { dayOfWeek: 2, shiftType: 'PRANZO', role: 'FATTORINO', requiredStaff: 1 },
      { dayOfWeek: 2, shiftType: 'PRANZO', role: 'SALA', requiredStaff: 1 },
      { dayOfWeek: 2, shiftType: 'CENA', role: 'CUCINA', requiredStaff: 3 },
      { dayOfWeek: 2, shiftType: 'CENA', role: 'FATTORINO', requiredStaff: 2 },
      { dayOfWeek: 2, shiftType: 'CENA', role: 'SALA', requiredStaff: 2 },

      // Mercoledì
      { dayOfWeek: 3, shiftType: 'PRANZO', role: 'CUCINA', requiredStaff: 2 },
      { dayOfWeek: 3, shiftType: 'PRANZO', role: 'FATTORINO', requiredStaff: 1 },
      { dayOfWeek: 3, shiftType: 'PRANZO', role: 'SALA', requiredStaff: 1 },
      { dayOfWeek: 3, shiftType: 'CENA', role: 'CUCINA', requiredStaff: 3 },
      { dayOfWeek: 3, shiftType: 'CENA', role: 'FATTORINO', requiredStaff: 2 },
      { dayOfWeek: 3, shiftType: 'CENA', role: 'SALA', requiredStaff: 2 },

      // Giovedì
      { dayOfWeek: 4, shiftType: 'PRANZO', role: 'CUCINA', requiredStaff: 2 },
      { dayOfWeek: 4, shiftType: 'PRANZO', role: 'FATTORINO', requiredStaff: 1 },
      { dayOfWeek: 4, shiftType: 'PRANZO', role: 'SALA', requiredStaff: 1 },
      { dayOfWeek: 4, shiftType: 'CENA', role: 'CUCINA', requiredStaff: 3 },
      { dayOfWeek: 4, shiftType: 'CENA', role: 'FATTORINO', requiredStaff: 2 },
      { dayOfWeek: 4, shiftType: 'CENA', role: 'SALA', requiredStaff: 2 },

      // Venerdì
      { dayOfWeek: 5, shiftType: 'PRANZO', role: 'CUCINA', requiredStaff: 2 },
      { dayOfWeek: 5, shiftType: 'PRANZO', role: 'FATTORINO', requiredStaff: 1 },
      { dayOfWeek: 5, shiftType: 'PRANZO', role: 'SALA', requiredStaff: 1 },
      { dayOfWeek: 5, shiftType: 'CENA', role: 'CUCINA', requiredStaff: 4 },
      { dayOfWeek: 5, shiftType: 'CENA', role: 'FATTORINO', requiredStaff: 3 },
      { dayOfWeek: 5, shiftType: 'CENA', role: 'SALA', requiredStaff: 3 },

      // Sabato
      { dayOfWeek: 6, shiftType: 'PRANZO', role: 'CUCINA', requiredStaff: 3 },
      { dayOfWeek: 6, shiftType: 'PRANZO', role: 'FATTORINO', requiredStaff: 2 },
      { dayOfWeek: 6, shiftType: 'PRANZO', role: 'SALA', requiredStaff: 2 },
      { dayOfWeek: 6, shiftType: 'CENA', role: 'CUCINA', requiredStaff: 4 },
      { dayOfWeek: 6, shiftType: 'CENA', role: 'FATTORINO', requiredStaff: 3 },
      { dayOfWeek: 6, shiftType: 'CENA', role: 'SALA', requiredStaff: 3 },

      // Domenica
      { dayOfWeek: 0, shiftType: 'PRANZO', role: 'CUCINA', requiredStaff: 3 },
      { dayOfWeek: 0, shiftType: 'PRANZO', role: 'FATTORINO', requiredStaff: 2 },
      { dayOfWeek: 0, shiftType: 'PRANZO', role: 'SALA', requiredStaff: 2 },
      { dayOfWeek: 0, shiftType: 'CENA', role: 'CUCINA', requiredStaff: 4 },
      { dayOfWeek: 0, shiftType: 'CENA', role: 'FATTORINO', requiredStaff: 3 },
      { dayOfWeek: 0, shiftType: 'CENA', role: 'SALA', requiredStaff: 3 },
    ]

    for (const limit of defaultLimits) {
      await prisma.shift_limits.create({
        data: {
          id: crypto.randomUUID(),
          dayOfWeek: limit.dayOfWeek,
          shiftType: limit.shiftType as any,
          role: limit.role as any,
          requiredStaff: limit.requiredStaff,
          updatedAt: new Date()
        }
      })
    }

    console.log('Database seeded successfully')
    console.log('Admin user created:')
    console.log('Username: admin')
    console.log('Password: admin')
    console.log('Please change the password on first login')

  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}
