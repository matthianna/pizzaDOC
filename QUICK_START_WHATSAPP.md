# 🚀 Quick Start - WhatsApp Integration

## ⚡ Setup Rapido (5 minuti)

### 1. Crea `.env.local` per Testing Locale

Nella cartella `pizzadoc/`, crea il file `.env.local`:

```env
# WhatsApp Configuration
WAHA_URL=https://waha-production-ce21.up.railway.app
WAHA_SESSION=default
WHATSAPP_ENABLED=true

# Client-side vars (per la pagina di test)
NEXT_PUBLIC_WAHA_URL=https://waha-production-ce21.up.railway.app
NEXT_PUBLIC_WAHA_SESSION=default
NEXT_PUBLIC_WHATSAPP_ENABLED=true

# Database (usa SQLite locale)
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-local-secret-key-here"
```

### 2. Configura Variabili su Vercel

Vai su: **Vercel Dashboard → Settings → Environment Variables**

Aggiungi queste variabili per **Production**, **Preview**, e **Development**:

```
WAHA_URL = https://waha-production-ce21.up.railway.app
WAHA_SESSION = default
WHATSAPP_ENABLED = true
NEXT_PUBLIC_WAHA_URL = https://waha-production-ce21.up.railway.app
NEXT_PUBLIC_WAHA_SESSION = default
NEXT_PUBLIC_WHATSAPP_ENABLED = true
```

### 3. Verifica/Crea Sessione su WAHA

La sessione **"default"** è già attiva su WAHA. Se non lo fosse:

1. Apri: https://waha-production-ce21.up.railway.app/dashboard
2. Clicca **"Sessions"** → **"+ Start New"**
3. **Name:** `default`
4. **Engine:** `WEBJS` (già selezionato)
5. Clicca **"Start"**
6. **Scansiona il QR code** con WhatsApp:
   - Apri WhatsApp sul telefono
   - Vai in **Impostazioni → Dispositivi collegati**
   - Clicca **"Collega dispositivo"**
   - Scansiona il QR
7. Aspetta che lo stato diventi **"WORKING"** ✅

### 4. Test Locale

```bash
cd pizzadoc
npm run dev
```

Vai su: http://localhost:3000/admin/whatsapp-test

Dovresti vedere:
- ✅ Stato: **WORKING**
- ✅ Sessione: **default**
- ✅ Configurazione: **Abilitato**

### 5. Test Messaggio

1. Inserisci il tuo numero: `+393331234567`
2. Scrivi un messaggio di test
3. Clicca **"Invia Messaggio"**
4. Controlla WhatsApp! 📱

---

## 🐛 Troubleshooting Rapido

### ❌ "Session not found"
**Soluzione:** Verifica che la sessione `default` sia attiva su WAHA

### ❌ "SCAN_QR_CODE"
**Soluzione:** Scansiona il QR code nella dashboard WAHA

### ❌ "Cannot connect to WAHA"
**Soluzione:** 
- Verifica che WAHA sia online: https://waha-production-ce21.up.railway.app
- Controlla le variabili d'ambiente

### ❌ Sessione non trovata
**Soluzione:**
- Verifica che `WAHA_SESSION=default` sia impostato
- La sessione "default" è quella standard di WAHA
- Fai redeploy su Vercel dopo aver aggiunto le variabili
- Riavvia il dev server locale

### ❌ Errore 500 durante invio
**Possibili cause:**
1. **Sessione WhatsApp disconnessa:** Verifica stato su dashboard WAHA
2. **Numero formato errato:** Usa formato internazionale `+39...` (senza spazi)
3. **WAHA non connesso a WhatsApp:** Scansiona di nuovo il QR code

---

## 📝 Note Importanti

### Formato Numeri
✅ **Corretto:** `+393331234567` (no spazi, no trattini)  
❌ **Errato:** `+39 333 123 4567` o `333 123 4567`

### Variabili d'Ambiente
- **`WAHA_URL`** = Server-side (API routes)
- **`NEXT_PUBLIC_WAHA_URL`** = Client-side (pagina test)
- **Devono avere lo STESSO valore!**

### Sessione WhatsApp
- Usa un **numero dedicato**, non il tuo personale
- La sessione può disconnettersi, controlla periodicamente
- Backup della sessione è consigliato

---

## ✅ Checklist Finale

Prima di andare in produzione:

- [ ] WAHA è online su Railway
- [ ] Sessione `default` attiva e stato **WORKING**
- [ ] Variabili d'ambiente configurate su Vercel
- [ ] Test messaggio funzionante dalla pagina `/admin/whatsapp-test`
- [ ] WhatsApp connesso e verificato
- [ ] Numero di telefono in formato corretto

---

**Tempo stimato:** 5-10 minuti  
**Difficoltà:** ⭐⭐☆☆☆ (Facile)

Se hai problemi, consulta `WHATSAPP_SETUP.md` per la guida completa.

