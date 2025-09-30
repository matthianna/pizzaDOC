import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugMondayIssue() {
  console.log('🔍 DEBUG PROBLEMA LUNEDÌ')
  console.log('========================')
  
  try {
    // 1. Check all shift limits
    console.log('\n📊 1. TUTTI I LIMITI NEL DATABASE:')
    const allLimits = await prisma.shiftLimit.findMany({
      orderBy: [
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' },
        { role: 'asc' }
      ]
    })
    
    console.log(`Totale limiti trovati: ${allLimits.length}`)
    
    // Group by day
    const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
    
    for (let day = 0; day < 7; day++) {
      const dayLimits = allLimits.filter(l => l.dayOfWeek === day)
      console.log(`\n${dayNames[day]} (dayOfWeek=${day}): ${dayLimits.length} limiti`)
      
      dayLimits.forEach(limit => {
        console.log(`  ${limit.role} ${limit.shiftType}: min=${limit.minStaff}, max=${limit.maxStaff}`)
      })
    }
    
    // 2. Focus on Monday FATTORINO
    console.log('\n🚚 2. FOCUS LUNEDÌ FATTORINO:')
    const mondayFattorino = allLimits.filter(l => l.dayOfWeek === 0 && l.role === 'FATTORINO')
    
    if (mondayFattorino.length === 0) {
      console.log('❌ NESSUN LIMITE FATTORINO per Lunedì!')
    } else {
      mondayFattorino.forEach(limit => {
        console.log(`✅ ${limit.shiftType}: min=${limit.minStaff}, max=${limit.maxStaff}`)
      })
    }
    
    // 3. Check current schedule for this week
    console.log('\n📅 3. SCHEDULE CORRENTE:')
    const currentSchedule = await prisma.schedule.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        shifts: {
          where: {
            dayOfWeek: 0, // Monday
            role: 'FATTORINO'
          }
        }
      }
    })
    
    if (currentSchedule) {
      console.log(`Schedule per settimana: ${currentSchedule.weekStart.toISOString().split('T')[0]}`)
      console.log(`Fattorini assegnati per Lunedì: ${currentSchedule.shifts.length}`)
      
      const pranzoCena = {
        PRANZO: currentSchedule.shifts.filter(s => s.shiftType === 'PRANZO').length,
        CENA: currentSchedule.shifts.filter(s => s.shiftType === 'CENA').length
      }
      
      console.log(`  PRANZO: ${pranzoCena.PRANZO} fattorini`)
      console.log(`  CENA: ${pranzoCena.CENA} fattorini`)
      
      // Compare with limits
      const mondayPranzoLimit = mondayFattorino.find(l => l.shiftType === 'PRANZO')
      const mondayCenaLimit = mondayFattorino.find(l => l.shiftType === 'CENA')
      
      console.log('\n📊 CONFRONTO LIMITI VS ASSEGNATI:')
      if (mondayPranzoLimit) {
        const missing = Math.max(0, mondayPranzoLimit.minStaff - pranzoCena.PRANZO)
        console.log(`  PRANZO: Richiesti ${mondayPranzoLimit.minStaff}, Assegnati ${pranzoCena.PRANZO}, Mancano ${missing}`)
      }
      if (mondayCenaLimit) {
        const missing = Math.max(0, mondayCenaLimit.minStaff - pranzoCena.CENA)
        console.log(`  CENA: Richiesti ${mondayCenaLimit.minStaff}, Assegnati ${pranzoCena.CENA}, Mancano ${missing}`)
      }
    } else {
      console.log('❌ Nessun schedule trovato!')
    }
    
    // 4. Check if there are any Sunday entries that should be Monday
    console.log('\n🔍 4. VERIFICA DOMENICA (possibile confusione):')
    const sundayLimits = allLimits.filter(l => l.dayOfWeek === 6)
    console.log(`Limiti per Domenica: ${sundayLimits.length}`)
    
    if (sundayLimits.length > 0) {
      sundayLimits.forEach(limit => {
        console.log(`  ${limit.role} ${limit.shiftType}: min=${limit.minStaff}, max=${limit.maxStaff}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Errore durante il debug:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugMondayIssue()
