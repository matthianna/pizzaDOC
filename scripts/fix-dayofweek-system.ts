import { prisma } from '../src/lib/prisma'

/**
 * Script per convertire tutto il sistema da JavaScript dayOfWeek (0=Sunday) 
 * al nostro sistema (0=Monday)
 * 
 * Conversione:
 * JS -> Our
 * 0 (Sunday) -> 6
 * 1 (Monday) -> 0
 * 2 (Tuesday) -> 1
 * 3 (Wednesday) -> 2
 * 4 (Thursday) -> 3
 * 5 (Friday) -> 4
 * 6 (Saturday) -> 5
 */

function convertJsToOurDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

async function fixDayOfWeekSystem() {
  console.log('🔧 SISTEMAZIONE SISTEMA DAYOFWEEK')
  console.log('Convertendo da JavaScript format (0=Sunday) a 0=Monday')
  console.log('=====================================')

  try {
    // 1. Fix ShiftLimits
    console.log('📊 Sistemando ShiftLimits...')
    const shiftLimits = await prisma.shiftLimits.findMany()
    
    for (const limit of shiftLimits) {
      const newDayOfWeek = convertJsToOurDay(limit.dayOfWeek)
      console.log(`  ShiftLimit: ${limit.dayOfWeek} -> ${newDayOfWeek} (${limit.role} ${limit.shiftType})`)
      
      await prisma.shiftLimits.update({
        where: { id: limit.id },
        data: { dayOfWeek: newDayOfWeek }
      })
    }

    // 2. Fix ShiftStartTimeDistribution  
    console.log('⏰ Sistemando ShiftStartTimeDistribution...')
    const distributions = await prisma.shiftStartTimeDistribution.findMany()
    
    for (const dist of distributions) {
      const newDayOfWeek = convertJsToOurDay(dist.dayOfWeek || 0)
      console.log(`  Distribution: ${dist.dayOfWeek} -> ${newDayOfWeek} (${dist.role} ${dist.shiftType})`)
      
      await prisma.shiftStartTimeDistribution.update({
        where: { id: dist.id },
        data: { dayOfWeek: newDayOfWeek }
      })
    }

    // 3. Fix Availabilities
    console.log('📅 Sistemando Availabilities...')
    const availabilities = await prisma.availability.findMany()
    
    for (const avail of availabilities) {
      const newDayOfWeek = convertJsToOurDay(avail.dayOfWeek)
      console.log(`  Availability: ${avail.dayOfWeek} -> ${newDayOfWeek} (User ${avail.userId})`)
      
      await prisma.availability.update({
        where: { id: avail.id },
        data: { dayOfWeek: newDayOfWeek }
      })
    }

    // 4. Fix Shifts
    console.log('🔄 Sistemando Shifts...')
    const shifts = await prisma.shift.findMany()
    
    for (const shift of shifts) {
      const newDayOfWeek = convertJsToOurDay(shift.dayOfWeek)
      console.log(`  Shift: ${shift.dayOfWeek} -> ${newDayOfWeek} (${shift.role} ${shift.shiftType})`)
      
      await prisma.shift.update({
        where: { id: shift.id },
        data: { dayOfWeek: newDayOfWeek }
      })
    }

    console.log('')
    console.log('✅ SISTEMAZIONE COMPLETATA!')
    console.log('Ora tutto il sistema usa: 0=Monday, 1=Tuesday, ..., 6=Sunday')
    
  } catch (error) {
    console.error('❌ Errore durante la sistemazione:', error)
    throw error
  }
}

// Esegui lo script
fixDayOfWeekSystem()
  .then(() => {
    console.log('🎉 Sistema dayOfWeek completamente sistemato!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Errore fatale:', error)
    process.exit(1)
  })
