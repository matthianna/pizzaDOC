import { prisma } from './prisma'
import { hashPassword } from './utils'
import { Role } from '@prisma/client'

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
      { dayOfWeek: 1, shiftType: 'PRANZO', role: 'CUCINA', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 1, shiftType: 'PRANZO', role: 'FATTORINO', minStaff: 1, maxStaff: 2 },
      { dayOfWeek: 1, shiftType: 'PRANZO', role: 'SALA', minStaff: 1, maxStaff: 3 },
      { dayOfWeek: 1, shiftType: 'CENA', role: 'CUCINA', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 1, shiftType: 'CENA', role: 'FATTORINO', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 1, shiftType: 'CENA', role: 'SALA', minStaff: 2, maxStaff: 4 },
      
      // Martedì
      { dayOfWeek: 2, shiftType: 'PRANZO', role: 'CUCINA', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 2, shiftType: 'PRANZO', role: 'FATTORINO', minStaff: 1, maxStaff: 2 },
      { dayOfWeek: 2, shiftType: 'PRANZO', role: 'SALA', minStaff: 1, maxStaff: 3 },
      { dayOfWeek: 2, shiftType: 'CENA', role: 'CUCINA', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 2, shiftType: 'CENA', role: 'FATTORINO', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 2, shiftType: 'CENA', role: 'SALA', minStaff: 2, maxStaff: 4 },

      // Mercoledì
      { dayOfWeek: 3, shiftType: 'PRANZO', role: 'CUCINA', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 3, shiftType: 'PRANZO', role: 'FATTORINO', minStaff: 1, maxStaff: 2 },
      { dayOfWeek: 3, shiftType: 'PRANZO', role: 'SALA', minStaff: 1, maxStaff: 3 },
      { dayOfWeek: 3, shiftType: 'CENA', role: 'CUCINA', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 3, shiftType: 'CENA', role: 'FATTORINO', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 3, shiftType: 'CENA', role: 'SALA', minStaff: 2, maxStaff: 4 },

      // Giovedì
      { dayOfWeek: 4, shiftType: 'PRANZO', role: 'CUCINA', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 4, shiftType: 'PRANZO', role: 'FATTORINO', minStaff: 1, maxStaff: 2 },
      { dayOfWeek: 4, shiftType: 'PRANZO', role: 'SALA', minStaff: 1, maxStaff: 3 },
      { dayOfWeek: 4, shiftType: 'CENA', role: 'CUCINA', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 4, shiftType: 'CENA', role: 'FATTORINO', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 4, shiftType: 'CENA', role: 'SALA', minStaff: 2, maxStaff: 4 },

      // Venerdì
      { dayOfWeek: 5, shiftType: 'PRANZO', role: 'CUCINA', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 5, shiftType: 'PRANZO', role: 'FATTORINO', minStaff: 1, maxStaff: 2 },
      { dayOfWeek: 5, shiftType: 'PRANZO', role: 'SALA', minStaff: 1, maxStaff: 3 },
      { dayOfWeek: 5, shiftType: 'CENA', role: 'CUCINA', minStaff: 4, maxStaff: 6 },
      { dayOfWeek: 5, shiftType: 'CENA', role: 'FATTORINO', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 5, shiftType: 'CENA', role: 'SALA', minStaff: 3, maxStaff: 5 },

      // Sabato
      { dayOfWeek: 6, shiftType: 'PRANZO', role: 'CUCINA', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 6, shiftType: 'PRANZO', role: 'FATTORINO', minStaff: 2, maxStaff: 3 },
      { dayOfWeek: 6, shiftType: 'PRANZO', role: 'SALA', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 6, shiftType: 'CENA', role: 'CUCINA', minStaff: 4, maxStaff: 6 },
      { dayOfWeek: 6, shiftType: 'CENA', role: 'FATTORINO', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 6, shiftType: 'CENA', role: 'SALA', minStaff: 3, maxStaff: 5 },

      // Domenica
      { dayOfWeek: 0, shiftType: 'PRANZO', role: 'CUCINA', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 0, shiftType: 'PRANZO', role: 'FATTORINO', minStaff: 2, maxStaff: 3 },
      { dayOfWeek: 0, shiftType: 'PRANZO', role: 'SALA', minStaff: 2, maxStaff: 4 },
      { dayOfWeek: 0, shiftType: 'CENA', role: 'CUCINA', minStaff: 4, maxStaff: 6 },
      { dayOfWeek: 0, shiftType: 'CENA', role: 'FATTORINO', minStaff: 3, maxStaff: 5 },
      { dayOfWeek: 0, shiftType: 'CENA', role: 'SALA', minStaff: 3, maxStaff: 5 },
    ]

    for (const limit of defaultLimits) {
      await prisma.shift_limits.create({
        data: {
          dayOfWeek: limit.dayOfWeek,
          shiftType: limit.shiftType as any,
          role: limit.role as any,
          minStaff: limit.minStaff,
          maxStaff: limit.maxStaff
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
