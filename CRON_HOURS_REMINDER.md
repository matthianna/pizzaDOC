# 🔔 Cron Job: Promemoria Ore Lavorate

## 📋 Descrizione

Cron job automatico che invia un messaggio WhatsApp al gruppo ogni **giovedì alle 15:00 CEST** con la lista dei dipendenti che non hanno ancora inserito le ore per i turni completati.

---

## ⏰ Configurazione

### **Orario di Esecuzione**
- **Giorno**: Giovedì
- **Ora**: 15:00 CEST (13:00 UTC)
- **Frequenza**: Settimanale

### **Cron Expression**
```
0 13 * * 4
```
- `0` = minuto 0
- `13` = ora 13 UTC (15:00 CEST)
- `*` = ogni giorno del mese
- `*` = ogni mese
- `4` = giovedì (0=domenica)

---

## 📝 File Coinvolti

1. **Endpoint Cron**: `src/app/api/cron/hours-reminder/route.ts`
2. **Configurazione**: `vercel.json` (riga 11-14)
3. **API Ore Mancanti**: `src/app/api/admin/hours-summary/missing/route.ts`

---

## 🔍 Logica di Funzionamento

### **1. Query Database**
Il cron esegue due query:

#### Query 1: Turni senza ore inserite
```typescript
- Turni passati (weekStart < oggi)
- Nessuna riga in worked_hours
- Utente attivo (isActive: true)
- Utente con conteggio ore attivo (trackHours: true)
```

#### Query 2: Turni con ore rifiutate
```typescript
- Turni passati
- worked_hours.status = 'REJECTED'
- Utente attivo
- Utente con conteggio ore attivo
```

### **2. Raggruppa per Utente**
- Conta il numero di turni mancanti per ogni dipendente
- Ordina per numero di turni mancanti (decrescente)

### **3. Invia Messaggio WhatsApp**
Se ci sono ore mancanti:
- Recupera configurazione WhatsApp dal database
- Verifica che le notifiche siano abilitate
- Costruisce messaggio con lista dipendenti
- Invia al gruppo WhatsApp

---

## 📱 Formato Messaggio

```
⏰ PROMEMORIA ORE LAVORATE

📋 Questi dipendenti devono ancora inserire le ore:

• mario.rossi - 3 turni
• giulia - 2 turni
• valentino.dipietro - 1 turno

📝 Inserisci le ore su:
https://pizzadoc.vercel.app/hours
```

---

## 🔒 Autenticazione

Il cron accetta due modalità di autenticazione:

### **1. Vercel Cron (AUTOMATICA)** ✅
Quando Vercel esegue il cron automaticamente, invia l'header `x-vercel-cron` che viene riconosciuto e accettato.

**Nessuna configurazione richiesta!**

### **2. Chiamata Manuale (OPZIONALE)**
Se vuoi chiamare il cron manualmente (per test), puoi configurare `CRON_SECRET`:
```typescript
Authorization: Bearer ${process.env.CRON_SECRET}
```

**Nota**: Il `CRON_SECRET` è opzionale e serve solo per chiamate manuali.

---

## ✅ Condizioni per Invio Messaggio

Il messaggio viene inviato **SOLO SE**:

1. ✅ Ci sono dipendenti con ore mancanti
2. ✅ Le notifiche WhatsApp sono abilitate (`whatsapp_notifications_enabled = 'true'`)
3. ✅ Il gruppo WhatsApp è configurato (`whatsapp_group_chat_id` presente)

Se non ci sono ore mancanti, il cron termina senza inviare nulla.

---

## 🧪 Test Manuale

### **Metodo 1: Via Browser (Locale)**
```bash
# Avvia il server in locale
npm run dev

# Apri browser e vai a:
http://localhost:3000/api/cron/hours-reminder

# Nota: Richiede header Authorization corretto
```

### **Metodo 2: Via cURL**
```bash
curl -X GET "https://pizzadoc.vercel.app/api/cron/hours-reminder" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### **Metodo 3: Via Vercel Dashboard**
1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleziona il progetto "pizzadoc"
3. Vai su "Cron Jobs"
4. Trova "hours-reminder"
5. Clicca su "Run Now" per test immediato

---

## 📊 Response API

### **Success (con ore mancanti)**
```json
{
  "success": true,
  "message": "Hours reminder sent successfully",
  "usersWithMissingHours": 3,
  "users": [
    { "username": "mario.rossi", "missingCount": 3 },
    { "username": "giulia", "missingCount": 2 },
    { "username": "valentino.dipietro", "missingCount": 1 }
  ]
}
```

### **Success (nessuna ora mancante)**
```json
{
  "success": true,
  "message": "No missing hours to report",
  "usersWithMissingHours": 0
}
```

### **Success (WhatsApp disabilitato)**
```json
{
  "success": true,
  "message": "Missing hours found but WhatsApp disabled",
  "usersWithMissingHours": 3
}
```

### **Error**
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Error message"
}
```

---

## 📋 Logs

Il cron genera log dettagliati:

```
⏰ [CRON hours-reminder] Starting hours reminder job...
📊 [CRON hours-reminder] Turni senza ore: 5
📊 [CRON hours-reminder] Turni con ore rifiutate: 2
📊 [CRON hours-reminder] Utenti con ore mancanti: 3
✅ [CRON hours-reminder] Messaggio inviato con successo al gruppo
📊 [CRON hours-reminder] 3 dipendenti nella lista
```

---

## 🔧 Configurazione Ambiente

### **Variabili opzionali**:
```env
CRON_SECRET=your_secret_token  # ⚠️ OPZIONALE - solo per chiamate manuali
```

**Nota**: Vercel gestisce automaticamente l'autenticazione dei cron job, quindi `CRON_SECRET` non è necessario per il funzionamento automatico.

### **Impostazioni Database**:
```sql
-- Abilita notifiche WhatsApp
UPDATE system_settings 
SET value = 'true' 
WHERE key = 'whatsapp_notifications_enabled';

-- Configura gruppo WhatsApp
UPDATE system_settings 
SET value = '41789746890-1606996838@g.us' 
WHERE key = 'whatsapp_group_chat_id';
```

---

## 🚀 Deploy

Dopo aver modificato `vercel.json`, esegui:

```bash
# Commit modifiche
git add vercel.json src/app/api/cron/hours-reminder/route.ts
git commit -m "Add hours reminder cron job"

# Deploy
git push origin main
```

Vercel rileverà automaticamente il nuovo cron job e lo attiverà.

---

## 🐛 Troubleshooting

### **Il messaggio non viene inviato**

1. **Verifica notifiche abilitate**:
   ```sql
   SELECT * FROM system_settings 
   WHERE key = 'whatsapp_notifications_enabled';
   ```

2. **Verifica gruppo configurato**:
   ```sql
   SELECT * FROM system_settings 
   WHERE key = 'whatsapp_group_chat_id';
   ```

3. **Verifica CRON_SECRET**:
   - Vai su Vercel Dashboard > Settings > Environment Variables
   - Assicurati che `CRON_SECRET` sia impostato

4. **Controlla i logs su Vercel**:
   - Dashboard > Project > Functions > Logs

### **Errore 401 Unauthorized**
Questo errore si verifica solo se:
- Stai chiamando il cron **manualmente** (non da Vercel)
- E hai configurato `CRON_SECRET` ma l'header è errato

**Soluzione per chiamate da Vercel:**
- ✅ Vercel invia automaticamente l'header `x-vercel-cron`
- ✅ Non serve configurare `CRON_SECRET`
- ✅ Il cron funziona automaticamente

**Soluzione per chiamate manuali:**
- Rimuovi `CRON_SECRET` dalle variabili d'ambiente
- Oppure usa l'header: `Authorization: Bearer <tuo_CRON_SECRET>`

### **Nessuna ora mancante ma dipendenti hanno turni**
- Verifica che `trackHours = true` per i dipendenti
- Verifica che `isActive = true` per i dipendenti
- Verifica che i turni siano effettivamente nel passato

---

## 📞 Supporto

Per problemi o domande:
- Controlla i logs su Vercel Dashboard
- Verifica configurazione WhatsApp nel database
- Testa manualmente l'endpoint `/api/cron/hours-reminder`

---

✅ **Cron Job configurato e attivo!**



