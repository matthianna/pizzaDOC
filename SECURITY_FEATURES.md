# 🔒 Sistema di Sicurezza e Audit

Questo documento descrive le funzionalità di sicurezza implementate nel sistema PizzaDOC.

## 📋 Indice

1. [Sistema di Audit Log](#sistema-di-audit-log)
2. [Doppia Conferma](#doppia-conferma)
3. [Sistema di Backup Automatico](#sistema-di-backup-automatico)
4. [Configurazione](#configurazione)

---

## 🔍 Sistema di Audit Log

### Descrizione
Ogni azione sensibile viene registrata in un log di audit che traccia:
- ✅ **Utente** che ha eseguito l'azione
- ✅ **IP Address** da cui è stata eseguita
- ✅ **User Agent** (browser/dispositivo)
- ✅ **Timestamp** preciso
- ✅ **Descrizione** dell'azione
- ✅ **Metadata** aggiuntivi (JSON)

### Azioni Tracciate

| Azione | Descrizione |
|--------|-------------|
| `SCHEDULE_GENERATE` | Generazione nuovo piano settimanale |
| `SCHEDULE_DELETE` | Eliminazione piano settimanale |
| `SHIFT_ADD` | Aggiunta turno manuale |
| `SHIFT_DELETE` | Eliminazione turno |
| `SHIFT_EDIT` | Modifica turno |
| `USER_CREATE` | Creazione nuovo utente |
| `USER_DELETE` | Eliminazione utente |
| `USER_EDIT` | Modifica utente |
| `HOURS_APPROVE` | Approvazione ore lavorate |
| `HOURS_REJECT` | Rifiuto ore lavorate |
| `HOURS_EDIT` | Modifica ore lavorate |
| `ABSENCE_CREATE` | Creazione assenza |
| `ABSENCE_DELETE` | Eliminazione assenza |
| `ABSENCE_EDIT` | Modifica assenza |
| `SUBSTITUTION_APPROVE` | Approvazione sostituzione |
| `SUBSTITUTION_REJECT` | Rifiuto sostituzione |
| `DATABASE_RESET` | Reset completo database |
| `DATABASE_BACKUP` | Creazione backup manuale |
| `SETTINGS_CHANGE` | Modifica impostazioni sistema |

### API Endpoint

```typescript
GET /api/admin/audit-logs
```

**Query Parameters:**
- `userId` - Filtra per utente specifico
- `action` - Filtra per tipo di azione
- `startDate` - Data inizio range
- `endDate` - Data fine range
- `limit` - Numero risultati (default: 50)
- `offset` - Offset paginazione (default: 0)

**Esempio:**
```bash
GET /api/admin/audit-logs?action=SCHEDULE_GENERATE&limit=20
```

### Utilizzo nel Codice

```typescript
import { logAuditAction } from '@/lib/audit-logger'

await logAuditAction({
  userId: session.user.id,
  userUsername: session.user.username,
  action: 'SCHEDULE_GENERATE',
  description: 'Generato piano settimanale per 2025-10-13',
  metadata: {
    weekStart: '2025-10-13',
    shiftsGenerated: 82,
    quality: 95
  }
})
```

---

## ⚠️ Doppia Conferma

### Descrizione
Sistema di doppia conferma per azioni critiche e irreversibili.

### Funzionalità
- 🔒 L'utente deve digitare esattamente una frase di conferma
- ⏱️ Previene azioni accidentali
- 📱 UI responsive e chiara
- 🚫 Impossibile procedere senza conferma corretta

### Azioni che Richiedono Conferma

1. **Generazione Piano Settimanale** - Frase: `GENERA PIANO`
2. **Eliminazione Piano** - Frase: `ELIMINA PIANO`
3. **Reset Database** - Frase: `ELIMINA TUTTO`

### Utilizzo del Componente

```tsx
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

const [showConfirm, setShowConfirm] = useState(false)

<ConfirmationModal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={async () => {
    await executeAction()
  }}
  title="Genera Piano Settimanale"
  description="Stai per generare un nuovo piano. Se esiste già un piano per questa settimana, verrà sostituito."
  confirmPhrase="GENERA PIANO"
  confirmButtonText="Genera Piano"
  isDangerous={true}
  metadata={
    <div>
      <p><strong>Settimana:</strong> 6 - 12 Ottobre 2025</p>
      <p><strong>Turni da creare:</strong> ~80</p>
    </div>
  }
/>
```

---

## 💾 Sistema di Backup Automatico

### Descrizione
Backup automatico giornaliero del database PostgreSQL (Neon).

### Funzionalità

#### 🤖 Backup Automatici
- ⏰ **Frequenza:** Ogni giorno alle 2:00 AM (UTC)
- 📁 **Formato:** SQL dump completo
- 🗄️ **Storage:** Directory `/backups`
- 🧹 **Pulizia automatica:** Mantiene solo ultimi 30 giorni
- 📊 **Formato file:** `neon_backup_YYYYMMDD_HHMMSS.sql`

#### 👤 Backup Manuali
Gli admin possono creare backup manuali in qualsiasi momento.

### API Endpoints

#### Crea Backup Manuale
```typescript
POST /api/admin/database/backup
```

**Response:**
```json
{
  "success": true,
  "message": "Backup creato con successo",
  "filePath": "/backups/neon_backup_20251009_143022.sql",
  "size": 2457600,
  "sizeReadable": "2.34 MB"
}
```

#### Lista Backup Disponibili
```typescript
GET /api/admin/database/backup
```

**Response:**
```json
{
  "backups": [
    {
      "filename": "neon_backup_20251009_143022.sql",
      "path": "/backups/neon_backup_20251009_143022.sql",
      "size": 2457600,
      "sizeReadable": "2.34 MB",
      "createdAt": "2025-10-09T14:30:22.000Z"
    }
  ],
  "total": 1
}
```

#### Elimina Backup Vecchi
```typescript
DELETE /api/admin/database/backup?days=30
```

### Cron Job (Vercel)

Il backup automatico è configurato in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-backup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Configurazione su Vercel:**
1. Il cron job è già configurato
2. Su Vercel, vai su **Project Settings** > **Cron Jobs**
3. Verifica che il cron `/api/cron/daily-backup` sia attivo
4. (Opzionale) Aggiungi `CRON_SECRET` nelle environment variables per sicurezza

### Ripristino da Backup

Per ripristinare da un backup:

```bash
# 1. Scarica il backup dal server
scp user@server:/backups/neon_backup_20251009_143022.sql ./

# 2. Ripristina su Neon
psql "postgresql://user:pass@host/db?sslmode=require" < neon_backup_20251009_143022.sql
```

---

## ⚙️ Configurazione

### Environment Variables

Aggiungi al file `.env`:

```env
# Cron Secret (opzionale ma consigliato)
CRON_SECRET=your_random_secret_here

# Database URL (già configurato)
DATABASE_URL=postgresql://...
```

### Permessi

Solo gli utenti con ruolo **ADMIN** possono:
- ✅ Visualizzare audit logs
- ✅ Creare backup manuali
- ✅ Vedere lista backup
- ✅ Eliminare backup vecchi

### Sicurezza

1. **Audit Logs:**
   - ✅ Immutabili (non possono essere modificati)
   - ✅ Tracciamento completo IP + User Agent
   - ✅ Metadata in formato JSON per estensibilità

2. **Backup:**
   - ✅ Formato SQL standard (compatibile con qualsiasi tool PostgreSQL)
   - ✅ Pulizia automatica per non riempire lo storage
   - ✅ Cron protetto con secret token (opzionale)

3. **Doppia Conferma:**
   - ✅ Case-sensitive (deve essere esatto)
   - ✅ Previene azioni accidentali
   - ✅ UI chiara e informativa

---

## 📊 Monitoraggio

### Verifica Funzionamento

1. **Audit Logs:**
   ```bash
   curl -H "Cookie: ..." https://pizzadoc.vercel.app/api/admin/audit-logs
   ```

2. **Backup:**
   ```bash
   curl -X POST -H "Cookie: ..." https://pizzadoc.vercel.app/api/admin/database/backup
   ```

3. **Cron Job:**
   - Vai su Vercel Dashboard > Project > Cron Jobs
   - Verifica ultimo run e stato

---

## 🛠️ Manutenzione

### Pulizia Backup Vecchi

```bash
# Mantieni solo ultimi 7 giorni
curl -X DELETE "https://pizzadoc.vercel.app/api/admin/database/backup?days=7"
```

### Esportazione Audit Logs

Per esportare i log di audit per analisi:

```bash
curl "https://pizzadoc.vercel.app/api/admin/audit-logs?limit=1000" > audit_logs.json
```

---

## 📝 Note

- I backup sono salvati nella directory `/backups` del progetto
- Su Vercel, lo storage è temporaneo. Considera S3/Google Cloud Storage per persistenza
- I log di audit sono nel database Neon e persistono indefinitamente
- Considera di aggiungere un sistema di archiviazione/pulizia log vecchi in futuro

---

## 🚀 Prossimi Miglioramenti

- [ ] Notifiche email per backup falliti
- [ ] Export audit logs in CSV/PDF
- [ ] Dashboard di monitoraggio in tempo reale
- [ ] Storage permanente backup su S3
- [ ] Sistema di restore automatico da UI
- [ ] Audit log retention policy (es. 90 giorni)

