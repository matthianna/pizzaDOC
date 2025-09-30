import { prisma } from '../src/lib/prisma'

async function fixMondayLimits() {
  console.log('🔧 CORREZIONE LIMITI LUNEDÌ')
  console.log('==========================')
  
  // Check current limits for Monday (should be dayOfWeek = 0)
  const mondayLimits = await prisma.shiftLimit.findMany({
    where: {
      dayOfWeek: 0
    }
  })
  
  console.log(`📊 Limiti attuali per Lunedì (dayOfWeek=0): ${mondayLimits.length}`)
  
  const fattorinoMondayLimits = mondayLimits.filter(l => l.role === 'FATTORINO')
  console.log('🚚 Limiti FATTORINO per Lunedì:')
  fattorinoMondayLimits.forEach(limit => {
    console.log(`  ${limit.shiftType}: min=${limit.minStaff}, max=${limit.maxStaff}`)
  })
  
  // Check if there are any wrong entries
  const allLimits = await prisma.shiftLimit.findMany({
    orderBy: [
      { dayOfWeek: 'asc' },
      { shiftType: 'asc' },
      { role: 'asc' }
    ]
  })
  
  console.log('\n📋 VERIFICA COMPLETA LIMITI:')
  const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  
  for (let day = 0; day < 7; day++) {
    const dayLimits = allLimits.filter(l => l.dayOfWeek === day)
    const fattorinoLimits = dayLimits.filter(l => l.role === 'FATTORINO')
    
    console.log(`\n${dayNames[day]} (${day}):`)
    if (fattorinoLimits.length > 0) {
      fattorinoLimits.forEach(limit => {
        console.log(`  FATTORINO ${limit.shiftType}: min=${limit.minStaff}, max=${limit.maxStaff}`)
      })
    } else {
      console.log('  ❌ Nessun limite FATTORINO trovato!')
    }
  }
  
  // Ensure Monday has correct FATTORINO limits
  const mondayFattorinoLunch = await prisma.shiftLimit.findFirst({
    where: {
      dayOfWeek: 0,
      shiftType: 'PRANZO',
      role: 'FATTORINO'
    }
  })
  
  const mondayFattorinoDinner = await prisma.shiftLimit.findFirst({
    where: {
      dayOfWeek: 0,
      shiftType: 'CENA',
      role: 'FATTORINO'
    }
  })
  
  console.log('\n🎯 CONTROLLO SPECIFICO LUNEDÌ FATTORINO:')
  console.log(`Pranzo: ${mondayFattorinoLunch ? `min=${mondayFattorinoLunch.minStaff}, max=${mondayFattorinoLunch.maxStaff}` : 'MANCANTE'}`)
  console.log(`Cena: ${mondayFattorinoDinner ? `min=${mondayFattorinoDinner.minStaff}, max=${mondayFattorinoDinner.maxStaff}` : 'MANCANTE'}`)
  
  // If limits are missing or wrong, we need to identify the issue
  if (!mondayFattorinoLunch || !mondayFattorinoDinner) {
    console.log('\n❌ PROBLEMA IDENTIFICATO: Limiti FATTORINO mancanti per Lunedì!')
    
    // Check if there are limits for Sunday (dayOfWeek = 6) instead
    const sundayLimits = await prisma.shiftLimit.findMany({
      where: {
        dayOfWeek: 6,
        role: 'FATTORINO'
      }
    })
    
    if (sundayLimits.length > 0) {
      console.log('🔍 Trovati limiti per Domenica (potrebbero essere quelli sbagliati):')
      sundayLimits.forEach(limit => {
        console.log(`  ${limit.shiftType}: min=${limit.minStaff}, max=${limit.maxStaff}`)
      })
    }
  }
  
  await prisma.$disconnect()
}

fixMondayLimits().catch(console.error)
