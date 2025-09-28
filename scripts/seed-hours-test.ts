import { PrismaClient } from '@prisma/client'
import { startOfWeek, format, addDays } from 'date-fns'
import { it } from 'date-fns/locale'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Iniziando seed per test ore lavorate...')

  // Calcola la settimana corrente (22-28 settembre 2025)
  const currentDate = new Date('2025-09-22') // Lunedì 22 settembre 2025
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  
  console.log(`📅 Settimana: ${format(weekStart, 'dd/MM/yyyy', { locale: it })} - ${format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: it })}`)

  // Ottieni alcuni dipendenti per creare turni
  const users = await prisma.user.findMany({
    where: {
      userRoles: {
        none: {
          role: 'ADMIN'
        }
      }
    },
    include: {
      userRoles: {
        select: {
          role: true
        }
      }
    },
    take: 8 // Prendi 8 dipendenti per avere un buon mix
  })

  console.log(`👥 Trovati ${users.length} dipendenti per i turni`)

  // Crea o trova lo schedule per questa settimana
  let schedule = await prisma.schedule.findUnique({
    where: { weekStart: weekStart }
  })

  if (!schedule) {
    schedule = await prisma.schedule.create({
      data: {
        weekStart: weekStart
      }
    })
    console.log(`📋 Creato nuovo schedule per la settimana`)
  } else {
    console.log(`📋 Trovato schedule esistente per la settimana`)
  }

  // Pattern di turni realistici per test
  const shiftPatterns = [
    // Lunedì (dayOfWeek = 1)
    { userId: users[0]?.id, dayOfWeek: 1, shiftType: 'PRANZO', role: 'CUCINA', startTime: '11:30', endTime: '14:00' },
    { userId: users[1]?.id, dayOfWeek: 1, shiftType: 'PRANZO', role: 'FATTORINO', startTime: '11:30', endTime: '14:00' },
    { userId: users[2]?.id, dayOfWeek: 1, shiftType: 'CENA', role: 'SALA', startTime: '18:00', endTime: '22:00' },
    
    // Martedì (dayOfWeek = 2)
    { userId: users[1]?.id, dayOfWeek: 2, shiftType: 'PRANZO', role: 'CUCINA', startTime: '11:30', endTime: '14:00' },
    { userId: users[2]?.id, dayOfWeek: 2, shiftType: 'PRANZO', role: 'FATTORINO', startTime: '11:30', endTime: '14:00' },
    { userId: users[0]?.id, dayOfWeek: 2, shiftType: 'CENA', role: 'CUCINA', startTime: '18:00', endTime: '22:00' },
    { userId: users[3]?.id, dayOfWeek: 2, shiftType: 'CENA', role: 'FATTORINO', startTime: '18:00', endTime: '22:00' },
    
    // Mercoledì (dayOfWeek = 3)
    { userId: users[4]?.id, dayOfWeek: 3, shiftType: 'PRANZO', role: 'SALA', startTime: '11:30', endTime: '14:00' },
    { userId: users[3]?.id, dayOfWeek: 3, shiftType: 'CENA', role: 'FATTORINO', startTime: '18:00', endTime: '22:00' },
    
    // Giovedì (dayOfWeek = 4)
    { userId: users[0]?.id, dayOfWeek: 4, shiftType: 'PRANZO', role: 'CUCINA', startTime: '11:30', endTime: '14:00' },
    { userId: users[5]?.id, dayOfWeek: 4, shiftType: 'PRANZO', role: 'FATTORINO', startTime: '11:30', endTime: '14:00' },
    { userId: users[1]?.id, dayOfWeek: 4, shiftType: 'CENA', role: 'SALA', startTime: '18:00', endTime: '22:00' },
    { userId: users[4]?.id, dayOfWeek: 4, shiftType: 'CENA', role: 'FATTORINO', startTime: '18:00', endTime: '22:00' },
    
    // Venerdì (dayOfWeek = 5)
    { userId: users[2]?.id, dayOfWeek: 5, shiftType: 'PRANZO', role: 'CUCINA', startTime: '11:30', endTime: '14:00' },
    { userId: users[6]?.id, dayOfWeek: 5, shiftType: 'PRANZO', role: 'FATTORINO', startTime: '11:30', endTime: '14:00' },
    { userId: users[0]?.id, dayOfWeek: 5, shiftType: 'CENA', role: 'CUCINA', startTime: '18:00', endTime: '22:00' },
    { userId: users[3]?.id, dayOfWeek: 5, shiftType: 'CENA', role: 'SALA', startTime: '18:00', endTime: '22:00' },
    { userId: users[5]?.id, dayOfWeek: 5, shiftType: 'CENA', role: 'FATTORINO', startTime: '18:00', endTime: '22:00' },
    
    // Sabato (dayOfWeek = 6)
    { userId: users[1]?.id, dayOfWeek: 6, shiftType: 'PRANZO', role: 'CUCINA', startTime: '11:30', endTime: '14:00' },
    { userId: users[7]?.id, dayOfWeek: 6, shiftType: 'PRANZO', role: 'FATTORINO', startTime: '11:30', endTime: '14:00' },
    { userId: users[4]?.id, dayOfWeek: 6, shiftType: 'PRANZO', role: 'SALA', startTime: '11:30', endTime: '14:00' },
    { userId: users[2]?.id, dayOfWeek: 6, shiftType: 'CENA', role: 'CUCINA', startTime: '18:00', endTime: '22:00' },
    { userId: users[6]?.id, dayOfWeek: 6, shiftType: 'CENA', role: 'FATTORINO', startTime: '18:00', endTime: '22:00' },
    { userId: users[0]?.id, dayOfWeek: 6, shiftType: 'CENA', role: 'SALA', startTime: '18:00', endTime: '22:00' },
    
    // Domenica (dayOfWeek = 0)
    { userId: users[3]?.id, dayOfWeek: 0, shiftType: 'CENA', role: 'CUCINA', startTime: '18:00', endTime: '22:00' },
    { userId: users[7]?.id, dayOfWeek: 0, shiftType: 'CENA', role: 'FATTORINO', startTime: '18:00', endTime: '22:00' }
  ]

  let shiftsCreated = 0

  for (const pattern of shiftPatterns) {
    if (!pattern.userId) continue // Skip se l'utente non esiste

    try {
      const shift = await prisma.shift.create({
        data: {
          scheduleId: schedule.id,
          userId: pattern.userId,
          dayOfWeek: pattern.dayOfWeek,
          shiftType: pattern.shiftType as any,
          role: pattern.role as any,
          startTime: pattern.startTime,
          endTime: pattern.endTime
        }
      })

      shiftsCreated++
      
      const user = users.find(u => u.id === pattern.userId)
      const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
      
      console.log(`✅ ${dayNames[pattern.dayOfWeek]} ${pattern.shiftType} - ${user?.username} (${pattern.role})`)
    } catch (error) {
      console.error(`❌ Errore creando turno per ${pattern.userId}:`, error)
    }
  }

  console.log(`\n📊 Riepilogo:`)
  console.log(`✅ Creati ${shiftsCreated} turni`)
  console.log(`📅 Settimana: ${format(weekStart, 'dd/MM/yyyy')} - ${format(addDays(weekStart, 6), 'dd/MM/yyyy')}`)
  
  // Statistiche per giorni
  const shiftsByDay = await prisma.shift.groupBy({
    by: ['dayOfWeek'],
    where: {
      scheduleId: schedule.id
    },
    _count: {
      _all: true
    },
    orderBy: {
      dayOfWeek: 'asc'
    }
  })

  console.log(`\n📈 Turni per giorno:`)
  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  shiftsByDay.forEach(day => {
    console.log(`${dayNames[day.dayOfWeek]}: ${day._count._all} turni`)
  })

  console.log(`\n🎯 Ora puoi testare l'inserimento ore in /hours`)
  console.log(`👤 Fai login come uno dei dipendenti e inserisci le ore per i turni assegnati`)
}

main()
  .catch((e) => {
    console.error('❌ Errore durante il seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
