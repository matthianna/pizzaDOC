'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home,
  Calendar,
  LayoutGrid,
  CalendarDays,
  Menu,
  Bell,
  ArrowLeft,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ThemeToggle } from './theme-toggle'
import { useDesignPreviewTheme } from './theme-provider'

const SIDEBAR_EXTRA = ['Ore', 'Assenze', 'Sostituzioni', 'Profilo']

type PreviewShellProps = {
  children: ReactNode
  title: string
  subtitle?: string
}

export function PreviewShell({ children, title, subtitle }: PreviewShellProps) {
  const pathname = usePathname()
  const { basePath } = useDesignPreviewTheme()
  const [showMore, setShowMore] = useState(false)

  const nav = [
    { name: 'Home', href: `${basePath}/dashboard`, icon: Home },
    { name: 'Settimana', href: `${basePath}/dashboard`, icon: Calendar, mock: true },
    { name: 'Mio Piano', href: `${basePath}/dashboard`, icon: LayoutGrid, mock: true },
    { name: 'Disponibilità', href: `${basePath}/availability`, icon: CalendarDays },
  ]

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      <aside
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r"
        style={{
          background: 'var(--pd-surface)',
          borderColor: 'var(--pd-border)',
        }}
      >
        <div className="flex items-center gap-3 px-5 py-6 border-b" style={{ borderColor: 'var(--pd-border)' }}>
          <Image
            src="/logo-pizza-doc.png?v=3"
            alt="Pizza D.O.C."
            width={40}
            height={40}
            className="rounded-lg object-contain"
          />
          <div>
            <p className="pd-display text-lg font-semibold leading-tight tracking-tight">
              Pizza D.O.C.
            </p>
            <p className="text-[11px]" style={{ color: 'var(--pd-muted)' }}>
              Gestione team
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const isMock = Boolean(item.mock)
            const active = !isMock && pathname === item.href
            const Icon = item.icon
            const className =
              'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors pd-radius-md'
            const style = {
              background: active ? 'var(--pd-accent-soft)' : 'transparent',
              color: active ? 'var(--pd-accent)' : isMock ? 'var(--pd-muted)' : 'var(--pd-text)',
              opacity: isMock ? 0.55 : 1,
              borderRadius: 'var(--pd-radius)',
            } as const

            if (isMock) {
              return (
                <span key={item.name} className={className} style={style}>
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </span>
              )
            }

            return (
              <Link key={item.name} href={item.href} className={className} style={style}>
                <Icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>
            )
          })}
          <div className="pt-4 mt-4 border-t space-y-1" style={{ borderColor: 'var(--pd-border)' }}>
            {SIDEBAR_EXTRA.map((name) => (
              <span
                key={name}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium opacity-50 cursor-default"
                style={{ color: 'var(--pd-muted)', borderRadius: 'var(--pd-radius)' }}
              >
                {name}
              </span>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--pd-border)' }}>
          <ThemeToggle className="w-full justify-center" />
          <Link
            href="/design-preview"
            className="flex items-center justify-center gap-2 text-xs font-semibold py-2"
            style={{ color: 'var(--pd-muted)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Torna all&apos;anteprima
          </Link>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64 flex flex-col min-h-dvh">
        <header
          className="lg:hidden sticky top-0 z-30 border-b pt-safe"
          style={{
            background: 'color-mix(in srgb, var(--pd-surface) 92%, transparent)',
            borderColor: 'var(--pd-border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Image
                src="/logo-pizza-doc.png?v=3"
                alt=""
                width={32}
                height={32}
                className="object-contain shrink-0"
                style={{ borderRadius: 'var(--pd-radius-sm)' }}
              />
              <div className="min-w-0">
                <h1 className="pd-display text-base font-semibold truncate leading-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-[11px] truncate" style={{ color: 'var(--pd-muted)' }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <button
                type="button"
                className="relative p-2 pd-press"
                style={{ background: 'var(--pd-surface-muted)', borderRadius: 'var(--pd-radius)' }}
                aria-label="Notifiche"
              >
                <Bell className="h-5 w-5" style={{ color: 'var(--pd-text)' }} />
                <span
                  className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                  style={{ background: 'var(--pd-accent)' }}
                />
              </button>
            </div>
          </div>
        </header>

        <div className="hidden lg:flex items-end justify-between px-8 pt-8 pb-2">
          <div>
            <h1 className="pd-display text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm" style={{ color: 'var(--pd-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              className="relative p-2.5 pd-press"
              style={{
                background: 'var(--pd-surface)',
                border: '1px solid var(--pd-border)',
                borderRadius: 'var(--pd-radius)',
              }}
              aria-label="Notifiche"
            >
              <Bell className="h-5 w-5" />
              <span
                className="absolute top-2 right-2 h-2 w-2 rounded-full"
                style={{ background: 'var(--pd-accent)' }}
              />
            </button>
          </div>
        </div>

        <main className="flex-1 px-4 lg:px-8 py-4 pb-28 lg:pb-8 pd-page-enter">{children}</main>

        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t pb-safe"
          style={{
            background: 'color-mix(in srgb, var(--pd-surface) 94%, transparent)',
            borderColor: 'var(--pd-border)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div className="flex items-stretch justify-around px-1 pt-1">
            {nav.map((item) => {
              const isMock = Boolean(item.mock)
              const active = !isMock && pathname === item.href
              const Icon = item.icon
              const className =
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold pd-press'
              const style = { color: active ? 'var(--pd-accent)' : 'var(--pd-muted)' }

              if (isMock) {
                return (
                  <span key={item.name} className={className} style={style}>
                    <Icon className="h-5 w-5" strokeWidth={2} />
                    {item.name}
                  </span>
                )
              }

              return (
                <Link key={item.name} href={item.href} className={className} style={style}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  {item.name}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold pd-press"
              style={{ color: 'var(--pd-muted)' }}
            >
              <Menu className="h-5 w-5" />
              Altro
            </button>
          </div>
        </nav>

        {showMore && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Chiudi"
              onClick={() => setShowMore(false)}
            />
            <div
              className="relative p-5 pb-safe animate-slide-up"
              style={{
                background: 'var(--pd-surface)',
                borderTopLeftRadius: 'var(--pd-radius-xl)',
                borderTopRightRadius: 'var(--pd-radius-xl)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="pd-display text-lg font-semibold">Altro</p>
                <button
                  type="button"
                  onClick={() => setShowMore(false)}
                  className="p-2 rounded-full"
                  style={{ background: 'var(--pd-surface-muted)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="space-y-1">
                {SIDEBAR_EXTRA.map((name) => (
                  <li
                    key={name}
                    className="px-4 py-3 text-sm font-medium"
                    style={{
                      background: 'var(--pd-surface-muted)',
                      borderRadius: 'var(--pd-radius)',
                    }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
              <Link
                href="/design-preview"
                onClick={() => setShowMore(false)}
                className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold py-3"
                style={{ color: 'var(--pd-accent)' }}
              >
                <ArrowLeft className="h-4 w-4" />
                Torna all&apos;anteprima
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
