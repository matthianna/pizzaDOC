# 🧪 Test Promemoria Ore Lavorate

## 📋 Come Testare il Messaggio Senza Inviarlo

Ho creato un endpoint di test che ti permette di vedere esattamente quale messaggio verrebbe inviato, **senza** inviarlo realmente al gruppo WhatsApp.

---

## 🚀 Come Usare

### **Metodo 1: Browser (CONSIGLIATO)**

1. **Accedi come Admin** su https://pizzadoc.vercel.app
2. **Apri questa URL** in una nuova tab:
   ```
   https://pizzadoc.vercel.app/api/cron/hours-reminder/test
   ```
3. Vedrai il messaggio in formato JSON

### **Metodo 2: Locale**

```bash
# 1. Avvia il server
npm run dev

# 2. Accedi come admin su http://localhost:3000

# 3. Apri in una nuova tab:
http://localhost:3000/api/cron/hours-reminder/test
```

---

## 📊 Esempio Response

```json
{
  "testMode": true,
  "timestamp": "2025-10-23T14:30:00.000Z",
  "statistics": {
    "shiftsWithoutHours": 5,
    "shiftsWithRejectedHours": 2,
    "totalShifts": 7,
    "usersWithMissingHours": 3
  },
  "whatsappConfig": {
    "notificationsEnabled": true,
    "groupConfigured": true,
    "groupChatId": "41789746890-1606996838@g.us"
  },
  "wouldSendMessage": true,
  "message": "⏰ *PROMEMORIA ORE LAVORATE*\n\n📋 Questi dipendenti devono ancora inserire le ore:\n\n• *mario.rossi* - 3 turni\n• *giulia* - 2 turni\n• *valentino.dipietro* - 1 turno\n\n📝 Inserisci le ore su:\nhttps://pizzadoc.vercel.app/hours",
  "users": [
    { "username": "mario.rossi", "count": 3 },
    { "username": "giulia", "count": 2 },
    { "username": "valentino.dipietro", "count": 1 }
  ],
  "reasons": {
    "noMissingHours": false,
    "whatsappDisabled": false,
    "groupNotConfigured": false
  }
}
```

---

## 📖 Spiegazione Campi

### **statistics**
- `shiftsWithoutHours`: Turni senza ore inserite
- `shiftsWithRejectedHours`: Turni con ore rifiutate
- `totalShifts`: Totale turni problematici
- `usersWithMissingHours`: Numero dipendenti da contattare

### **whatsappConfig**
- `notificationsEnabled`: Se WhatsApp è abilitato nel DB
- `groupConfigured`: Se il gruppo è configurato
- `groupChatId`: ID del gruppo WhatsApp

### **wouldSendMessage**
- `true`: Il messaggio verrebbe inviato in produzione
- `false`: Il messaggio NON verrebbe inviato

### **message**
- Il testo **esatto** che verrebbe inviato al gruppo
- Con formattazione WhatsApp (`*grassetto*`)

### **users**
- Lista dettagliata dipendenti con ore mancanti
- Ordinata per numero turni mancanti (decrescente)

### **reasons**
- Motivi per cui il messaggio potrebbe non essere inviato:
  - `noMissingHours`: Nessuno ha ore mancanti
  - `whatsappDisabled`: Notifiche WhatsApp disabilitate
  - `groupNotConfigured`: Gruppo non configurato

---

## 🔍 Visualizzare il Messaggio in Modo Leggibile

### **Opzione 1: Copia il campo `message`**
1. Copia il valore del campo `message` dalla response
2. Incollalo in un editor di testo
3. Le `\n` sono "a capo" (new line)

### **Opzione 2: Browser con estensione JSON**
Installa un'estensione come:
- [JSON Viewer](https://chrome.google.com/webstore/detail/json-viewer) (Chrome)
- [JSONView](https://addons.mozilla.org/it/firefox/addon/jsonview/) (Firefox)

### **Opzione 3: Usa jq (Terminal)**
```bash
curl -s "https://pizzadoc.vercel.app/api/cron/hours-reminder/test" \
  --cookie "next-auth.session-token=YOUR_SESSION_TOKEN" \
  | jq -r '.message'
```

Output:
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

## 🎨 Come Apparirà su WhatsApp

Il messaggio su WhatsApp apparirà così:

```
⏰ PROMEMORIA ORE LAVORATE

📋 Questi dipendenti devono ancora inserire le ore:

• mario.rossi - 3 turni        ← (grassetto)
• giulia - 2 turni             ← (grassetto)
• valentino.dipietro - 1 turno ← (grassetto)

📝 Inserisci le ore su:
https://pizzadoc.vercel.app/hours
```

---

## ✅ Cosa Verificare

Prima di attivare il cron in produzione:

1. **✅ Messaggio formattato correttamente**
   - I nomi utente sono giusti?
   - Il conteggio turni è corretto?
   - Il link funziona?

2. **✅ Configurazione WhatsApp**
   - `notificationsEnabled: true`
   - `groupConfigured: true`
   - `wouldSendMessage: true`

3. **✅ Utenti corretti**
   - Solo utenti con `trackHours: true`
   - Solo utenti attivi
   - Admin esclusi

---

## 🔒 Sicurezza

- ✅ **Solo Admin** possono accedere al test
- ✅ Nessun messaggio viene inviato realmente
- ✅ Nessuna modifica al database
- ✅ Solo lettura dei dati

---

## 🐛 Troubleshooting

### **Errore 401 Unauthorized**
- Assicurati di essere loggato come **Admin**
- Ricarica la sessione se necessario

### **"Nessun messaggio da inviare"**
- Significa che non ci sono ore mancanti
- Puoi testare creando un turno passato senza ore

### **`wouldSendMessage: false`**
Verifica:
1. Notifiche WhatsApp abilitate nel DB
2. Gruppo WhatsApp configurato

---

## 🚀 Dopo il Test

Quando sei soddisfatto del messaggio:

1. **Fai il deploy** su Vercel
2. Il cron si attiverà **automaticamente**
3. Ogni giovedì alle 15:00 CEST il messaggio verrà inviato

---

✅ **Test completo senza rischi!**



