import { prisma } from '../src/lib/prisma'

async function checkMondayLimits() {
  console.log('🔍 CONTROLLO LIMITI LUNEDÌ')
  console.log('========================')
  
  // Check Monday limits (should be dayOfWeek = 0 in our system)
  const mondayLimits = await prisma.shiftLimit.findMany({
    where: {
      dayOfWeek: 0
    },
    orderBy: [
      { shiftType: 'asc' },
      { role: 'asc' }
    ]
  })
  
  console.log('\n📊 Limiti per Lunedì (dayOfWeek = 0):')
  mondayLimits.forEach(limit => {
    console.log(`${limit.shiftType} - ${limit.role}: ${limit.maxCount}`)
  })
  
  // Check Fattorino specifically
  const fattorinoLimits = mondayLimits.filter(l => l.role === 'FATTORINO')
  console.log('\n🚚 Limiti FATTORINO per Lunedì:')
  fattorinoLimits.forEach(limit => {
    console.log(`${limit.shiftType}: ${limit.maxCount}`)
  })
  
  // Check if there are any Sunday limits (dayOfWeek = 6)
  const sundayLimits = await prisma.shiftLimit.findMany({
    where: {
      dayOfWeek: 6
    }
  })
  
  console.log('\n📅 Limiti per Domenica (dayOfWeek = 6):')
  console.log(`Trovati ${sundayLimits.length} limiti per domenica`)
  
  // Check what we have for "missing" days
  const allDays = [0, 1, 2, 3, 4, 5, 6]
  for (const day of allDays) {
    const count = await prisma.shiftLimit.count({
      where: { dayOfWeek: day }
    })
    const dayName = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'][day]
    console.log(`${dayName} (${day}): ${count} limiti`)
  }
  
  await prisma.$disconnect()
}

checkMondayLimits().catch(console.error)
