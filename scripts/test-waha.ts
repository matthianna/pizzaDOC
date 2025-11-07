/**
 * Script di test rapido per WAHA
 * 
 * Uso:
 * npx tsx scripts/test-waha.ts
 */

import 'dotenv/config'

const WAHA_URL = process.env.WAHA_URL || process.env.NEXT_PUBLIC_WAHA_URL
const WAHA_SESSION = process.env.WAHA_SESSION || process.env.NEXT_PUBLIC_WAHA_SESSION || 'default'
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true' || process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true'
const WAHA_API_KEY = process.env.WAHA_API_KEY || process.env.NEXT_PUBLIC_WAHA_API_KEY

console.log('\n🔍 ====== TEST WAHA CONFIGURATION ======\n')

// 1. Verifica variabili d'ambiente
console.log('📋 **VARIABILI D\'AMBIENTE:**')
console.log(`   WAHA_URL: ${WAHA_URL || '❌ NON CONFIGURATO'}`)
console.log(`   WAHA_SESSION: ${WAHA_SESSION}`)
console.log(`   WAHA_API_KEY: ${WAHA_API_KEY ? '✅ Configurata' : '⚠️  Non configurata (potrebbe servire)'}`)
console.log(`   WHATSAPP_ENABLED: ${WHATSAPP_ENABLED ? '✅ Abilitato' : '❌ Disabilitato'}\n`)

if (!WAHA_URL) {
  console.error('❌ ERRORE: WAHA_URL non configurato!')
  console.log('\n💡 SOLUZIONE:')
  console.log('   1. Crea un file .env.local nella root del progetto')
  console.log('   2. Aggiungi: WAHA_URL=https://tuo-url-railway.up.railway.app')
  console.log('   3. Oppure imposta la variabile su Vercel')
  process.exit(1)
}

if (!WHATSAPP_ENABLED) {
  console.warn('⚠️  ATTENZIONE: WhatsApp è DISABILITATO')
  console.log('💡 Per abilitarlo: WHATSAPP_ENABLED=true\n')
}

// 2. Test connessione WAHA
async function testWahaConnection() {
  console.log('🔌 **TEST CONNESSIONE WAHA:**')
  
  try {
    const url = `${WAHA_URL}/api/sessions/${WAHA_SESSION}`
    console.log(`   Connettendo a: ${url}`)
    
    const headers: any = {
      'Content-Type': 'application/json',
    }
    
    if (WAHA_API_KEY) {
      headers['X-Api-Key'] = WAHA_API_KEY
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`   ✅ Connessione riuscita!`)
      console.log(`   📊 Stato sessione: ${data.status}`)
      
      if (data.status === 'WORKING') {
        console.log(`   🎉 WhatsApp è CONNESSO e FUNZIONANTE!\n`)
        return true
      } else if (data.status === 'SCAN_QR_CODE') {
        console.log(`   ⚠️  WhatsApp necessita di scansionare il QR code`)
        console.log(`   💡 Vai su: ${WAHA_URL}/dashboard\n`)
        return false
      } else if (data.status === 'STARTING') {
        console.log(`   ⏳ WhatsApp si sta avviando...`)
        console.log(`   💡 Riprova tra qualche secondo\n`)
        return false
      } else {
        console.log(`   ❌ Stato sconosciuto: ${data.status}\n`)
        return false
      }
    } else {
      const errorText = await response.text()
      console.log(`   ❌ Errore HTTP ${response.status}`)
      console.log(`   📄 Dettagli: ${errorText}`)
      
      if (response.status === 404) {
        console.log(`\n   💡 SOLUZIONE:`)
        console.log(`      1. Vai su: ${WAHA_URL}/dashboard`)
        console.log(`      2. Crea una sessione chiamata "${WAHA_SESSION}"`)
        console.log(`      3. Avvia la sessione e scansiona il QR code\n`)
      } else if (response.status === 401) {
        console.log(`\n   💡 SOLUZIONE - ERRORE 401 UNAUTHORIZED:`)
        console.log(`      WAHA richiede autenticazione API!`)
        console.log(`      \n      Leggi la guida: cat WAHA_API_KEY_FIX.md`)
        console.log(`      \n      OPZIONE RAPIDA: Disabilita auth su Railway`)
        console.log(`      → Aggiungi variabile: WHATSAPP_API_KEY_ENABLED=false\n`)
      }
      
      return false
    }
  } catch (error) {
    console.log(`   ❌ ERRORE di connessione!`)
    console.log(`   📄 Dettagli: ${error instanceof Error ? error.message : String(error)}`)
    console.log(`\n   💡 POSSIBILI CAUSE:`)
    console.log(`      - WAHA non è in esecuzione su Railway`)
    console.log(`      - URL errato in WAHA_URL`)
    console.log(`      - Problemi di rete/firewall`)
    console.log(`\n   🔧 VERIFICA:`)
    console.log(`      - Railway dashboard: https://railway.app/dashboard`)
    console.log(`      - Controlla che il servizio sia attivo`)
    console.log(`      - Verifica l'URL nel browser: ${WAHA_URL}/dashboard\n`)
    return false
  }
}

// 3. Test invio messaggio (solo se richiesto)
async function testSendMessage(phoneNumber: string) {
  console.log('📤 **TEST INVIO MESSAGGIO:**')
  console.log(`   Numero: ${phoneNumber}`)
  
  try {
    const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber.replace(/[^\d]/g, '')}@c.us`
    
    const headers: any = {
      'Content-Type': 'application/json',
    }
    
    if (WAHA_API_KEY) {
      headers['X-Api-Key'] = WAHA_API_KEY
    }
    
    const response = await fetch(`${WAHA_URL}/api/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: WAHA_SESSION,
        chatId,
        text: `🧪 Test messaggio da PizzaDOC\n\nData: ${new Date().toLocaleString('it-IT')}\n\n✅ WAHA funziona correttamente!`,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`   ✅ Messaggio inviato con successo!`)
      console.log(`   📨 Message ID: ${data.id}`)
      console.log(`   💡 Controlla WhatsApp per verificare\n`)
      return true
    } else {
      const errorText = await response.text()
      console.log(`   ❌ Errore invio: ${response.status}`)
      console.log(`   📄 Dettagli: ${errorText}\n`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ ERRORE: ${error instanceof Error ? error.message : String(error)}\n`)
    return false
  }
}

// 4. Main execution
async function main() {
  const isConnected = await testWahaConnection()
  
  // Se l'utente passa un numero come argomento, prova ad inviare un messaggio
  const testPhone = process.argv[2]
  if (testPhone && isConnected) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    await testSendMessage(testPhone)
  } else if (testPhone && !isConnected) {
    console.log('⚠️  Non posso inviare messaggi: WAHA non è connesso\n')
  }
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('📊 **RIEPILOGO:**')
  console.log(`   Configurazione: ${WAHA_URL ? '✅' : '❌'}`)
  console.log(`   Connessione WAHA: ${isConnected ? '✅' : '❌'}`)
  console.log(`   WhatsApp Abilitato: ${WHATSAPP_ENABLED ? '✅' : '❌'}`)
  
  if (isConnected && WHATSAPP_ENABLED) {
    console.log('\n🎉 **TUTTO OK! WAHA è pronto per inviare messaggi!**\n')
    console.log('💡 Per testare un invio, riavvia lo script con:')
    console.log(`   npx tsx scripts/test-waha.ts +41791234567\n`)
  } else if (isConnected && !WHATSAPP_ENABLED) {
    console.log('\n⚠️  WAHA è connesso ma WhatsApp è DISABILITATO')
    console.log('💡 Per abilitarlo: WHATSAPP_ENABLED=true\n')
  } else {
    console.log('\n❌ **WAHA NON È PRONTO**')
    console.log('💡 Segui la guida: WAHA_RICONFIGURAZIONE.md\n')
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch(console.error)

