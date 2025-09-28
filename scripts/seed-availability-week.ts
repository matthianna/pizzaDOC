import { PrismaClient } from '@prisma/client'
import { startOfWeek, format } from 'date-fns'
import { it } from 'date-fns/locale'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Iniziando seed disponibilità settimana 29 settembre 2025...')

  // Calcola la settimana che inizia lunedì 29 settembre 2025
  const targetDate = new Date('2025-09-29') // Lunedì 29 settembre 2025
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 }) // 1 = Lunedì
  
  console.log(`📅 Settimana: ${format(weekStart, 'dd/MM/yyyy', { locale: it })}`)

  // Ottieni tutti i dipendenti (non admin)
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
    }
  })

  console.log(`👥 Trovati ${users.length} dipendenti`)

  // Definizione disponibilità personalizzate per ogni dipendente
  const availabilityPatterns: Record<string, any> = {
    // Matthias - Fattorino disponibile tutti i giorni
    'Matthias': {
      0: { PRANZO: true, CENA: false },   // Domenica
      1: { PRANZO: true, CENA: true },    // Lunedì  
      2: { PRANZO: true, CENA: true },    // Martedì
      3: { PRANZO: true, CENA: false },   // Mercoledì
      4: { PRANZO: true, CENA: true },    // Giovedì
      5: { PRANZO: false, CENA: true },   // Venerdì
      6: { PRANZO: true, CENA: false }    // Sabato
    },
    
    // Yannick - Cucina/Fattorino/Sala molto disponibile
    'Yannick': {
      0: { PRANZO: false, CENA: true },   // Domenica
      1: { PRANZO: true, CENA: false },   // Lunedì
      2: { PRANZO: true, CENA: true },    // Martedì  
      3: { PRANZO: false, CENA: false },  // Mercoledì - Non disponibile
      4: { PRANZO: true, CENA: false },   // Giovedì
      5: { PRANZO: true, CENA: true },    // Venerdì
      6: { PRANZO: true, CENA: true }     // Sabato
    },

    // Alessio - Cucina principalmente
    'Alessio': {
      0: { PRANZO: false, CENA: false },  // Domenica - Non disponibile
      1: { PRANZO: false, CENA: false },  // Lunedì - Non disponibile
      2: { PRANZO: true, CENA: false },   // Martedì
      3: { PRANZO: true, CENA: false },   // Mercoledì
      4: { PRANZO: true, CENA: false },   // Giovedì  
      5: { PRANZO: true, CENA: true },    // Venerdì
      6: { PRANZO: true, CENA: false }    // Sabato
    },

    // Jacopo - Fattorino/Sala
    'Jacopo': {
      0: { PRANZO: false, CENA: false },  // Domenica - Non disponibile
      1: { PRANZO: true, CENA: false },   // Lunedì
      2: { PRANZO: false, CENA: true },   // Martedì
      3: { PRANZO: true, CENA: false },   // Mercoledì
      4: { PRANZO: false, CENA: true },   // Giovedì
      5: { PRANZO: true, CENA: false },   // Venerdì
      6: { PRANZO: false, CENA: true }    // Sabato
    },

    // Billone - Fattorino
    'Billone': {
      0: { PRANZO: true, CENA: false },   // Domenica
      1: { PRANZO: false, CENA: true },   // Lunedì
      2: { PRANZO: false, CENA: false },  // Martedì - Non disponibile
      3: { PRANZO: true, CENA: true },    // Mercoledì
      4: { PRANZO: false, CENA: true },   // Giovedì
      5: { PRANZO: false, CENA: false },  // Venerdì - Non disponibile
      6: { PRANZO: true, CENA: false }    // Sabato
    },

    // Nadina - Fattorino
    'Nadina': {
      0: { PRANZO: false, CENA: true },   // Domenica
      1: { PRANZO: true, CENA: false },   // Lunedì
      2: { PRANZO: true, CENA: true },    // Martedì
      3: { PRANZO: false, CENA: true },   // Mercoledì
      4: { PRANZO: true, CENA: false },   // Giovedì
      5: { PRANZO: true, CENA: true },    // Venerdì
      6: { PRANZO: false, CENA: false }   // Sabato - Non disponibile
    },

    // Brando - Fattorino
    'Brando': {
      0: { PRANZO: true, CENA: true },    // Domenica
      1: { PRANZO: false, CENA: false },  // Lunedì - Non disponibile
      2: { PRANZO: true, CENA: false },   // Martedì
      3: { PRANZO: false, CENA: true },   // Mercoledì
      4: { PRANZO: true, CENA: true },    // Giovedì
      5: { PRANZO: false, CENA: true },   // Venerdì
      6: { PRANZO: true, CENA: false }    // Sabato
    },

    // Alessietto - Fattorino/Sala
    'Alessietto': {
      0: { PRANZO: false, CENA: false },  // Domenica - Non disponibile
      1: { PRANZO: true, CENA: true },    // Lunedì
      2: { PRANZO: false, CENA: true },   // Martedì
      3: { PRANZO: true, CENA: false },   // Mercoledì
      4: { PRANZO: false, CENA: false },  // Giovedì - Non disponibile
      5: { PRANZO: true, CENA: true },    // Venerdì
      6: { PRANZO: true, CENA: true }     // Sabato
    },

    // Francesco - Fattorino
    'Francesco': {
      0: { PRANZO: true, CENA: false },   // Domenica
      1: { PRANZO: false, CENA: true },   // Lunedì
      2: { PRANZO: true, CENA: false },   // Martedì
      3: { PRANZO: false, CENA: false },  // Mercoledì - Non disponibile
      4: { PRANZO: true, CENA: true },    // Giovedì
      5: { PRANZO: false, CENA: true },   // Venerdì
      6: { PRANZO: true, CENA: false }    // Sabato
    },

    // Ioshua - Fattorino
    'Ioshua': {
      0: { PRANZO: false, CENA: true },   // Domenica
      1: { PRANZO: true, CENA: false },   // Lunedì
      2: { PRANZO: false, CENA: false },  // Martedì - Non disponibile
      3: { PRANZO: true, CENA: true },    // Mercoledì
      4: { PRANZO: false, CENA: true },   // Giovedì
      5: { PRANZO: true, CENA: false },   // Venerdì
      6: { PRANZO: false, CENA: true }    // Sabato
    },

    // Damiano - Fattorino
    'Damiano': {
      0: { PRANZO: true, CENA: false },   // Domenica
      1: { PRANZO: false, CENA: false },  // Lunedì - Non disponibile
      2: { PRANZO: true, CENA: true },    // Martedì
      3: { PRANZO: false, CENA: true },   // Mercoledì
      4: { PRANZO: true, CENA: false },   // Giovedì
      5: { PRANZO: false, CENA: true },   // Venerdì
      6: { PRANZO: true, CENA: true }     // Sabato
    },

    // Simone - Fattorino
    'Simone': {
      0: { PRANZO: false, CENA: false },  // Domenica - Non disponibile
      1: { PRANZO: true, CENA: true },    // Lunedì
      2: { PRANZO: false, CENA: true },   // Martedì
      3: { PRANZO: true, CENA: false },   // Mercoledì
      4: { PRANZO: false, CENA: true },   // Giovedì
      5: { PRANZO: true, CENA: false },   // Venerdì
      6: { PRANZO: false, CENA: false }   // Sabato - Non disponibile
    },

    // Simone2 - Fattorino
    'Simone2': {
      0: { PRANZO: true, CENA: true },    // Domenica
      1: { PRANZO: false, CENA: true },   // Lunedì
      2: { PRANZO: true, CENA: false },   // Martedì
      3: { PRANZO: false, CENA: false },  // Mercoledì - Non disponibile
      4: { PRANZO: true, CENA: true },    // Giovedì
      5: { PRANZO: false, CENA: false },  // Venerdì - Non disponibile
      6: { PRANZO: true, CENA: true }     // Sabato
    }
  }

  let totalCreated = 0

  // Genera disponibilità per ogni dipendente
  for (const user of users) {
    const userPattern = availabilityPatterns[user.username]
    
    if (!userPattern) {
      console.log(`⚠️ Nessun pattern definito per ${user.username}, using default`)
      // Pattern di default - disponibile 70% delle volte
      continue
    }

    console.log(`👤 Generando disponibilità per ${user.username}...`)

    // Per ogni giorno della settimana (0 = Domenica, 1 = Lunedì, etc.)
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const dayPattern = userPattern[dayOfWeek]

      // Per ogni turno (PRANZO, CENA)
      for (const [shiftType, isAvailable] of Object.entries(dayPattern)) {
        await prisma.availability.upsert({
          where: {
            userId_weekStart_dayOfWeek_shiftType: {
              userId: user.id,
              weekStart: weekStart,
              dayOfWeek: dayOfWeek,
              shiftType: shiftType as any
            }
          },
          update: {
            isAvailable: isAvailable as boolean
          },
          create: {
            userId: user.id,
            weekStart: weekStart,
            dayOfWeek: dayOfWeek,
            shiftType: shiftType as any,
            isAvailable: isAvailable as boolean
          }
        })

        totalCreated++
      }
    }
  }

  console.log(`✅ Creati/aggiornati ${totalCreated} record di disponibilità`)
  console.log(`📊 Settimana: ${format(weekStart, 'dd/MM/yyyy')} - ${format(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'dd/MM/yyyy', { locale: it })}`)
  
  // Statistiche finali
  const stats = await prisma.availability.groupBy({
    by: ['isAvailable'],
    where: {
      weekStart: weekStart
    },
    _count: {
      _all: true
    }
  })

  console.log('\n📈 Statistiche disponibilità:')
  stats.forEach(stat => {
    console.log(`${stat.isAvailable ? '✅ Disponibili' : '❌ Non disponibili'}: ${stat._count._all}`)
  })
}

main()
  .catch((e) => {
    console.error('❌ Errore durante il seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
