# 📅 Cron Jobs - PizzaDoc

## 🕐 Cron Jobs Configurati

### 1. Promemoria Disponibilità (`availability-reminder`)

**Quando:** Ogni domenica alle 12:00 UTC (13:00 CET inverno, 14:00 CEST estate)  
**Endpoint:** `/api/cron/availability-reminder`  
**Cosa fa:**
- Controlla quali utenti non hanno inserito le disponibilità per la settimana successiva
- Invia un messaggio al gruppo WhatsApp con la lista degli utenti
- Invia messaggi individuali a ogni utente che manca

---

## 🧪 Come Testare il Cron Job

### **Opzione 1: Vercel Dashboard (Consigliato)**

1. Vai su: https://vercel.com/matthiannas-projects/pizzadoc/deployments
2. Clicca sul deployment più recente
3. Vai alla tab **"Cron Jobs"**
4. Clicca **"Run Now"** accanto a `availability-reminder`

### **Opzione 2: Chiamata Manuale con CRON_SECRET**

Se hai configurato `CRON_SECRET` nelle variabili d'ambiente:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://pizzadoc-qnlk8ccca-matthiannas-projects.vercel.app/api/cron/availability-reminder
```

**Nota:** Sostituisci `YOUR_CRON_SECRET` con il valore configurato su Vercel.

### **Opzione 3: Bypass Deployment Protection**

Per testare senza CRON_SECRET, usa il bypass token di Vercel:

```bash
curl "https://pizzadoc-qnlk8ccca-matthiannas-projects.vercel.app/api/cron/availability-reminder?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=YOUR_BYPASS_TOKEN"
```

**Nota:** Il bypass token si trova in: Vercel Dashboard → Project Settings → Deployment Protection

---

## ⚙️ Configurazione

### **vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/availability-reminder",
      "schedule": "0 12 * * 0"
    }
  ]
}
```

**Schedule Format (Cron Expression):**
- `0 12 * * 0` = Ogni domenica alle 12:00 UTC
- Formato: `minuto ora giorno mese giorno_settimana`
- Giorni settimana: 0=Domenica, 1=Lunedì, ..., 6=Sabato

### **Variabili d'Ambiente**

#### **Obbligatorie:**
```
WAHA_URL=https://waha-production-ce21.up.railway.app
WAHA_SESSION=default
WHATSAPP_ENABLED=true
```

#### **Opzionali:**
```
CRON_SECRET=your-secret-token-here
```

Se `CRON_SECRET` è impostato, le chiamate manuali richiederanno:
```
Authorization: Bearer your-secret-token-here
```

---

## 📊 Response del Cron Job

### **Success Response:**

```json
{
  "success": true,
  "message": "Availability reminder cron job completed",
  "results": {
    "total": 15,
    "withoutAvailability": 5,
    "notificationsSent": 6,
    "notificationsFailed": 0
  }
}
```

### **Error Response (Unauthorized):**

```json
{
  "error": "Unauthorized",
  "hint": "Use Authorization: Bearer <CRON_SECRET> header or wait for Vercel to run the cron automatically"
}
```

---

## 🔐 Sicurezza

### **Protezione Automatica di Vercel**

Quando il cron job viene eseguito automaticamente da Vercel:
- Vercel invia un header speciale: `x-vercel-cron`
- L'endpoint verifica questo header e permette l'accesso
- **Non serve CRON_SECRET** per le esecuzioni automatiche

### **Protezione Chiamate Manuali**

Per le chiamate manuali (test), hai 2 opzioni:

1. **Con CRON_SECRET (Raccomandato):**
   - Configura `CRON_SECRET` su Vercel
   - Usa `Authorization: Bearer <CRON_SECRET>` nelle chiamate

2. **Con Bypass Token:**
   - Usa il bypass token di Vercel Deployment Protection
   - Più complesso, usalo solo per debug

---

## 🐛 Troubleshooting

### ❌ "Authentication Required" (HTML response)

**Problema:** Deployment Protection di Vercel blocca l'accesso

**Soluzione:**
- Aspetta che Vercel esegua automaticamente il cron (domenica 12:00)
- Oppure usa `CRON_SECRET` o bypass token per test manuali
- Oppure usa "Run Now" dalla dashboard Vercel

### ❌ "Unauthorized" (JSON response)

**Problema:** CRON_SECRET mancante o errato

**Soluzione:**
- Verifica di aver configurato `CRON_SECRET` su Vercel
- Usa il header: `Authorization: Bearer <CRON_SECRET>`
- Oppure aspetta l'esecuzione automatica di Vercel

### ❌ Nessuna notifica inviata

**Problema:** WhatsApp non configurato o non ci sono utenti senza disponibilità

**Soluzione:**
- Verifica che `WHATSAPP_ENABLED=true`
- Verifica che `WAHA_URL` e `WAHA_SESSION` siano corretti
- Controlla che ci siano effettivamente utenti senza disponibilità
- Verifica i log nel deployment Vercel

---

## 📝 Logs

### **Dove Trovare i Log:**

1. **Vercel Dashboard:**
   - https://vercel.com/matthiannas-projects/pizzadoc/deployments
   - Clicca sul deployment
   - Tab "Functions"
   - Cerca `/api/cron/availability-reminder`

2. **Log Format:**

```
🕐 Starting availability reminder cron job... { triggeredBy: 'Vercel Cron' }
📅 Checking availability for week: 2025-01-27T00:00:00.000Z
📊 Found 5 users without availability
✅ Group reminder sent successfully
✅ Personal reminder sent to Mario Rossi
✅ Personal reminder sent to Luigi Bianchi
...
✅ Availability reminder cron job completed: { ... }
```

---

## 🎯 Schedule in Italiano

| Ora UTC | Ora Italia (CET) | Ora Italia (CEST) |
|---------|------------------|-------------------|
| 12:00   | 13:00            | 14:00             |

**Per cambiare l'orario:**

Modifica `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/availability-reminder",
      "schedule": "0 11 * * 0"  // 11:00 UTC = 12:00 CET
    }
  ]
}
```

Poi fai redeploy:
```bash
vercel --prod
```

---

## ✅ Checklist Finale

Prima di andare in produzione:

- [ ] `WAHA_URL` configurato su Vercel
- [ ] `WAHA_SESSION=default` configurato
- [ ] `WHATSAPP_ENABLED=true` configurato
- [ ] WhatsApp connesso e funzionante (stato WORKING)
- [ ] Group Chat ID configurato in `/admin/settings`
- [ ] Notifiche WhatsApp abilitate in `/admin/settings`
- [ ] `vercel.json` committato nel repository
- [ ] Cron job visibile nella dashboard Vercel
- [ ] Test manuale eseguito con successo

---

**Creato:** 2025-01-16  
**Ultima modifica:** 2025-01-16



