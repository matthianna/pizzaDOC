# ⚡ WAHA QUICK FIX - Riconfigurazione Rapida

## 🎯 PROBLEMA
WAHA non funziona più dopo redeploy su Railway → **"Session not found or not started"**

---

## ✅ SOLUZIONE IN 5 MINUTI

### **STEP 1: Ottieni URL Railway** (30 sec)
1. Vai su https://railway.app/dashboard
2. Apri il progetto **WAHA**
3. Vai su **Settings** → copia l'URL (es: `waha-production-xxxx.up.railway.app`)

---

### **STEP 2: Aggiorna Vercel** (1 min)
1. Vai su https://vercel.com/dashboard → **PizzaDOC**
2. **Settings** → **Environment Variables**
3. **Aggiorna queste 6 variabili** (Production, Preview, Development):

```env
WAHA_URL=https://___TUO-URL-RAILWAY___.up.railway.app
WAHA_SESSION=default
WHATSAPP_ENABLED=true
NEXT_PUBLIC_WAHA_URL=https://___TUO-URL-RAILWAY___.up.railway.app
NEXT_PUBLIC_WAHA_SESSION=default
NEXT_PUBLIC_WHATSAPP_ENABLED=true
```

4. **Deployments** → ultimi deploy → **"..."** → **Redeploy**

---

### **STEP 3: Connetti WhatsApp** (2 min)
1. Apri: `https://___TUO-URL-RAILWAY___.up.railway.app/dashboard`
2. Se non vedi sessione "default": clicca **"+ Add Session"** → nome: `default` → **Start**
3. **Scansiona il QR code** con WhatsApp (Impostazioni → Dispositivi collegati)
4. Aspetta che diventi **verde** con stato `WORKING` ✅

---

### **STEP 4: Test PizzaDOC** (1 min)
1. Vai su: `https://pizzadoc.vercel.app/admin/whatsapp-test`
2. Verifica: **"✅ Connesso e funzionante"**
3. Invia messaggio di test al tuo numero
4. ✅ **FATTO!**

---

## 🧪 TEST DA TERMINALE (opzionale)

### Test connessione:
```bash
npx tsx scripts/test-waha.ts
```

### Test invio messaggio:
```bash
npx tsx scripts/test-waha.ts +41791234567
```

---

## 📋 CHECKLIST VERIFICA

- [ ] URL Railway ottenuto
- [ ] 6 variabili aggiornate su Vercel
- [ ] Redeploy Vercel fatto
- [ ] Sessione "default" su WAHA attiva
- [ ] QR code scansionato
- [ ] Stato WAHA = `WORKING` (verde)
- [ ] Test su PizzaDOC = ✅ Connesso

---

## ❌ TROUBLESHOOTING RAPIDO

| Problema | Soluzione |
|----------|-----------|
| **"Session not found"** | Vai su WAHA Dashboard → Crea sessione "default" |
| **"SCAN_QR_CODE"** | Scansiona di nuovo il QR code su WAHA |
| **"WAHA_URL not configured"** | Controlla Vercel env vars + Redeploy |
| **Vercel non vede le nuove vars** | Fai **Redeploy manuale** (non basta git push) |
| **Railway non risponde** | Railway Dashboard → Logs → Verifica errori |

---

## 📄 GUIDE COMPLETE

- **Setup dettagliato:** `WAHA_RICONFIGURAZIONE.md`
- **Setup originale:** `WHATSAPP_SETUP.md`
- **Script test:** `scripts/test-waha.ts`

---

## 🎉 FATTO!

Ora WAHA funziona di nuovo! 🚀

**Tempo totale:** ~5 minuti ⏱️

---

**Ultima modifica:** 2025-11-07

