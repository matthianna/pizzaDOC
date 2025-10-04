import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateShiftLimits() {
  console.log('🔧 Aggiornamento limiti personale per turno...')

  const detailedLimits = [
    // Lunedì (0)
    { dayOfWeek: 0, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 0, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 0, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 0, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 0, shiftType: 'CENA', role: 'FATTORINO', min: 5, max: 5 },
    { dayOfWeek: 0, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 0, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 0, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Martedì (1)
    { dayOfWeek: 1, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 1, shiftType: 'PRANZO', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'CENA', role: 'FATTORINO', min: 3, max: 3 },
    { dayOfWeek: 1, shiftType: 'CENA', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Mercoledì (2)
    { dayOfWeek: 2, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 2, shiftType: 'PRANZO', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'CENA', role: 'FATTORINO', min: 3, max: 3 },
    { dayOfWeek: 2, shiftType: 'CENA', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Giovedì (3)
    { dayOfWeek: 3, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 3, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 3, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 3, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 3, shiftType: 'CENA', role: 'FATTORINO', min: 4, max: 4 },
    { dayOfWeek: 3, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 3, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 3, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Venerdì (4)
    { dayOfWeek: 4, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 4, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 4, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 4, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 4, shiftType: 'CENA', role: 'FATTORINO', min: 4, max: 4 },
    { dayOfWeek: 4, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 4, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 4, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Sabato (5)
    { dayOfWeek: 5, shiftType: 'PRANZO', role: 'FATTORINO', min: 3, max: 3 },
    { dayOfWeek: 5, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 5, shiftType: 'PRANZO', role: 'SALA', min: 2, max: 2 },
    { dayOfWeek: 5, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 5, shiftType: 'CENA', role: 'FATTORINO', min: 5, max: 5 },
    { dayOfWeek: 5, shiftType: 'CENA', role: 'CUCINA', min: 3, max: 3 },
    { dayOfWeek: 5, shiftType: 'CENA', role: 'SALA', min: 2, max: 2 },
    { dayOfWeek: 5, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Domenica (6)
    { dayOfWeek: 6, shiftType: 'PRANZO', role: 'FATTORINO', min: 3, max: 3 },
    { dayOfWeek: 6, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 6, shiftType: 'PRANZO', role: 'SALA', min: 2, max: 2 },
    { dayOfWeek: 6, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 6, shiftType: 'CENA', role: 'FATTORINO', min: 4, max: 4 },
    { dayOfWeek: 6, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 6, shiftType: 'CENA', role: 'SALA', min: 2, max: 2 },
    { dayOfWeek: 6, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
  ]

  let updated = 0
  for (const limit of detailedLimits) {
    await prisma.shiftLimits.upsert({
      where: {
        dayOfWeek_shiftType_role: {
          dayOfWeek: limit.dayOfWeek,
          shiftType: limit.shiftType,
          role: limit.role
        }
      },
      update: {
        minStaff: limit.min,
        maxStaff: limit.max
      },
      create: {
        dayOfWeek: limit.dayOfWeek,
        shiftType: limit.shiftType,
        role: limit.role,
        minStaff: limit.min,
        maxStaff: limit.max
      }
    })
    updated++
  }

  console.log(`✅ ${updated} limiti aggiornati correttamente!`)
  
  // Verifica
  console.log('\n📋 Verifica limiti per giorno:')
  for (let day = 0; day <= 6; day++) {
    const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
    const limits = await prisma.shiftLimits.findMany({
      where: { dayOfWeek: day },
      orderBy: [{ shiftType: 'asc' }, { role: 'asc' }]
    })
    console.log(`\n${dayNames[day]}:`)
    limits.forEach(l => {
      console.log(`  ${l.shiftType} - ${l.role}: ${l.minStaff}-${l.maxStaff} persone`)
    })
  }
}

updateShiftLimits()
  .catch((e) => {
    console.error('❌ Errore:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

