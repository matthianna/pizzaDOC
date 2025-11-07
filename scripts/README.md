# 📋 Scripts PizzaDOC

Questa cartella contiene gli script di utilità per configurare e gestire il database di PizzaDOC.

## 🚀 Script Principali

### 1. Setup Completo Database
```bash
npm run setup:database
```

**Cosa fa:**
- ✅ Crea tutti gli utenti del sistema con credenziali
- ✅ Configura impostazioni di sistema (limiti scooter, auto, etc.)
- ✅ Imposta limiti turni per ogni ruolo
- ✅ Configura distribuzioni orari di inizio

**Utenti creati:**
- `admin` (password: `admin`)
- `Mario` (Pizzaiolo/Cucina, password: `mario`)
- `Valentino` (Pizzaiolo, password: `valentino`)
- `Luis` (Fattorino Auto, password: `luis`)
- `Matthias` (Fattorino Scooter, password: `matthias`)
- E molti altri...

**Quando usarlo:** All'inizio per inizializzare un database vuoto.

---

### 2. Generatore Disponibilità
```bash
npm run generate:availability
```

**Cosa fa:**
- ✅ Genera disponibilità per tutti gli utenti attivi
- ✅ Ogni utente sarà disponibile per TUTTI i turni della settimana
- ✅ Configurable per settimane specifiche

**Come configurare:**
1. Apri `scripts/generate-availability.ts`
2. Modifica la riga:
   ```typescript
   const WEEK_START_DATE = new Date('2025-01-06') // Cambia questa data
   ```
3. Assicurati che sia un **LUNEDÌ**
4. Esegui lo script

**Quando usarlo:** Prima di generare un nuovo piano turni.

---

### 3. Reset Completo Database
```bash
npm run reset:database
```

**⚠️ ATTENZIONE: Elimina TUTTO il contenuto del database!**

**Cosa fa:**
- 🗑️ Elimina tutti gli utenti e credenziali
- 🗑️ Elimina tutti i piani turni e disponibilità
- 🗑️ Elimina tutte le ore lavorate e sostituzioni
- 🗑️ Elimina tutte le impostazioni e configurazioni
- 🔒 Richiede conferma manuale per sicurezza

**Come usare:**
1. ⚠️ **IMPORTANTE:** Fai backup se necessario
2. Esegui: `npm run reset:database`
3. Digita esattamente: `ELIMINA TUTTO`
4. Attendi completamento
5. Ricrea tutto con `npm run setup:database`

**Quando usarlo:** 
- Reset completo per testing
- Pulizia prima del deploy
- Ripartire da zero con dati freschi

---

---

### 4. Test Configurazione WAHA
```bash
npx tsx scripts/test-waha.ts
```

**Cosa fa:**
- ✅ Verifica che WAHA_URL sia configurato
- ✅ Testa la connessione con WAHA su Railway
- ✅ Controlla lo stato della sessione WhatsApp
- ✅ Mostra diagnostica dettagliata

**Con test di invio:**
```bash
npx tsx scripts/test-waha.ts +41791234567
```

**Quando usarlo:**
- Dopo aver riconfigurato WAHA su Railway
- Per verificare che WhatsApp sia connesso
- Per testare l'invio di messaggi
- Per debug problemi di notifiche

**Guida setup completo:** Vedi `WAHA_RICONFIGURAZIONE.md`

---

## 🗂️ File nella cartella

| File | Descrizione | Comando |
|------|-------------|---------|
| `setup-database.ts` | Setup completo del sistema | `npm run setup:database` |
| `generate-availability.ts` | Genera disponibilità settimanale | `npm run generate:availability` |
| `reset-database.ts` | ⚠️ Reset completo (elimina tutto) | `npm run reset:database` |
| `test-waha.ts` | 🆕 Test configurazione WAHA/WhatsApp | `npx tsx scripts/test-waha.ts` |
| `seed.ts` | Script base Prisma (legacy) | `npm run seed` |

## 🔄 Workflow Tipico

### Prima installazione:
```bash
# 1. Setup database
npm run db:push
npm run setup:database

# 2. Genera disponibilità per la settimana corrente
npm run generate:availability

# 3. Accedi come admin e genera il piano turni
# http://localhost:3000 -> admin/admin
```

### Nuova settimana:
```bash
# 1. Modifica la data in generate-availability.ts
# 2. Genera disponibilità
npm run generate:availability

# 3. Genera nuovo piano turni dall'admin
```

### Reset completo (per testing/sviluppo):
```bash
# ⚠️ ATTENZIONE: Elimina tutto!
npm run reset:database

# Ricrea sistema da zero
npm run setup:database
npm run generate:availability
```

## ⚙️ Configurazioni

### Limiti di default:
- **Scooter disponibili:** 4
- **Auto disponibili:** 10
- **Turni max/settimana:** 6

### Orari configurati:
- **Pranzo:** 11:00-14:00
- **Cena:** 17:00-22:00

### Vincoli orari:
- **Fattorini:** Inizio dalle 18:00 per la cena
- **Pizzaiolo/Cucina:** Max 1 persona alle 17:00 per la cena
- **Orari:** Solo mezze ore (:00, :30)

## 🐛 Troubleshooting

### "Data non è un Lunedì"
- Assicurati che `WEEK_START_DATE` sia un Lunedì
- Usa un calcolatore di date online per verificare

### "Utente già esistente"
- Il setup è idempotente, puoi rilanciarlo senza problemi
- Gli utenti esistenti vengono aggiornati, non duplicati

### "Disponibilità già esistenti"
- Lo script elimina automaticamente disponibilità esistenti
- Configura `CLEAR_EXISTING = false` per disabilitare

## 📞 Supporto

Per problemi con gli script:
1. Verifica che il database sia attivo
2. Controlla che Prisma sia aggiornato: `npm run db:generate`
3. Verifica i log per errori specifici

---

*Scripts mantenuti e aggiornati per PizzaDOC v1.0*
