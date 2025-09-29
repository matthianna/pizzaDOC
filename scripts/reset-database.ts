#!/usr/bin/env tsx

/**
 * RESET COMPLETO DATABASE
 * 
 * ⚠️  ATTENZIONE: Questo script elimina TUTTO il contenuto del database!
 * 
 * Elimina in ordine sicuro:
 * - Tutte le disponibilità
 * - Tutti i turni e piani
 * - Tutte le ore lavorate 
 * - Tutte le sostituzioni
 * - Tutti gli utenti e relative associazioni
 * - Tutte le impostazioni e configurazioni
 * 
 * Uso: npm run reset:database
 * 
 * ⚠️  NON REVERSIBILE - Usa con cautela!
 */

import { PrismaClient } from '@prisma/client'
import { createInterface } from 'readline'

const prisma = new PrismaClient()

// ================================
// CONFIGURAZIONE SICUREZZA
// ================================

const REQUIRE_CONFIRMATION = true // Richiede conferma prima dell'eliminazione
const SHOW_PROGRESS = true // Mostra il progresso dettagliato
const CONFIRM_PHRASE = 'ELIMINA TUTTO' // Frase da digitare per confermare

// ================================
// FUNZIONI DI SICUREZZA
// ================================

async function askConfirmation(): Promise<boolean> {
  if (!REQUIRE_CONFIRMATION) return true

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    console.log('')
    console.log('⚠️  ATTENZIONE: OPERAZIONE PERICOLOSA!')
    console.log('=======================================')
    console.log('❌ Questo script eliminerà TUTTO il contenuto del database:')
    console.log('   • Tutti gli utenti e le loro credenziali')
    console.log('   • Tutti i piani turni e disponibilità')
    console.log('   • Tutte le ore lavorate')
    console.log('   • Tutte le sostituzioni')
    console.log('   • Tutte le impostazioni di sistema')
    console.log('')
    console.log('🚨 QUESTA OPERAZIONE NON È REVERSIBILE!')
    console.log('')
    console.log(`📝 Per confermare, digita esattamente: "${CONFIRM_PHRASE}"`)
    console.log('   (oppure premi ENTER per annullare)')
    console.log('')

    rl.question('Conferma eliminazione: ', (answer) => {
      rl.close()
      
      if (answer.trim() === CONFIRM_PHRASE) {
        console.log('✅ Confermato. Procedendo con l\'eliminazione...')
        console.log('')
        resolve(true)
      } else {
        console.log('❌ Operazione annullata.')
        resolve(false)
      }
    })
  })
}

function showProgress(message: string, count?: number) {
  if (!SHOW_PROGRESS) return
  
  if (count !== undefined) {
    console.log(`🔄 ${message}: ${count} record eliminati`)
  } else {
    console.log(`🔄 ${message}...`)
  }
}

// ================================
// FUNZIONI DI ELIMINAZIONE
// ================================

async function deleteWorkflowData() {
  showProgress('Eliminazione dati workflow')

  // 1. Elimina ore lavorate
  const workedHours = await prisma.workedHours.deleteMany()
  showProgress('Ore lavorate', workedHours.count)

  // 2. Elimina sostituzioni
  const substitutions = await prisma.substitution.deleteMany()
  showProgress('Sostituzioni', substitutions.count)

  // 3. Elimina turni
  const shifts = await prisma.shift.deleteMany()
  showProgress('Turni', shifts.count)

  // 4. Elimina piani
  const schedules = await prisma.schedule.deleteMany()
  showProgress('Piani turni', schedules.count)

  // 5. Elimina disponibilità
  const availabilities = await prisma.availability.deleteMany()
  showProgress('Disponibilità', availabilities.count)

  console.log('✅ Dati workflow eliminati')
}

async function deleteUserData() {
  showProgress('Eliminazione dati utenti')

  // 1. Elimina ruoli utente
  const userRoles = await prisma.userRole.deleteMany()
  showProgress('Ruoli utente', userRoles.count)

  // 2. Elimina trasporti utente
  const userTransports = await prisma.userTransport.deleteMany()
  showProgress('Trasporti utente', userTransports.count)

  // 3. Elimina sessioni
  const sessions = await prisma.session.deleteMany()
  showProgress('Sessioni', sessions.count)

  // 4. Elimina account
  const accounts = await prisma.account.deleteMany()
  showProgress('Account', accounts.count)

  // 5. Elimina utenti
  const users = await prisma.user.deleteMany()
  showProgress('Utenti', users.count)

  console.log('✅ Dati utenti eliminati')
}

async function deleteConfigurationData() {
  showProgress('Eliminazione configurazioni sistema')

  // 1. Elimina distribuzioni orari
  const distributions = await prisma.shiftStartTimeDistribution.deleteMany()
  showProgress('Distribuzioni orari', distributions.count)

  // 2. Elimina template orari
  const templates = await prisma.shiftStartTimeTemplate.deleteMany()
  showProgress('Template orari', templates.count)

  // 3. Elimina limiti turni
  const limits = await prisma.shiftLimits.deleteMany()
  showProgress('Limiti turni', limits.count)

  // 4. Elimina impostazioni sistema
  const settings = await prisma.systemSettings.deleteMany()
  showProgress('Impostazioni sistema', settings.count)

  // 5. Elimina token di verifica
  const tokens = await prisma.verificationToken.deleteMany()
  showProgress('Token verifica', tokens.count)

  console.log('✅ Configurazioni sistema eliminate')
}

async function verifyDatabaseEmpty() {
  showProgress('Verifica database vuoto')

  const tables = [
    { name: 'User', count: await prisma.user.count() },
    { name: 'UserRole', count: await prisma.userRole.count() },
    { name: 'UserTransport', count: await prisma.userTransport.count() },
    { name: 'Availability', count: await prisma.availability.count() },
    { name: 'Schedule', count: await prisma.schedule.count() },
    { name: 'Shift', count: await prisma.shift.count() },
    { name: 'WorkedHours', count: await prisma.workedHours.count() },
    { name: 'Substitution', count: await prisma.substitution.count() },
    { name: 'ShiftLimits', count: await prisma.shiftLimits.count() },
    { name: 'ShiftStartTimeDistribution', count: await prisma.shiftStartTimeDistribution.count() },
    { name: 'ShiftStartTimeTemplate', count: await prisma.shiftStartTimeTemplate.count() },
    { name: 'SystemSettings', count: await prisma.systemSettings.count() },
    { name: 'Session', count: await prisma.session.count() },
    { name: 'Account', count: await prisma.account.count() },
    { name: 'VerificationToken', count: await prisma.verificationToken.count() }
  ]

  console.log('')
  console.log('📊 VERIFICA FINALE:')
  console.log('==================')

  let totalRecords = 0
  for (const table of tables) {
    totalRecords += table.count
    const status = table.count === 0 ? '✅' : '❌'
    console.log(`${status} ${table.name}: ${table.count} record`)
  }

  console.log('')
  if (totalRecords === 0) {
    console.log('✅ Database completamente vuoto!')
  } else {
    console.log(`❌ Attenzione: ${totalRecords} record ancora presenti`)
  }

  return totalRecords === 0
}

// ================================
// MAIN EXECUTION
// ================================

async function main() {
  console.log('🍕 RESET COMPLETO DATABASE PIZZADOC')
  console.log('====================================')

  try {
    // Richiedi conferma se abilitato
    const confirmed = await askConfirmation()
    if (!confirmed) {
      console.log('')
      console.log('✅ Operazione annullata. Database non modificato.')
      return
    }

    console.log('🗑️  INIZIO ELIMINAZIONE DATABASE')
    console.log('=================================')

    // Elimina in ordine sicuro per rispettare le foreign key
    await deleteWorkflowData()
    console.log('')
    
    await deleteUserData()
    console.log('')
    
    await deleteConfigurationData()
    console.log('')

    // Verifica che tutto sia stato eliminato
    const isEmpty = await verifyDatabaseEmpty()

    console.log('')
    console.log('🎉 RESET COMPLETATO!')
    console.log('====================')
    
    if (isEmpty) {
      console.log('✅ Database completamente pulito')
      console.log('✅ Tutti i dati sono stati eliminati')
      console.log('')
      console.log('💡 PROSSIMI PASSI:')
      console.log('   1. npm run setup:database     (ricrea utenti e config)')
      console.log('   2. npm run generate:availability (crea disponibilità)')
      console.log('   3. Accedi come admin/admin e genera i turni')
    } else {
      console.log('❌ Alcuni dati potrebbero non essere stati eliminati')
      console.log('   Controlla i log sopra per dettagli')
    }

  } catch (error) {
    console.error('')
    console.error('❌ ERRORE DURANTE IL RESET:', error)
    console.error('')
    console.error('💡 Possibili cause:')
    console.error('   • Database non raggiungibile')
    console.error('   • Vincoli di foreign key non rispettati')
    console.error('   • Permessi insufficienti')
    console.error('')
    console.error('🔧 Soluzioni:')
    console.error('   • Verifica che il database sia attivo')
    console.error('   • Riprova il comando')
    console.error('   • Controlla i log per errori specifici')
    
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
// DOCUMENTAZIONE USO
// ================================

/*

📖 COME USARE QUESTO SCRIPT:

⚠️  PRIMA DI ESEGUIRE:
1. 💾 Fai un backup del database se contiene dati importanti
2. 🔒 Assicurati di voler eliminare TUTTO
3. 📝 Prepara la frase di conferma: "ELIMINA TUTTO"

🏃 ESECUZIONE:
npm run reset:database

🔒 SICUREZZA:
- Richiede conferma manuale prima dell'eliminazione
- Mostra esattamente cosa verrà eliminato
- Verifica che tutto sia stato pulito
- Fornisce istruzioni per il ripristino

📊 COSA VIENE ELIMINATO:
✅ Tutti gli utenti e credenziali
✅ Tutti i piani turni e disponibilità  
✅ Tutte le ore lavorate e sostituzioni
✅ Tutte le impostazioni e configurazioni
✅ Tutte le sessioni e token

🔄 DOPO IL RESET:
1. npm run setup:database       (ricrea il sistema)
2. npm run generate:availability (crea disponibilità)
3. Login admin/admin e usa l'app

💡 TIP: Questo script è utile per:
- Reset completo per testing
- Pulizia prima del deploy in produzione
- Ripartire da zero con dati freschi

*/
