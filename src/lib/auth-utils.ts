import { Session } from 'next-auth'

/**
 * Verifica se l'utente è un amministratore
 * @param session - La sessione dell'utente
 * @returns true se l'utente è admin, false altrimenti
 */
export function isAdmin(session: Session | null): boolean {
  if (!session?.user?.roles) {
    return false
  }
  return session.user.roles.includes('ADMIN')
}

/**
 * Verifica se l'utente ha un ruolo specifico
 * @param session - La sessione dell'utente
 * @param role - Il ruolo da verificare
 * @returns true se l'utente ha il ruolo, false altrimenti
 */
export function hasRole(session: Session | null, role: string): boolean {
  if (!session?.user?.roles) {
    return false
  }
  return session.user.roles.includes(role)
}

/**
 * Verifica se l'utente ha uno dei ruoli specificati
 * @param session - La sessione dell'utente
 * @param roles - Array di ruoli da verificare
 * @returns true se l'utente ha almeno uno dei ruoli, false altrimenti
 */
export function hasAnyRole(session: Session | null, roles: string[]): boolean {
  if (!session?.user?.roles) {
    return false
  }
  return roles.some(role => session.user.roles.includes(role))
}

/**
 * Verifica se l'utente è autenticato e ha i ruoli necessari
 * @param session - La sessione dell'utente
 * @param requiredRoles - Ruoli richiesti (opzionale, default: ['ADMIN'])
 * @returns true se l'utente è autenticato e ha i ruoli necessari
 */
export function isAuthenticatedWithRoles(
  session: Session | null, 
  requiredRoles: string[] = ['ADMIN']
): boolean {
  if (!session?.user) {
    return false
  }
  return hasAnyRole(session, requiredRoles)
}
