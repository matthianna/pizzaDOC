'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    Home,
    Calendar,
    Clock,
    ArrowLeftRight,
    User,
    Settings,
    Users,
    LayoutGrid,
    Menu,
    Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isAdmin } from '@/lib/auth-utils'
import { useState, useEffect } from 'react'

interface NavItem {
    name: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    activeIcon?: React.ComponentType<{ className?: string }>
}

export function MobileBottomNav() {
    const { data: session } = useSession()
    const pathname = usePathname()
    const [showMore, setShowMore] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    // Fetch unread count periodically
    useEffect(() => {
        if (!session?.user?.id) return

        const fetchUnreadCount = async () => {
            try {
                const response = await fetch('/api/notifications?limit=1')
                if (response.ok) {
                    const data = await response.json()
                    setUnreadCount(data.unreadCount)
                }
            } catch (error) {
                console.error('Error fetching unread count:', error)
            }
        }

        fetchUnreadCount()
        const interval = setInterval(fetchUnreadCount, 30000)
        return () => clearInterval(interval)
    }, [session?.user?.id])

    if (!session) return null

    const isUserAdmin = isAdmin(session)

    // Define navigation items based on user role
    const employeeNav: NavItem[] = [
        {
            name: 'Home',
            href: '/dashboard',
            icon: Home,
        },
        {
            name: 'Piano',
            href: '/schedule',
            icon: LayoutGrid,
        },
        {
            name: 'Disponibilità',
            href: '/availability',
            icon: Calendar,
        },
        {
            name: 'Ore',
            href: '/hours',
            icon: Clock,
        },
        {
            name: 'Altro',
            href: '#more',
            icon: Menu,
        },
    ]

    const adminNav: NavItem[] = [
        {
            name: 'Home',
            href: '/dashboard',
            icon: Home,
        },
        {
            name: 'Piano',
            href: '/admin/schedule',
            icon: LayoutGrid,
        },
        {
            name: 'Utenti',
            href: '/admin/users',
            icon: Users,
        },
        {
            name: 'Ore',
            href: '/admin/hours',
            icon: Clock,
        },
        {
            name: 'Altro',
            href: '#more',
            icon: Menu,
        },
    ]

    // Additional items for the "More" menu
    const employeeMoreItems: NavItem[] = [
        {
            name: 'Notifiche',
            href: '/notifications',
            icon: Bell,
        },
        {
            name: 'Sostituzioni',
            href: '/substitution-requests',
            icon: ArrowLeftRight,
        },
        {
            name: 'Assenze',
            href: '/absences',
            icon: Calendar,
        },
        {
            name: 'Disponibilità Utenti',
            href: '/availability-overview',
            icon: Users,
        },
        {
            name: 'Profilo',
            href: `/profile/${session.user.id}`,
            icon: User,
        },
    ]

    const adminMoreItems: NavItem[] = [
        {
            name: 'Notifiche',
            href: '/notifications',
            icon: Bell,
        },
        {
            name: 'Sostituzioni',
            href: '/admin/substitutions',
            icon: ArrowLeftRight,
        },
        {
            name: 'Assenze',
            href: '/admin/absences',
            icon: Calendar,
        },
        {
            name: 'Riepilogo Ore',
            href: '/admin/hours-summary',
            icon: Clock,
        },
        {
            name: 'Configurazioni',
            href: '/admin/settings',
            icon: Settings,
        },
        {
            name: 'Profilo',
            href: `/profile/${session.user.id}`,
            icon: User,
        },
    ]

    const navigation = isUserAdmin ? adminNav : employeeNav
    const moreItems = isUserAdmin ? adminMoreItems : employeeMoreItems

    const handleNavClick = (href: string) => {
        if (href === '#more') {
            setShowMore(!showMore)
        } else {
            setShowMore(false)
        }
    }

    return (
        <>
            {/* More menu overlay */}
            {showMore && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
                    onClick={() => setShowMore(false)}
                />
            )}

            {/* More menu panel */}
            {showMore && (
                <div className="lg:hidden fixed bottom-20 left-4 right-4 bg-white rounded-2xl shadow-2xl z-50 p-2 animate-in slide-in-from-bottom-5 duration-200">
                    <div className="grid grid-cols-3 gap-1">
                        {moreItems.map((item) => {
                            const isActive = pathname === item.href
                            const Icon = item.icon

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setShowMore(false)}
                                    className={cn(
                                        'flex flex-col items-center justify-center p-3 rounded-xl transition-all',
                                        isActive
                                            ? 'bg-orange-100 text-orange-600'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    )}
                                >
                                    <div className="relative">
                                        <Icon className="h-6 w-6 mb-1" />
                                        {item.name === 'Notifiche' && unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-medium">{item.name}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Bottom navigation bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 pb-safe">
                <div className="flex items-center justify-around h-16">
                    {navigation.map((item) => {
                        const isActive = item.href === '#more'
                            ? showMore
                            : pathname === item.href || pathname.startsWith(item.href + '/')
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={(e) => {
                                    if (item.href === '#more') {
                                        e.preventDefault()
                                        handleNavClick(item.href)
                                    }
                                }}
                                className={cn(
                                    'flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95',
                                    isActive
                                        ? 'text-orange-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                )}
                            >
                                <div className={cn(
                                    'relative flex items-center justify-center w-12 h-7 rounded-2xl transition-all',
                                    isActive && 'bg-orange-100'
                                )}>
                                    <Icon className={cn(
                                        'h-6 w-6 transition-all',
                                        isActive && 'scale-110'
                                    )} />
                                    {item.name === 'Altro' && unreadCount > 0 && (
                                        <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                                    )}
                                </div>
                                <span className={cn(
                                    'text-xs mt-0.5 font-medium transition-all',
                                    isActive && 'font-semibold'
                                )}>
                                    {item.name}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </nav>
        </>
    )
}
