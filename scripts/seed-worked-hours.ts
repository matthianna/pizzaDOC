import { PrismaClient } from '@prisma/client'
import { startOfWeek, format, addDays, subWeeks, addMinutes, setHours, setMinutes } from 'date-fns'
import { it } from 'date-fns/locale'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Iniziando seed ore lavorate per test storico...')

  // Trova turni esistenti nella settimana corrente
  const currentWeek = startOfWeek(new Date('2025-09-22'), { weekStartsOn: 1 })
  
  const schedule = await prisma.schedule.findUnique({
    where: { weekStart: currentWeek },
    include: {
      shifts: {
        include: {
          user: true
        }
      }
    }
  })

  if (!schedule) {
    console.log('❌ Nessun schedule trovato per la settimana corrente')
    return
  }

  console.log(`📅 Trovati ${schedule.shifts.length} turni per la settimana`)

  let hoursCreated = 0

  for (const shift of schedule.shifts) {
    try {
      // Crea ore lavorate simulate per ogni turno
      const baseStartTime = shift.startTime
      const baseEndTime = shift.endTime
      
      // Aggiungi piccole variazioni realistiche
      const variations = [
        { start: baseStartTime, end: baseEndTime }, // Orario esatto
        { start: baseStartTime, end: addMinutesToTime(baseEndTime, 15) }, // 15 min extra
        { start: addMinutesToTime(baseStartTime, -5), end: baseEndTime }, // 5 min prima
        { start: baseStartTime, end: addMinutesToTime(baseEndTime, 30) }, // 30 min extra
      ]
      
      const variation = variations[Math.floor(Math.random() * variations.length)]
      const totalHours = calculateHours(variation.start, variation.end)

      await prisma.workedHours.create({
        data: {
          shiftId: shift.id,
          userId: shift.userId,
          startTime: variation.start,
          endTime: variation.end,
          totalHours: totalHours,
          status: 'APPROVED', // Approvate per apparire nello storico
          submittedAt: new Date(), // Data di oggi
          reviewedAt: new Date()
        }
      })

      hoursCreated++
      console.log(`✅ ${shift.user.username} - ${getDayName(shift.dayOfWeek)} ${shift.shiftType}: ${totalHours}h`)
    } catch (error) {
      console.error(`❌ Errore per turno ${shift.id}:`, error)
    }
  }

  console.log(`\n📊 Riepilogo:`)
  console.log(`✅ Create ${hoursCreated} ore lavorate approvate`)
  console.log(`📅 Tutte le ore sono approvate e visibili nello storico`)
  console.log(`🎯 Vai a /hours e clicca "Storico Mensile" per vedere i dati!`)
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, mins + minutes, 0, 0)
  return format(date, 'HH:mm')
}

function calculateHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  const totalMinutes = endMinutes - startMinutes
  return Math.round((totalMinutes / 60) * 2) / 2 // Round to nearest 0.5
}

function getDayName(dayOfWeek: number): string {
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  return days[dayOfWeek]
}

main()
  .catch((e) => {
    console.error('❌ Errore durante il seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
