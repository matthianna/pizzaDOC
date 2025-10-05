#!/usr/bin/env tsx

/**
 * Script per verificare e correggere i valori dayOfWeek nel database
 * 
 * Il sistema corretto usa: 0=Lunedì, 1=Martedì, ..., 6=Domenica
 * 
 * Questo script:
 * 1. Verifica i valori attuali nel database
 * 2. Rileva se i dati sono stati salvati con la conversione sbagliata
 * 3. Corregge i valori se necessario
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyAndFixDayOfWeek() {
  console.log('🔍 VERIFICA E CORREZIONE SISTEMA DAYOFWEEK')
  console.log('==========================================')
  console.log('Sistema corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica')
  console.log('')

  try {
    // 1. Verifica ShiftLimits
    console.log('📊 Verifica ShiftLimits...')
    const shiftLimits = await prisma.shiftLimits.findMany({
      orderBy: [
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' },
        { role: 'asc' }
      ]
    })
    
    console.log(`Trovati ${shiftLimits.length} shift limits`)
    
    // Raggruppa per dayOfWeek per vedere la distribuzione
    const dayGroups = shiftLimits.reduce((acc, limit) => {
      if (!acc[limit.dayOfWeek]) acc[limit.dayOfWeek] = []
      acc[limit.dayOfWeek].push(limit)
      return acc
    }, {} as Record<number, typeof shiftLimits>)
    
    console.log('\nDistribuzione per dayOfWeek:')
    Object.keys(dayGroups).sort().forEach(day => {
      const dayNum = parseInt(day)
      const dayName = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'][dayNum]
      console.log(`  dayOfWeek ${day} (dovrebbe essere ${dayName}): ${dayGroups[dayNum].length} configurazioni`)
    })
    
    // Mostra alcuni esempi
    console.log('\nEsempi di configurazioni:')
    const daysToShow = [0, 1, 6] // Lunedì, Martedì, Domenica
    daysToShow.forEach(day => {
      const dayName = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'][day]
      console.log(`\n  ${dayName} (dayOfWeek=${day}):`)
      const limitsForDay = shiftLimits.filter(l => l.dayOfWeek === day).slice(0, 4)
      limitsForDay.forEach(l => {
        console.log(`    - ${l.shiftType} ${l.role}: min=${l.minStaff}, max=${l.maxStaff}`)
      })
    })
    
    // 2. Rileva se i dati sono sbagliati
    console.log('\n\n🔍 ANALISI: I dati sono corretti?')
    console.log('=====================================')
    
    // Cerca configurazioni specifiche che sappiamo dovrebbero esistere
    const mondayLunchSala = shiftLimits.find(l => 
      l.dayOfWeek === 0 && l.shiftType === 'PRANZO' && l.role === 'SALA'
    )
    
    const tuesdayLunchSala = shiftLimits.find(l => 
      l.dayOfWeek === 1 && l.shiftType === 'PRANZO' && l.role === 'SALA'
    )
    
    console.log(`\nLunedì (0) PRANZO SALA: ${mondayLunchSala ? `min=${mondayLunchSala.minStaff}, max=${mondayLunchSala.maxStaff}` : 'NON TROVATO'}`)
    console.log(`Martedì (1) PRANZO SALA: ${tuesdayLunchSala ? `min=${tuesdayLunchSala.minStaff}, max=${tuesdayLunchSala.maxStaff}` : 'NON TROVATO'}`)
    
    // Secondo setup-database.ts, dovremmo avere:
    // Lunedì (0) PRANZO SALA: min=1, max=1
    // Martedì (1) PRANZO SALA: min=0, max=0
    
    console.log('\nSecondo setup-database.ts, dovrebbe essere:')
    console.log('Lunedì (0) PRANZO SALA: min=1, max=1')
    console.log('Martedì (1) PRANZO SALA: min=0, max=0')
    
    const needsFix = mondayLunchSala?.minStaff === 0 || tuesdayLunchSala?.minStaff === 1
    
    if (needsFix) {
      console.log('\n❌ I DATI SONO SBAGLIATI!')
      console.log('I valori sono stati salvati con la conversione errata.')
      console.log('\n🔧 Procedo con la correzione...')
      
      // Correggi i dati usando la conversione inversa
      // Se i dati sono stati salvati con la conversione sbagliata (arrayIndex === 6 ? 0 : arrayIndex + 1)
      // Dobbiamo applicare la conversione inversa
      
      for (const limit of shiftLimits) {
        const oldDay = limit.dayOfWeek
        let newDay: number
        
        // Conversione inversa: se era stato salvato con (arrayIndex === 6 ? 0 : arrayIndex + 1)
        // dobbiamo fare: (dbDay === 0 ? 6 : dbDay - 1)
        if (oldDay === 0) {
          newDay = 6 // Domenica
        } else {
          newDay = oldDay - 1
        }
        
        await prisma.shiftLimits.update({
          where: { id: limit.id },
          data: { dayOfWeek: newDay }
        })
        
        console.log(`  ✓ ${limit.role} ${limit.shiftType}: ${oldDay} → ${newDay}`)
      }
      
      console.log('\n✅ CORREZIONE COMPLETATA!')
      
    } else {
      console.log('\n✅ I DATI SONO CORRETTI!')
      console.log('Nessuna correzione necessaria.')
    }
    
    // 3. Verifica disponibilità e shifts se esistono
    const availabilityCount = await prisma.availability.count()
    const shiftCount = await prisma.shift.count()
    
    console.log(`\n📅 Trovate ${availabilityCount} disponibilità`)
    console.log(`📅 Trovati ${shiftCount} turni assegnati`)
    
    if (needsFix && (availabilityCount > 0 || shiftCount > 0)) {
      console.log('\n⚠️  ATTENZIONE: Hai anche disponibilità e/o turni nel database.')
      console.log('Questi potrebbero anche necessitare di correzione.')
      console.log('Ti consiglio di eliminarli e farli ricreare dall\'interfaccia.')
    }
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error)
    throw error
  }
}

// Esegui lo script
verifyAndFixDayOfWeek()
  .then(() => {
    console.log('\n✅ Script completato!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Errore fatale:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

