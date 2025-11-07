# 🔧 RICONFIGURAZIONE RAPIDA WAHA su Railway

## ✅ CHECKLIST SETUP

### **STEP 1: Ottieni il Nuovo URL di Railway**

1. Vai su **Railway Dashboard**: https://railway.app/dashboard
2. Seleziona il progetto **WAHA**
3. Vai su **Settings** → **Domains**
4. Copia l'URL pubblico (es: `waha-production-xxxx.up.railway.app`)

📝 **IL TUO URL WAHA:**
```
https://_____________________________________.up.railway.app
```

---

### **STEP 2: Verifica le Variabili d'Ambiente su Railway**

Nel progetto Railway → **Variables**, assicurati che ci siano:

```env
WAHA_LOG_LEVEL=info
PORT=3000
```

✅ Se mancano, aggiungile e fai **Redeploy**.

---

### **STEP 3: Aggiorna le Variabili d'Ambiente su Vercel**

1. Vai su **Vercel Dashboard**: https://vercel.com/dashboard
2. Seleziona il progetto **PizzaDOC**
3. Vai su **Settings** → **Environment Variables**
4. **Aggiorna o aggiungi** queste variabili per **Production**, **Preview** e **Development**:

```env
# ⚠️ IMPORTANTE: Sostituisci con il TUO URL di Railway!

# Backend (server-side)
WAHA_URL=https://___TUO-URL___.up.railway.app
WAHA_SESSION=default
WHATSAPP_ENABLED=true

# Frontend (client-side) - STESSE variabili con NEXT_PUBLIC_
NEXT_PUBLIC_WAHA_URL=https://___TUO-URL___.up.railway.app
NEXT_PUBLIC_WAHA_SESSION=default
NEXT_PUBLIC_WHATSAPP_ENABLED=true
```

5. **Salva tutto**
6. Vai su **Deployments** → clicca sui **3 puntini** dell'ultimo deploy → **Redeploy**

---

### **STEP 4: Avvia la Sessione WhatsApp su WAHA**

#### 4.1 Accedi alla Dashboard WAHA

Apri il browser e vai a:
```
https://___TUO-URL___.up.railway.app/dashboard
```

#### 4.2 Verifica/Crea Sessione "default"

- Se vedi già una sessione chiamata **"default"**: perfetto! ✅
- Se **NON** esiste:
  1. Clicca **"+ Add Session"**
  2. Nome: `default`
  3. Clicca **"Start"**

#### 4.3 Scansiona il QR Code

1. Nella dashboard WAHA, clicca sulla sessione **"default"**
2. Vedrai un **QR code** 📱
3. Apri **WhatsApp** sul telefono
4. Vai in **Impostazioni** → **Dispositivi collegati**
5. Clicca **"Collega dispositivo"**
6. **Scansiona il QR code** mostrato su WAHA

⏳ **Aspetta** che lo stato diventi **`WORKING`** (verde) ✅

---

### **STEP 5: Test su PizzaDOC**

#### 5.1 Accedi alla Pagina di Test

Vai su:
```
https://pizzadoc.vercel.app/admin/whatsapp-test
```

#### 5.2 Verifica Stato

Dovresti vedere:
- ✅ **Stato:** Connesso e funzionante
- ✅ **Configurazione:** Abilitato
- ✅ **Sessione:** WORKING

#### 5.3 Invia Messaggio di Test

1. Inserisci il tuo numero WhatsApp: `+41791234567`
2. Scrivi un messaggio di test: `Test WAHA funzionante! 🎉`
3. Clicca **"Invia Messaggio"**
4. Controlla WhatsApp sul telefono

✅ Se ricevi il messaggio, **TUTTO FUNZIONA!** 🎊

---

### **STEP 6: Configura il Group Chat ID (Opzionale)**

Se vuoi inviare notifiche al gruppo WhatsApp del team:

#### 6.1 Ottieni il Group Chat ID

**Metodo 1: Tramite WAHA Dashboard**
```
https://___TUO-URL___.up.railway.app/dashboard
→ Session "default" → View Chats
→ Trova il gruppo → Copia il chatId (es: 41789746890-1606996838@g.us)
```

**Metodo 2: Tramite API WAHA**
```bash
curl https://___TUO-URL___.up.railway.app/api/default/chats
```

📝 **IL TUO GROUP CHAT ID:**
```
_______________________________________@g.us
```

#### 6.2 Salva in PizzaDOC

1. Vai su **PizzaDOC** → **Configurazioni** (pagina attuale)
2. Incolla il **Group Chat ID** nel campo
3. Attiva **"Abilita Notifiche"**
4. Clicca **"Salva Impostazioni"**

---

## 🧪 TEST FINALE

### Test 1: Verifica Connessione WAHA
```bash
curl https://___TUO-URL___.up.railway.app/api/sessions/default
```

**Risposta attesa:**
```json
{
  "name": "default",
  "status": "WORKING"
}
```

### Test 2: Invia Messaggio di Test da cURL
```bash
curl -X POST https://___TUO-URL___.up.railway.app/api/sendText \
  -H "Content-Type: application/json" \
  -d '{
    "session": "default",
    "chatId": "+41791234567@c.us",
    "text": "Test da cURL!"
  }'
```

### Test 3: Invia al Gruppo
```bash
curl -X POST https://___TUO-URL___.up.railway.app/api/sendText \
  -H "Content-Type: application/json" \
  -d '{
    "session": "default",
    "chatId": "___TUO-GROUP-CHAT-ID___@g.us",
    "text": "Test gruppo! 🎉"
  }'
```

---

## ❌ TROUBLESHOOTING

### Problema: "Session not found"
**Soluzione:**
- Vai alla dashboard WAHA
- Verifica che la sessione `default` esista
- Se non esiste, creala manualmente

### Problema: "SCAN_QR_CODE"
**Soluzione:**
- WhatsApp si è disconnesso
- Vai alla dashboard WAHA
- Scansiona di nuovo il QR code

### Problema: "WAHA_URL is not configured"
**Soluzione:**
- Verifica che `WAHA_URL` sia impostato su Vercel
- Fai **Redeploy** su Vercel

### Problema: Vercel non vede le nuove env vars
**Soluzione:**
- Vai su Vercel → **Deployments**
- Clicca sui **3 puntini** dell'ultimo deploy
- Seleziona **"Redeploy"**
- ⚠️ **NON** fare solo `git push`, devi fare **Redeploy manuale**

### Problema: Railway non risponde
**Soluzione:**
- Vai su Railway → **Deployments**
- Controlla i **Logs** per errori
- Verifica che il servizio sia **attivo** (non in sleep)

---

## 📊 VERIFICA FINALE

Dopo aver completato tutti gli step, verifica che:

- [ ] ✅ URL Railway ottenuto e salvato
- [ ] ✅ Variabili d'ambiente su Vercel aggiornate
- [ ] ✅ Redeploy Vercel completato
- [ ] ✅ Sessione `default` su WAHA attiva
- [ ] ✅ QR code scansionato, stato = `WORKING`
- [ ] ✅ Test messaggio individuale funzionante
- [ ] ✅ Group Chat ID configurato (opzionale)
- [ ] ✅ Test messaggio gruppo funzionante (opzionale)
- [ ] ✅ Pagina PizzaDOC mostra "✅ Connesso"

---

## 🎉 SETUP COMPLETATO!

Ora WAHA è di nuovo funzionante! 🚀

Le notifiche WhatsApp funzioneranno per:
- ✅ Sostituzioni richieste
- ✅ Promemoria disponibilità (cron)
- ✅ Promemoria ore lavorate (cron)
- ✅ Notifiche gruppo

---

**Domande?** Controlla i log:
- **Railway:** https://railway.app → Progetto → Deployments → Logs
- **Vercel:** https://vercel.com → Progetto → Functions → Filter by /api/

---

**Creato:** $(date +%Y-%m-%d)
**Versione:** 1.0

