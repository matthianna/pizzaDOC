#!/usr/bin/env tsx

/**
 * GENERATORE DISPONIBILITÀ SETTIMANALE
 * 
 * Questo script genera la disponibilità per tutti gli utenti attivi
 * per una settimana specifica. Ogni utente sarà disponibile per 
 * tutti i turni (pranzo e cena) di tutti i giorni.
 * 
 * CONFIGURAZIONE:
 * Modifica la variabile WEEK_START_DATE per cambiare la settimana
 * 
 * Uso: npm run generate:availability
 */

import { PrismaClient } from '@prisma/client'
import { startOfWeek, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { addWeekCalendarDays, formatDate } from '../src/lib/date-utils'
import { normalizeDate } from '../src/lib/normalize-date'

const prisma = new PrismaClient()

// ================================
// ⚠️  CONFIGURAZIONE SETTIMANA
// ================================
// Modifica questa data per cambiare la settimana target
// La data deve essere un LUNEDÌ (inizio settimana)
const WEEK_START_DATE = new Date('2025-01-06') // 6 Gennaio 2025 (Lunedì)

// Opzioni aggiuntive
const CLEAR_EXISTING = true // Elimina disponibilità esistenti per la settimana
const VERBOSE_LOGGING = true // Log dettagliato per ogni utente

// ================================
// FUNZIONI HELPER
// ================================

function getNextWeekStart(fromDate = new Date()): Date {
  // Ottiene il lunedì della settimana specificata
  const weekStart = startOfWeek(fromDate, { weekStartsOn: 1 }) // 1 = Lunedì
  return weekStart
}

function getWeekDays(weekStart: Date): Array<{ dayOfWeek: number; date: Date; name: string }> {
  const days = []
  const ws = normalizeDate(weekStart)

  for (let i = 0; i < 7; i++) {
    const date = addWeekCalendarDays(ws, i)
    const jsDay = date.getUTCDay()
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1 // Our system: 0=Monday, 6=Sunday
    const name = format(date, 'EEEE', { locale: it })
    
    days.push({
      dayOfWeek,
      date,
      name
    })
  }
  
  return days
}

// ================================
// FUNZIONI PRINCIPALI
// ================================

async function clearExistingAvailability(weekStart: Date) {
  if (!CLEAR_EXISTING) return
  
  console.log('🧹 Eliminazione disponibilità esistenti...')
  
  const deleted = await prisma.availability.deleteMany({
    where: {
      weekStart: weekStart
    }
  })
  
  console.log(`✅ Eliminate ${deleted.count} disponibilità esistenti`)
}

async function generateUserAvailability(userId: string, username: string, weekStart: Date) {
  const weekDays = getWeekDays(weekStart)
  const shiftTypes = ['PRANZO', 'CENA']
  let createdCount = 0
  
  if (VERBOSE_LOGGING) {
    console.log(`   👤 ${username}:`)
  }
  
  for (const day of weekDays) {
    for (const shiftType of shiftTypes) {
      try {
        await prisma.availability.create({
          data: {
            userId: userId,
            weekStart: weekStart,
            dayOfWeek: day.dayOfWeek,
            shiftType: shiftType,
            isAvailable: true,
            isAbsentWeek: false
          }
        })
        
        createdCount++
        
        if (VERBOSE_LOGGING) {
          console.log(`      ✅ ${day.name} ${shiftType}`)
        }
        
      } catch (error) {
        if (VERBOSE_LOGGING) {
          console.log(`      ❌ ${day.name} ${shiftType} (già esistente)`)
        }
      }
    }
  }
  
  return createdCount
}

async function generateAllAvailability(weekStart: Date) {
  console.log('👥 Caricamento utenti attivi...')
  
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      NOT: {
        userRoles: {
          every: {
            role: 'ADMIN'
          }
        }
      }
    },
    include: {
      userRoles: {
        select: {
          role: true
        }
      }
    },
    orderBy: {
      username: 'asc'
    }
  })
  
  console.log(`📋 Trovati ${users.length} utenti attivi`)
  console.log('')
  
  let totalCreated = 0
  
  for (const user of users) {
    const roles = user.userRoles.map(ur => ur.role).join(', ')
    
    if (VERBOSE_LOGGING) {
      console.log(`👤 ${user.username} (${roles})`)
    }
    
    const userCreated = await generateUserAvailability(user.id, user.username, weekStart)
    totalCreated += userCreated
    
    if (!VERBOSE_LOGGING) {
      console.log(`✅ ${user.username}: ${userCreated} disponibilità`)
    }
  }
  
  return totalCreated
}

// ================================
// VALIDAZIONE E CONTROLLI
// ================================

function validateWeekStart(date: Date): boolean {
  const dayOfWeek = date.getDay()
  if (dayOfWeek !== 1) { // 1 = Lunedì
    console.error(`❌ ERRORE: La data ${format(date, 'dd/MM/yyyy')} non è un Lunedì!`)
    console.error(`   Giorno della settimana: ${format(date, 'EEEE', { locale: it })}`)
    console.error(`   Usa una data che sia un Lunedì.`)
    return false
  }
  return true
}

async function showWeekSummary(weekStart: Date) {
  const ws = normalizeDate(weekStart)
  const weekEnd = addWeekCalendarDays(ws, 6)
  const weekDays = getWeekDays(weekStart)
  
  console.log('📅 RIEPILOGO SETTIMANA TARGET')
  console.log('============================')
  console.log(`🗓️  Periodo: ${formatDate(ws)} - ${formatDate(weekEnd)}`)
  console.log(`📍 Settimana: ${format(weekStart, 'wo', { locale: it })} del ${format(weekStart, 'yyyy')}`)
  console.log('')
  console.log('📋 Giorni della settimana:')
  
  weekDays.forEach((day, index) => {
    console.log(`   ${index + 1}. ${day.name} ${format(day.date, 'dd/MM')} (${day.dayOfWeek})`)
  })
  
  console.log('')
}

// ================================
// MAIN EXECUTION
// ================================

async function main() {
  console.log('🍕 GENERATORE DISPONIBILITÀ PIZZADOC')
  console.log('====================================')
  console.log('')
  
  // Validazione data di inizio
  const weekStart = getNextWeekStart(WEEK_START_DATE)
  
  if (!validateWeekStart(weekStart)) {
    process.exit(1)
  }
  
  // Mostra riepilogo settimana
  await showWeekSummary(weekStart)
  
  try {
    // Elimina disponibilità esistenti se richiesto
    await clearExistingAvailability(weekStart)
    
    // Genera disponibilità per tutti gli utenti
    console.log('🔄 Generazione disponibilità...')
    console.log('')
    
    const totalCreated = await generateAllAvailability(weekStart)
    
    console.log('')
    console.log('🎉 GENERAZIONE COMPLETATA!')
    console.log('==========================')
    console.log(`✅ Disponibilità create: ${totalCreated}`)
    console.log(`📊 Settimana: ${formatDate(normalizeDate(weekStart))} - ${formatDate(addWeekCalendarDays(normalizeDate(weekStart), 6))}`)
    console.log(`👥 Ogni utente attivo è disponibile per tutti i turni della settimana`)
    console.log('')
    console.log('💡 TIP: Ora puoi generare il piano turni da Admin > Gestione Piano!')
    
  } catch (error) {
    console.error('❌ ERRORE DURANTE LA GENERAZIONE:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('❌ Errore critico:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

// ================================
// ISTRUZIONI PER L'USO
// ================================

/*

📖 COME USARE QUESTO SCRIPT:

1. 📅 MODIFICA LA SETTIMANA TARGET:
   Nella sezione "CONFIGURAZIONE SETTIMANA" modifica:
   const WEEK_START_DATE = new Date('2025-01-06')
   
   Assicurati che la data sia un LUNEDÌ!

2. 🏃 ESEGUI LO SCRIPT:
   npm run generate:availability
   
3. ⚙️ OPZIONI CONFIGURABILI:
   - CLEAR_EXISTING: elimina disponibilità esistenti
   - VERBOSE_LOGGING: log dettagliato per ogni utente

4. 📊 RISULTATO:
   Tutti gli utenti attivi saranno disponibili per:
   - Lunedì: Pranzo + Cena
   - Martedì: Pranzo + Cena  
   - Mercoledì: Pranzo + Cena
   - Giovedì: Pranzo + Cena
   - Venerdì: Pranzo + Cena
   - Sabato: Pranzo + Cena
   - Domenica: Pranzo + Cena
   
   Totale: 14 disponibilità per utente

5. 🎯 PROSSIMO PASSO:
   Vai su Admin > Gestione Piano e genera il calendario!

*/
