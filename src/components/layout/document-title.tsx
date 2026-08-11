'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const TITLE_SUFFIX = 'Pizza D.O.C.'

/** Path prefix → document title (longest match wins). */
const ROUTE_TITLES: Array<{ match: string | RegExp; title: string }> = [
  { match: '/auth/signin', title: 'Accedi' },
  { match: '/auth/first-login', title: 'Cambia password' },
  { match: '/auth/error', title: 'Errore di accesso' },
  { match: '/offline', title: 'Offline' },
  { match: '/dashboard', title: 'Home' },
  { match: '/availability-overview', title: 'Disponibilità utenti' },
  { match: '/availability', title: 'Disponibilità' },
  { match: '/weekly-plan', title: 'Piano settimanale' },
  { match: '/schedule', title: 'Mio piano' },
  { match: '/hours', title: 'Le mie ore' },
  { match: '/absences', title: 'Assenze' },
  { match: '/substitution-requests', title: 'Sostituzioni' },
  { match: '/notifications', title: 'Notifiche' },
  { match: /^\/profile\//, title: 'Profilo' },
  { match: '/admin/schedule', title: 'Piano lavoro' },
  { match: '/admin/users', title: 'Gestione utenti' },
  { match: '/admin/absences', title: 'Assenze' },
  { match: '/admin/substitutions', title: 'Sostituzioni' },
  { match: '/admin/hours-summary', title: 'Riepilogo ore' },
  { match: '/admin/hours', title: 'Gestione ore' },
  { match: '/admin/advances', title: 'Acconti' },
  { match: '/admin/settings', title: 'Configurazioni' },
  { match: '/admin/system', title: 'Sistema e sicurezza' },
  { match: '/admin/notifications/all', title: 'Centro notifiche' },
  { match: '/admin/notifications', title: 'Invia broadcast' },
  { match: '/design-preview', title: 'Anteprima design' },
]

function titleForPath(pathname: string): string {
  let best: { len: number; title: string } | null = null
  for (const entry of ROUTE_TITLES) {
    if (typeof entry.match === 'string') {
      if (pathname === entry.match || pathname.startsWith(entry.match + '/')) {
        const len = entry.match.length
        if (!best || len > best.len) best = { len, title: entry.title }
      }
    } else if (entry.match.test(pathname)) {
      const len = pathname.length
      if (!best || len > best.len) best = { len, title: entry.title }
    }
  }
  return best ? `${best.title} — ${TITLE_SUFFIX}` : TITLE_SUFFIX
}

/** Sets `document.title` from the current route. */
export function DocumentTitle({ override }: { override?: string }) {
  const pathname = usePathname()

  useEffect(() => {
    document.title = override?.trim()
      ? `${override.trim()} — ${TITLE_SUFFIX}`
      : titleForPath(pathname || '/')
  }, [pathname, override])

  return null
}
