# 🧪 Test Availability Reminder Cron

## 📋 Overview

Endpoint di test per visualizzare il messaggio del cron availability-reminder **senza inviarlo realmente su WhatsApp**.

---

## 🔗 Endpoint

```
GET /api/cron/availability-reminder/test
```

**Nessuna autenticazione richiesta** (è un endpoint di test)

---

## 🚀 Come Usarlo

### **Opzione 1: Browser**

Apri nel browser:
```
http://localhost:3000/api/cron/availability-reminder/test
```

Oppure in produzione:
```
https://pizzadoc.vercel.app/api/cron/availability-reminder/test
```

### **Opzione 2: cURL**

```bash
curl http://localhost:3000/api/cron/availability-reminder/test
```

Oppure in produzione:
```bash
curl https://pizzadoc.vercel.app/api/cron/availability-reminder/test
```

---

## 📊 Risposta JSON

L'endpoint restituisce un JSON con:

```json
{
  "success": true,
  "test": true,
  "info": {
    "weekStart": "2025-10-27T00:00:00.000Z",
    "weekEnd": "2025-11-02T00:00:00.000Z",
    "totalActiveUsers": 15,
    "usersWithoutAvailability": 8,
    "notificationsEnabled": true,
    "groupChatId": "41789746890-1606996838@g.us",
    "wouldSendMessage": true
  },
  "users": {
    "withoutAvailability": [
      {
        "username": "mario.rossi",
        "phoneNumber": "+41791234567",
        "hasAvailability": false,
        "absencesCount": 0
      },
      {
        "username": "luigi.bianchi",
        "phoneNumber": "+41791234568",
        "hasAvailability": false,
        "absencesCount": 2
      }
    ],
    "skippedDueToFullWeekAbsence": [
      {
        "username": "carlo.verdi",
        "coveredDays": 7
      }
    ]
  },
  "message": {
    "text": "⏰ *PROMEMORIA DISPONIBILITÀ*\n\n📅 Ricordatevi di inserire le vostre disponibilità per la prossima settimana.\n\n👥 *Utenti che non hanno ancora inserito le disponibilità:*\n• mario.rossi\n• luigi.bianchi\n\n🔗 Inserisci le tue disponibilità: https://pizzadoc.vercel.app/availability",
    "length": 245
  }
}
```

---

## 📖 Campi Spiegati

### **info**
- `weekStart`: Inizio settimana prossima (lunedì)
- `weekEnd`: Fine settimana prossima (domenica)
- `totalActiveUsers`: Numero totale utenti attivi
- `usersWithoutAvailability`: Utenti senza disponibilità (che riceveranno il messaggio)
- `notificationsEnabled`: WhatsApp notifiche abilitate
- `groupChatId`: ID gruppo WhatsApp
- `wouldSendMessage`: Se il messaggio verrebbe inviato realmente

### **users.withoutAvailability**
Lista utenti che **RICEVERANNO** il messaggio:
- Utenti attivi
- Senza disponibilità per la prossima settimana
- Non sono "admin"
- Non hanno assenze per tutti i 7 giorni

### **users.skippedDueToFullWeekAbsence**
Lista utenti **ESCLUSI** perché hanno assenze per tutti i 7 giorni della settimana

### **message.text**
Il testo esatto del messaggio che verrebbe inviato su WhatsApp

---

## 🔍 Cosa Controlla

1. ✅ Calcola la prossima settimana (da lunedì a domenica)
2. ✅ Trova utenti attivi senza disponibilità
3. ✅ Esclude utente "admin"
4. ✅ Esclude utenti con assenze per tutti i 7 giorni
5. ✅ Calcola correttamente assenze che si sovrappongono (es. assenza da venerdì a mercoledì)
6. ✅ Genera il messaggio formattato per WhatsApp

---

## 🎯 Esempi di Logica

### **Utente Mario**
- Disponibilità inserita: ❌ No
- Assenze: Nessuna
- Risultato: ✅ **Appare nella lista**

### **Utente Luigi**
- Disponibilità inserita: ❌ No
- Assenze: Lunedì-Sabato (6 giorni)
- Risultato: ✅ **Appare nella lista** (può lavorare domenica)

### **Utente Carlo**
- Disponibilità inserita: ❌ No
- Assenze: Lunedì-Domenica (7 giorni)
- Risultato: ❌ **NON appare** (settimana completa off)

### **Utente Anna**
- Disponibilità inserita: ✅ Sì
- Assenze: Nessuna
- Risultato: ❌ **NON appare** (ha già inserito)

### **Utente Admin**
- Disponibilità inserita: ❌ No
- Assenze: Nessuna
- Risultato: ❌ **NON appare** (è admin)

---

## ⚠️ Note Importanti

- **NON invia messaggi realmente** su WhatsApp
- Calcola sempre la "settimana prossima" (da lunedì prossimo a domenica prossima)
- Le assenze devono essere **approvate** per essere considerate
- Le assenze possono essere periodi multipli (es. 3 assenze separate che coprono 7 giorni totali)

---

## 🔄 Differenza con il Cron Reale

| Aspetto | Test Endpoint | Cron Reale |
|---------|--------------|------------|
| Autenticazione | ❌ No | ✅ Sì (x-vercel-cron o CRON_SECRET) |
| Invia WhatsApp | ❌ No | ✅ Sì |
| Ritorna JSON | ✅ Sì (dettagliato) | ✅ Sì (base) |
| Mostra messaggio | ✅ Sì | ❌ No |
| Lista utenti | ✅ Sì (dettagliata) | ❌ No |
| Schedule | ❌ No | ✅ Domenica 12:10 UTC / Sabato 14:30 UTC |

---

## 🎨 Formato Messaggio WhatsApp

Il messaggio usa la formattazione WhatsApp:
- `*Testo*` = **Grassetto**
- `\n` = A capo
- `•` = Bullet point

Esempio:
```
⏰ *PROMEMORIA DISPONIBILITÀ*

📅 Ricordatevi di inserire le vostre disponibilità per la prossima settimana.

👥 *Utenti che non hanno ancora inserito le disponibilità:*
• damiano.crivelli
• fred.nunez
• yannick.iannarella

🔗 Inserisci le tue disponibilità: https://pizzadoc.vercel.app/availability
```

---

## 🐛 Troubleshooting

### **Errore: Cannot read properties of undefined**
- Controlla che `startDate` e `endDate` esistano nelle assenze
- Verifica che la query Prisma includa `select: { startDate: true, endDate: true }`

### **Nessun utente nella lista ma dovrebbero esserci**
- Controlla se hanno già inserito disponibilità
- Verifica se sono utenti attivi (`isActive: true`)
- Controlla se l'utente è "admin"
- Verifica se hanno assenze per tutti i 7 giorni

### **Utenti con assenze parziali non appaiono**
- Assicurati che le assenze siano approvate
- Controlla che `coveredDays.size < 7` nel filtro

---

## 📚 Risorse Correlate

- **Cron reale**: `/api/cron/availability-reminder`
- **Vercel Cron config**: `vercel.json`
- **Test Hours Reminder**: `/api/cron/hours-reminder/test`

---

**Ultima modifica**: 26 Ottobre 2025

