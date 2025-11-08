# 🔧 SETUP VARIABILI VERCEL PER WAHA

## ⚡ IL TUO URL WAHA
Dalla dashboard Railway:
```
https://waha-production-ce21.up.railway.app
```

---

## ✅ STEP 1: CONFIGURA VERCEL

### 1.1 Vai su Vercel Dashboard
```
https://vercel.com/dashboard
→ Seleziona progetto "PizzaDOC"
→ Settings
→ Environment Variables
```

### 1.2 Aggiungi/Aggiorna queste 6 variabili

**⚠️ IMPORTANTE: Per TUTTE e 3 gli ambienti (Production, Preview, Development)**

```env
# Backend (server-side)
WAHA_URL = https://waha-production-ce21.up.railway.app
WAHA_SESSION = default
WHATSAPP_ENABLED = true

# Frontend (client-side) - NECESSARIE per chiamate dal browser!
NEXT_PUBLIC_WAHA_URL = https://waha-production-ce21.up.railway.app
NEXT_PUBLIC_WAHA_SESSION = default
NEXT_PUBLIC_WHATSAPP_ENABLED = true
```

### 1.3 SELEZIONA GLI AMBIENTI
Per ogni variabile, **spunta tutte e 3 le caselle**:
- ☑️ **Production**
- ☑️ **Preview**
- ☑️ **Development**

### 1.4 Salva tutto
Clicca **"Save"** per ogni variabile.

---

## ✅ STEP 2: REDEPLOY MANUALE

**⚠️ CRITICO:** Non basta fare `git push`! Devi fare **Redeploy manuale**!

1. Vai su **Deployments**
2. Trova l'ultimo deploy (in cima alla lista)
3. Clicca sui **3 puntini (...)** a destra
4. Seleziona **"Redeploy"**
5. Conferma **"Redeploy"**
6. ⏳ Aspetta che il deploy completi (~2-3 min)

---

## ✅ STEP 3: VERIFICA

### 3.1 Aspetta il Deploy
Aspetta che Vercel finisca il redeploy (apparirà "Ready" verde).

### 3.2 Test su PizzaDOC
Vai su:
```
https://pizzadoc.vercel.app/admin/settings
```

Scorri fino a **"Notifiche WhatsApp"**.

**Risultato atteso:**
```
Stato Connessione WAHA: ✅ Connesso
Status: WORKING
```

### 3.3 Se ancora NON funziona

Aspetta 30 secondi e ricarica la pagina (Ctrl+F5 o Cmd+Shift+R per forzare).

---

## 🧪 TEST ALTERNATIVO

Se preferisci testare da terminale:

```bash
# Test locale (se hai .env.local configurato)
npx tsx scripts/test-waha.ts
```

---

## ❌ TROUBLESHOOTING

### Problema: "Session not found" anche dopo redeploy

**Causa:** Le variabili NEXT_PUBLIC_ non sono state impostate correttamente.

**Soluzione:**
1. Vai su Vercel → Settings → Environment Variables
2. Verifica che **TUTTE e 6** le variabili siano presenti:
   - ✅ WAHA_URL
   - ✅ WAHA_SESSION
   - ✅ WHATSAPP_ENABLED
   - ✅ NEXT_PUBLIC_WAHA_URL (IMPORTANTE!)
   - ✅ NEXT_PUBLIC_WAHA_SESSION (IMPORTANTE!)
   - ✅ NEXT_PUBLIC_WHATSAPP_ENABLED (IMPORTANTE!)
3. Controlla che per ognuna siano selezionati **tutti e 3 gli ambienti**
4. Fai **Redeploy manuale** di nuovo

---

### Problema: Redeploy non cambia nulla

**Soluzione:**
1. Vercel → Deployments
2. Clicca sul deploy appena completato
3. Vai su **"Functions"**
4. Cerca `/api/admin/whatsapp/settings`
5. Clicca per vedere i logs
6. Controlla se ci sono errori

---

### Problema: "CORS error" o "Network error"

**Causa:** Railway potrebbe avere problemi di firewall.

**Soluzione:**
1. Vai su Railway Dashboard
2. Verifica che il servizio WAHA sia **attivo** (non in sleep)
3. Prova ad aprire l'URL nel browser:
   ```
   https://waha-production-ce21.up.railway.app/dashboard
   ```
4. Se non si apre, riavvia il servizio su Railway

---

## 📋 CHECKLIST COMPLETA

- [ ] ✅ Aggiunta variabile `WAHA_URL` su Vercel (3 ambienti)
- [ ] ✅ Aggiunta variabile `WAHA_SESSION` su Vercel (3 ambienti)
- [ ] ✅ Aggiunta variabile `WHATSAPP_ENABLED` su Vercel (3 ambienti)
- [ ] ✅ Aggiunta variabile `NEXT_PUBLIC_WAHA_URL` su Vercel (3 ambienti) **← IMPORTANTE!**
- [ ] ✅ Aggiunta variabile `NEXT_PUBLIC_WAHA_SESSION` su Vercel (3 ambienti) **← IMPORTANTE!**
- [ ] ✅ Aggiunta variabile `NEXT_PUBLIC_WHATSAPP_ENABLED` su Vercel (3 ambienti) **← IMPORTANTE!**
- [ ] ✅ Fatto Redeploy **MANUALE** su Vercel (non git push!)
- [ ] ✅ Aspettato che deploy sia completato (verde "Ready")
- [ ] ✅ Aperto `https://pizzadoc.vercel.app/admin/settings`
- [ ] ✅ Visto "✅ Connesso" con status "WORKING"
- [ ] ✅ Test messaggio inviato con successo

---

## 🎯 PERCHÉ SERVONO LE VARIABILI NEXT_PUBLIC_?

Next.js ha due tipi di variabili:

1. **Server-side** (senza NEXT_PUBLIC_):
   - Usate dalle API routes (`/api/*`)
   - Non accessibili dal browser
   
2. **Client-side** (con NEXT_PUBLIC_):
   - Usate dai componenti React
   - Accessibili dal browser
   - **NECESSARIE per la pagina `/admin/settings`** ✅

Senza `NEXT_PUBLIC_WAHA_URL`, il browser non sa dove contattare WAHA!

---

## 🎉 FATTO!

Dopo aver completato questi step, PizzaDOC sarà connesso a WAHA! 🚀

**Tempo stimato:** 5 minuti ⏱️

---

**Creato:** 2025-11-07
**Per:** Railway URL `waha-production-ce21.up.railway.app`


