/** Italian labels + visual tone for audit actions. */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  SCHEDULE_GENERATE: 'Piano generato',
  SCHEDULE_DELETE: 'Piano eliminato',
  SHIFT_ADD: 'Turno aggiunto',
  SHIFT_DELETE: 'Turno rimosso',
  SHIFT_EDIT: 'Turno modificato',
  HOURS_APPROVE: 'Ore approvate',
  HOURS_REJECT: 'Ore rifiutate',
  HOURS_EDIT: 'Ore modificate',
  USER_CREATE: 'Utente creato',
  USER_DELETE: 'Utente eliminato',
  USER_EDIT: 'Utente modificato',
  DATABASE_BACKUP: 'Backup database',
  DATABASE_RESET: 'Reset database',
  ABSENCE_CREATE: 'Assenza creata',
  ABSENCE_EDIT: 'Assenza modificata',
  ABSENCE_DELETE: 'Assenza eliminata',
  ABSENCE_APPROVE: 'Assenza approvata',
  ABSENCE_REJECT: 'Assenza rifiutata',
  SUBSTITUTION_APPROVE: 'Sostituzione approvata',
  SUBSTITUTION_REJECT: 'Sostituzione rifiutata',
  SETTINGS_CHANGE: 'Impostazione / acconto',
  HOLIDAY_CREATE: 'Chiusura creata',
  HOLIDAY_EDIT: 'Chiusura modificata',
  HOLIDAY_DELETE: 'Chiusura eliminata',
  SCOOTER_USAGE_CREATE: 'Uso scooter creato',
  SCOOTER_USAGE_EDIT: 'Uso scooter modificato',
  SCOOTER_USAGE_DELETE: 'Uso scooter eliminato',
  TASK_RUN: 'Task eseguito',
}

export type AuditTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export function getAuditActionTone(action: string): AuditTone {
  if (
    action.includes('APPROVE') ||
    action === 'SCHEDULE_GENERATE' ||
    action === 'USER_CREATE' ||
    action === 'DATABASE_BACKUP' ||
    action === 'HOLIDAY_CREATE' ||
    action === 'SHIFT_ADD'
  ) {
    return 'success'
  }
  if (
    action.includes('REJECT') ||
    action.includes('DELETE') ||
    action === 'DATABASE_RESET'
  ) {
    return 'danger'
  }
  if (action.includes('EDIT') || action === 'SETTINGS_CHANGE' || action === 'TASK_RUN') {
    return 'warning'
  }
  if (action.startsWith('ABSENCE') || action.startsWith('SUBSTITUTION') || action.startsWith('HOURS')) {
    return 'accent'
  }
  return 'neutral'
}

export const AUDIT_TONE_STYLE: Record<
  AuditTone,
  { color: string; bg: string }
> = {
  neutral: { color: 'var(--pd-muted)', bg: 'var(--pd-surface-muted)' },
  accent: { color: 'var(--pd-accent)', bg: 'var(--pd-accent-soft)' },
  success: { color: 'var(--pd-success)', bg: 'var(--pd-success-soft)' },
  warning: { color: 'var(--pd-warning)', bg: 'var(--pd-warning-soft)' },
  danger: { color: 'var(--pd-danger)', bg: 'var(--pd-danger-soft)' },
}

const META_LABELS: Record<string, string> = {
  weekStart: 'Inizio settimana',
  shiftsGenerated: 'Turni generati',
  totalShifts: 'Turni totali',
  quality: 'Qualità',
  shiftsDeleted: 'Turni eliminati',
  shiftId: 'ID turno',
  userId: 'ID utente',
  username: 'Utente',
  targetUserId: 'ID destinatario',
  targetUsername: 'Destinatario',
  roles: 'Ruoli',
  primaryRole: 'Ruolo primario',
  transports: 'Mezzi',
  isActive: 'Attivo',
  trackHours: 'Traccia ore',
  pushNotificationsEnabled: 'Push',
  workedHoursId: 'ID ore',
  startTime: 'Inizio',
  endTime: 'Fine',
  totalHours: 'Ore totali',
  before: 'Prima',
  after: 'Dopo',
  rejectionReason: 'Motivo rifiuto',
  responseNote: 'Nota',
  source: 'Origine',
  fromRejected: 'Da rifiutate',
  fromPending: 'Da in attesa',
  absenceId: 'ID assenza',
  startDate: 'Data inizio',
  endDate: 'Data fine',
  holidayId: 'ID chiusura',
  date: 'Data',
  closureType: 'Tipo chiusura',
  description: 'Descrizione',
  changes: 'Modifiche',
  advanceId: 'ID acconto',
  amount: 'Importo',
  oldAmount: 'Importo precedente',
  newAmount: 'Importo nuovo',
  oldDate: 'Data precedente',
  newDate: 'Data nuova',
  notes: 'Note',
  key: 'Chiave',
  oldValue: 'Valore precedente',
  newValue: 'Valore nuovo',
  settingKey: 'Impostazione',
  limitsCount: 'Limiti aggiornati',
  distributionsCount: 'Distribuzioni aggiornate',
  dayOfWeek: 'Giorno',
  shiftType: 'Turno',
  role: 'Reparto',
  reason: 'Motivo',
  substitutionId: 'ID sostituzione',
  requesterId: 'ID richiedente',
  requesterUsername: 'Richiedente',
  substituteId: 'ID sostituto',
  substituteUsername: 'Sostituto',
  previousStatus: 'Stato precedente',
  taskId: 'ID task',
  success: 'Esito',
  result: 'Risultato',
  timestamp: 'Timestamp',
  tables: 'Tabelle',
  usersNotified: 'Notificati',
  totalUsers: 'Utenti totali',
  failedCount: 'Falliti',
  usernames: 'Usernames',
  errors: 'Errori',
  usedCustomPassword: 'Password personalizzata',
  forcedFirstLogin: 'Primo accesso forzato',
  requiredStaff: 'Personale richiesto',
}

export function labelAuditMetaKey(key: string): string {
  return META_LABELS[key] || key
}

export function formatAuditMetaValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Sì' : 'No'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        return new Date(value).toLocaleString('it-IT', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return value
      }
    }
    return value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return value.join(', ')
    }
    return JSON.stringify(value)
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 0)
    } catch {
      return String(value)
    }
  }
  return String(value)
}
