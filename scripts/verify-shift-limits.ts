import { prisma } from '../src/lib/prisma'

async function verifyShiftLimits() {
  console.log('🔍 VERIFICA LIMITI TURNI')
  console.log('======================')
  console.log('Sistema: 0=Lunedì, 6=Domenica')
  console.log('')

  const limits = await prisma.shiftLimits.findMany({
    orderBy: [
      { dayOfWeek: 'asc' },
      { shiftType: 'asc' },
      { role: 'asc' }
    ]
  })

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  
  for (let day = 0; day <= 6; day++) {
    console.log(`\n📅 ${days[day]} (dayOfWeek=${day}):`)
    const dayLimits = limits.filter(l => l.dayOfWeek === day)
    
    if (dayLimits.length === 0) {
      console.log('  ❌ NESSUN LIMITE CONFIGURATO!')
      continue
    }
    
    const shiftTypes = ['PRANZO', 'CENA'] as const
    shiftTypes.forEach(shiftType => {
      console.log(`\n  ${shiftType}:`)
      const shiftLimits = dayLimits.filter(l => l.shiftType === shiftType)
      
      shiftLimits.forEach(limit => {
        console.log(`    ${limit.role}: min=${limit.minStaff}, max=${limit.maxStaff}`)
      })
      
      // Check fattorini
      const fattorinoLimit = shiftLimits.find(l => l.role === 'FATTORINO')
      if (!fattorinoLimit) {
        console.log('    ❌ FATTORINO: NON CONFIGURATO!')
      } else if (fattorinoLimit.minStaff === 0) {
        console.log('    ⚠️  FATTORINO: min=0 (probabilmente sbagliato)')
      }
    })
  }
  
  await prisma.$disconnect()
}

verifyShiftLimits().catch(console.error)
