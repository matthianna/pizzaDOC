import { PrismaClient } from '@prisma/client'
import { addDays, startOfWeek, subWeeks, format } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Iniziando popolazione dati storici...')

  try {
    // Get all users (excluding admins)
    const users = await prisma.user.findMany({
      include: {
        userRoles: true,
        userTransports: true
      }
    })

    const nonAdminUsers = users.filter(user => 
      !user.userRoles.some(ur => ur.role === 'ADMIN')
    )

    console.log(`👥 Trovati ${nonAdminUsers.length} dipendenti`)

    // Generate data for the last 12 weeks
    const weeksToGenerate = 12
    const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 })

    for (let weekOffset = 1; weekOffset <= weeksToGenerate; weekOffset++) {
      const weekStart = subWeeks(currentWeek, weekOffset)
      console.log(`📅 Generando dati per settimana ${format(weekStart, 'dd/MM/yyyy')}...`)

      // Create or find schedule for this week
      let schedule = await prisma.schedule.findUnique({
        where: { weekStart: weekStart }
      })

      if (!schedule) {
        schedule = await prisma.schedule.create({
          data: {
            weekStart: weekStart
          }
        })
      }

      // Generate shifts for each user
      for (const user of nonAdminUsers) {
        const userRoles = user.userRoles.map(ur => ur.role)
        
        // Each user works 2-4 shifts per week randomly
        const shiftsThisWeek = Math.floor(Math.random() * 3) + 2 // 2-4 shifts
        const assignedDays = new Set<number>()

        for (let i = 0; i < shiftsThisWeek; i++) {
          // Random day (1-6, avoiding Sunday for most shifts)
          let dayOfWeek: number
          do {
            dayOfWeek = Math.floor(Math.random() * 6) + 1 // 1-6 (Mon-Sat)
          } while (assignedDays.has(dayOfWeek))
          
          assignedDays.add(dayOfWeek)

          // Random shift type
          const shiftTypes = ['PRANZO', 'CENA'] as const
          const shiftType = shiftTypes[Math.floor(Math.random() * shiftTypes.length)]

          // Random role from user's available roles
          const role = userRoles[Math.floor(Math.random() * userRoles.length)]

          // Set shift times
          const startTime = shiftType === 'PRANZO' ? '11:30' : '18:00'
          const endTime = shiftType === 'PRANZO' ? '14:00' : '22:00'

          // Create shift
          const shift = await prisma.shift.create({
            data: {
              scheduleId: schedule.id,
              userId: user.id,
              dayOfWeek,
              shiftType,
              role,
              startTime,
              endTime
            }
          })

          // Generate availability for this shift (80% chance available)
          if (Math.random() < 0.8) {
            await prisma.availability.upsert({
              where: {
                userId_weekStart_dayOfWeek_shiftType: {
                  userId: user.id,
                  weekStart: weekStart,
                  dayOfWeek,
                  shiftType
                }
              },
              update: {
                isAvailable: true
              },
              create: {
                userId: user.id,
                weekStart: weekStart,
                dayOfWeek,
                shiftType,
                isAvailable: true
              }
            })
          }

          // Generate worked hours for this shift (90% chance)
          if (Math.random() < 0.9) {
            // Add some random variation to worked hours
            const baseStartHour = shiftType === 'PRANZO' ? 11 : 18
            const baseStartMin = shiftType === 'PRANZO' ? 30 : 0
            const baseEndHour = shiftType === 'PRANZO' ? 14 : 22
            const baseEndMin = shiftType === 'PRANZO' ? 0 : 0

            // Add random variation (-15 to +15 minutes for start, -30 to +30 for end)
            const startVariation = Math.floor(Math.random() * 31) - 15 // -15 to +15
            const endVariation = Math.floor(Math.random() * 61) - 30 // -30 to +30

            const actualStartMin = Math.max(0, Math.min(59, baseStartMin + startVariation))
            const actualEndMin = Math.max(0, Math.min(59, baseEndMin + endVariation))

            const workedStartTime = `${baseStartHour}:${actualStartMin.toString().padStart(2, '0')}`
            const workedEndTime = `${baseEndHour}:${actualEndMin.toString().padStart(2, '0')}`

            // Calculate total hours
            const startMinutes = baseStartHour * 60 + actualStartMin
            const endMinutes = baseEndHour * 60 + actualEndMin
            const totalMinutes = endMinutes - startMinutes
            const totalHours = Math.round((totalMinutes / 60) * 2) / 2 // Round to nearest 0.5

            // Create worked hours with random submission date
            const shiftDate = addDays(weekStart, dayOfWeek === 0 ? 6 : dayOfWeek - 1)
            const submissionDate = new Date(shiftDate)
            submissionDate.setHours(submissionDate.getHours() + (shiftType === 'PRANZO' ? 15 : 23))
            submissionDate.setMinutes(Math.floor(Math.random() * 60))

            await prisma.workedHours.create({
              data: {
                shiftId: shift.id,
                userId: user.id,
                startTime: workedStartTime,
                endTime: workedEndTime,
                totalHours,
                status: 'APPROVED', // Most historical data is approved
                submittedAt: submissionDate
              }
            })
          }
        }
      }

      // Generate some substitutions (10% chance per week)
      if (Math.random() < 0.1) {
        const weekShifts = await prisma.shift.findMany({
          where: { scheduleId: schedule.id },
          include: { user: true }
        })

        if (weekShifts.length > 0) {
          const randomShift = weekShifts[Math.floor(Math.random() * weekShifts.length)]
          const otherUsers = nonAdminUsers.filter(u => u.id !== randomShift.userId)
          
          if (otherUsers.length > 0) {
            const substitute = otherUsers[Math.floor(Math.random() * otherUsers.length)]
            
            // Check if substitute can do the role
            const canDoRole = substitute.userRoles.some(ur => ur.role === randomShift.role)
            
            if (canDoRole) {
              const shiftDate = addDays(weekStart, randomShift.dayOfWeek === 0 ? 6 : randomShift.dayOfWeek - 1)
              const deadline = new Date(shiftDate)
              deadline.setHours(deadline.getHours() - 2)

              await prisma.substitution.create({
                data: {
                  shiftId: randomShift.id,
                  requesterId: randomShift.userId,
                  substituteId: substitute.id,
                  status: 'APPROVED',
                  requestNote: 'Richiesta di sostituzione storica generata automaticamente',
                  deadline,
                  approverId: users.find(u => u.userRoles.some(ur => ur.role === 'ADMIN'))?.id || randomShift.userId
                }
              })

              // Update the shift to assign it to the substitute
              await prisma.shift.update({
                where: { id: randomShift.id },
                data: { userId: substitute.id }
              })
            }
          }
        }
      }
    }

    // Generate some shift limits
    console.log('⚙️ Generando limiti turni...')
    const days = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun
    const shifts = ['PRANZO', 'CENA'] as const
    const roles = ['CUCINA', 'FATTORINO', 'SALA'] as const

    for (const day of days) {
      for (const shift of shifts) {
        for (const role of roles) {
          await prisma.shiftLimits.upsert({
            where: {
              dayOfWeek_shiftType_role: {
                dayOfWeek: day,
                shiftType: shift,
                role
              }
            },
            update: {},
            create: {
              dayOfWeek: day,
              shiftType: shift,
              role,
              minStaff: role === 'CUCINA' ? 1 : 2,
              maxStaff: role === 'CUCINA' ? 2 : 4
            }
          })
        }
      }
    }

    console.log('✅ Popolazione dati storici completata!')
    console.log(`📊 Generati dati per ${weeksToGenerate} settimane`)
    console.log('📈 Include: turni, disponibilità, ore lavorate, sostituzioni')

  } catch (error) {
    console.error('❌ Errore durante la popolazione:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
