import { PrismaClient } from '@prisma/client'
import { addWeeks, startOfWeek } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Creando scenario test per disponibilità mancanti...')

  // Creo una settimana futura (next week + 1) per testare le disponibilità mancanti
  const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const testWeek = addWeeks(currentWeek, 2) // 2 settimane in futuro
  
  console.log(`📅 Settimana test: ${testWeek.toISOString()}`)

  // Ottieni alcuni dipendenti per creare disponibilità parziali
  const users = await prisma.user.findMany({
    where: {
      userRoles: {
        none: {
          role: 'ADMIN'
        }
      }
    },
    select: {
      id: true,
      username: true
    },
    take: 5 // Solo i primi 5
  })

  // Crea disponibilità solo per alcuni dipendenti (non tutti)
  for (let i = 0; i < 3; i++) { // Solo per i primi 3 su 5
    const user = users[i]
    console.log(`👤 Aggiungendo disponibilità per ${user.username}`)

    // Aggiungi qualche disponibilità
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) { // Lun-Ven
      for (const shiftType of ['PRANZO', 'CENA']) {
        await prisma.availability.upsert({
          where: {
            userId_weekStart_dayOfWeek_shiftType: {
              userId: user.id,
              weekStart: testWeek,
              dayOfWeek: dayOfWeek,
              shiftType: shiftType as any
            }
          },
          update: {
            isAvailable: Math.random() > 0.3 // 70% disponibile
          },
          create: {
            userId: user.id,
            weekStart: testWeek,
            dayOfWeek: dayOfWeek,
            shiftType: shiftType as any,
            isAvailable: Math.random() > 0.3
          }
        })
      }
    }
  }

  console.log(`✅ Scenario test creato!`)
  console.log(`📊 ${3} dipendenti hanno inserito disponibilità`)
  console.log(`📊 ${users.length - 3} dipendenti non hanno disponibilità`)
  console.log(`🎯 Vai alla settimana ${testWeek.toDateString()} per vedere l'alert`)
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
