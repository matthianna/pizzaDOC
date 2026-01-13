'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { RefreshCcw } from 'lucide-react'

interface PullToRefreshProps {
    children: ReactNode
    onRefresh: () => Promise<void>
    disabled?: boolean
}

export function PullToRefresh({ children, onRefresh, disabled = false }: PullToRefreshProps) {
    const [isPulling, setIsPulling] = useState(false)
    const [pullDistance, setPullDistance] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const startY = useRef(0)
    const isAtTop = useRef(true)

    const PULL_THRESHOLD = 80
    const MAX_PULL = 120

    useEffect(() => {
        const container = containerRef.current
        if (!container || disabled) return

        const handleTouchStart = (e: TouchEvent) => {
            // Only enable if scrolled to top
            if (container.scrollTop <= 0) {
                isAtTop.current = true
                startY.current = e.touches[0].clientY
            } else {
                isAtTop.current = false
            }
        }

        const handleTouchMove = (e: TouchEvent) => {
            if (!isAtTop.current || isRefreshing) return

            const currentY = e.touches[0].clientY
            const diff = currentY - startY.current

            if (diff > 0) {
                setIsPulling(true)
                const distance = Math.min(diff * 0.5, MAX_PULL)
                setPullDistance(distance)

                if (distance >= PULL_THRESHOLD) {
                    // Add haptic feedback on iOS/Android
                    if ('vibrate' in navigator) {
                        navigator.vibrate(10)
                    }
                }
            }
        }

        const handleTouchEnd = async () => {
            if (!isPulling) return

            if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
                setIsRefreshing(true)
                setPullDistance(50) // Keep indicator visible

                try {
                    await onRefresh()
                    // Update last sync time
                    localStorage.setItem('pizzadoc_last_sync', new Date().toLocaleString('it-IT'))
                } finally {
                    setIsRefreshing(false)
                    setPullDistance(0)
                    setIsPulling(false)
                }
            } else {
                setPullDistance(0)
                setIsPulling(false)
            }
        }

        container.addEventListener('touchstart', handleTouchStart, { passive: true })
        container.addEventListener('touchmove', handleTouchMove, { passive: true })
        container.addEventListener('touchend', handleTouchEnd, { passive: true })

        return () => {
            container.removeEventListener('touchstart', handleTouchStart)
            container.removeEventListener('touchmove', handleTouchMove)
            container.removeEventListener('touchend', handleTouchEnd)
        }
    }, [isPulling, pullDistance, isRefreshing, onRefresh, disabled])

    const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)

    return (
        <div
            ref={containerRef}
            className="relative overflow-auto"
            style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'none'
            }}
        >
            {/* Pull indicator */}
            <div
                className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center transition-all duration-200"
                style={{
                    top: pullDistance - 50,
                    opacity: progress,
                    pointerEvents: 'none',
                }}
            >
                <div
                    className={`w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''
                        }`}
                    style={{
                        transform: isRefreshing ? 'none' : `rotate(${progress * 180}deg)`,
                    }}
                >
                    <RefreshCcw className={`h-5 w-5 text-orange-600 ${pullDistance >= PULL_THRESHOLD ? 'text-orange-700' : ''
                        }`} />
                </div>
            </div>

            {/* Content with pull transform */}
            <div
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: isPulling ? 'none' : 'transform 0.3s ease-out',
                }}
            >
                {children}
            </div>

            {/* Loading overlay */}
            {isRefreshing && (
                <div className="fixed inset-0 bg-black/5 z-40 pointer-events-none" />
            )}
        </div>
    )
}

// Hook for use in pages
export function useRefresh(fetchFunction: () => Promise<void>) {
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            await fetchFunction()
        } finally {
            setIsRefreshing(false)
        }
    }

    return { isRefreshing, handleRefresh }
}
