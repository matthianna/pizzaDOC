'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import {
    Calendar, Clock, Download, ChevronLeft, ChevronRight,
    Pizza, Users, MapPin, Loader2, Sparkles, Filter, Sun, Moon, User
} from 'lucide-react'
import { addWeeks, subWeeks } from 'date-fns'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatDayMonthIt,
  formatDayMonthYearIt,
  formatMonthYearIt,
} from '@/lib/date-utils'
import { getRoleName, cn } from '@/lib/utils'
import { useHaptics } from '@/hooks/use-haptics'
import { Button } from '@/components/ui/button'

export default function WeeklyPlanPage() {
    const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
    const [data, setData] = useState<{ schedule: any, holidays: any[] } | null>(null)
    const [loading, setLoading] = useState(true)
    const { lightClick, mediumClick } = useHaptics()
    const [activeTab, setActiveTab] = useState<'LIST' | 'GRID'>('LIST')

    useEffect(() => {
        fetchWeeklyPlan()
    }, [currentWeek])

    const fetchWeeklyPlan = async () => {
        setLoading(true)
        try {
            const weekStartStr = currentWeek.toISOString()
            const response = await fetch(`/api/weekly-plan?weekStart=${weekStartStr}`)
            if (response.ok) {
                const jsonData = await response.json()
                setData(jsonData)
            }
        } catch (error) {
            console.error('Error fetching weekly plan:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDownloadPDF = () => {
        mediumClick()
        const weekStartStr = currentWeek.toISOString()
        window.open(`/api/admin/schedule/${weekStartStr}/export-pdf`, '_blank')
    }

    const nextWeek = () => {
        lightClick()
        setCurrentWeek(prev => addWeeks(prev, 1))
    }

    const prevWeek = () => {
        lightClick()
        setCurrentWeek(prev => subWeeks(prev, 1))
    }

    const goToToday = () => {
        lightClick()
        setCurrentWeek(getWeekStart(new Date()))
    }

    const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
    const shortDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM']

    // Raggruppa turni per giorno e tipo
    const shiftsByDay: Record<number, Record<string, any[]>> = {}
    if (data?.schedule?.shifts) {
        for (let i = 0; i < 7; i++) {
            shiftsByDay[i] = { 'PRANZO': [], 'CENA': [] }
        }
        data.schedule.shifts.forEach((shift: any) => {
            shiftsByDay[shift.dayOfWeek][shift.shiftType].push(shift)
        })
    }

    const isToday = (dayIndex: number) => {
        const checkStr = addWeekCalendarDays(currentWeek, dayIndex).toISOString().slice(0, 10)
        return checkStr === new Date().toISOString().slice(0, 10)
    }

    const getHolidayForDay = (dayIndex: number) => {
        if (!data?.holidays) return null
        const dateStr = addWeekCalendarDays(currentWeek, dayIndex).toISOString().slice(0, 10)
        return data.holidays.find(h => new Date(h.date).toISOString().slice(0, 10) === dateStr)
    }

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'PIZZAIOLO': return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' }
            case 'CUCINA': return { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-200' }
            case 'SALA': return { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-200' }
            case 'FATTORINO': return { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' }
            default: return { bg: 'bg-gray-500', text: 'text-gray-600', light: 'bg-gray-50', border: 'border-gray-200' }
        }
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-6 pb-20">
                {/* Header */}
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
                                <Calendar className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Piano Settimanale</h1>
                                <p className="text-gray-500 font-medium text-sm mt-0.5">Consulta i turni di tutta la squadra</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadPDF}
                                className="rounded-xl border-gray-200 font-bold text-gray-700 h-10 px-4 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                PDF
                            </Button>
                            <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                                <button
                                    onClick={() => { lightClick(); setActiveTab('LIST') }}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-black transition-all",
                                        activeTab === 'LIST' ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >LISTA</button>
                                <button
                                    onClick={() => { lightClick(); setActiveTab('GRID') }}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-black transition-all",
                                        activeTab === 'GRID' ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >GRIGLIA</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Week Navigator */}
                <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4 flex items-center justify-between">
                    <button onClick={prevWeek} className="p-3 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all">
                        <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="flex flex-col items-center cursor-pointer group" onClick={goToToday}>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest group-hover:text-orange-500 transition-colors">Settimana selezionata</span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg font-black text-gray-900">
                                {formatDayMonthIt(currentWeek)}
                            </span>
                            <span className="text-gray-300">—</span>
                            <span className="text-lg font-black text-gray-900">
                                {formatDayMonthYearIt(addWeekCalendarDays(currentWeek, 6))}
                            </span>
                        </div>
                    </div>

                    <button onClick={nextWeek} className="p-3 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all">
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Caricamento piano...</p>
                    </div>
                ) : activeTab === 'LIST' ? (
                    /* LIST VIEW */
                    <div className="space-y-4">
                        {days.map((dayName, index) => {
                            const holiday = getHolidayForDay(index)
                            const date = addWeekCalendarDays(currentWeek, index)
                            const dayIsToday = isToday(index)
                            const pranzoShifts = shiftsByDay[index]?.['PRANZO'] || []
                            const cenaShifts = shiftsByDay[index]?.['CENA'] || []

                            const isFullClosure = holiday?.closureType === 'FULL_DAY'
                            const isPranzoClosure = isFullClosure || holiday?.closureType === 'PRANZO_ONLY'
                            const isCenaClosure = isFullClosure || holiday?.closureType === 'CENA_ONLY'

                            return (
                                <div key={index} className={cn(
                                    "bg-white rounded-3xl shadow-soft border overflow-hidden transition-all",
                                    dayIsToday ? "border-orange-200 ring-2 ring-orange-100" : "border-gray-100"
                                )}>
                                    {/* Day Header */}
                                    <div className={cn(
                                        "px-6 py-4 flex items-center justify-between border-b",
                                        dayIsToday ? "bg-orange-50 border-orange-100" : "bg-gray-50/50 border-gray-100"
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black",
                                                dayIsToday ? "bg-orange-500 text-white shadow-lg shadow-orange-200" : "bg-white text-gray-600 shadow-sm border border-gray-100"
                                            )}>
                                                <span className="text-[10px] uppercase leading-none">{shortDays[index]}</span>
                                                <span className="text-lg leading-none mt-0.5">{date.getUTCDate()}</span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-gray-900 tracking-tight">{dayName}</h3>
                                                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                                                    {formatMonthYearIt(date)}
                                                </p>
                                            </div>
                                        </div>

                                        {dayIsToday && (
                                            <span className="px-4 py-1.5 bg-orange-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-orange-200 uppercase tracking-widest">Oggi</span>
                                        )}
                                    </div>

                                    {/* Shifts */}
                                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Pranzo */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Sun className="h-4 w-4 text-amber-500" />
                                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Pranzo</span>
                                                </div>
                                                {!isPranzoClosure && pranzoShifts.length > 0 && (
                                                    <span className="text-[10px] font-bold text-gray-400">{pranzoShifts.length} Persone</span>
                                                )}
                                            </div>
                                            {isPranzoClosure ? (
                                                <ClosedBanner holidayName={holiday?.description} />
                                            ) : pranzoShifts.length > 0 ? (
                                                <div className="space-y-2">
                                                    {pranzoShifts.map((shift: any) => (
                                                        <ShiftCard key={shift.id} shift={shift} getRoleColor={getRoleColor} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyShifts />
                                            )}
                                        </div>

                                        {/* Cena */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Moon className="h-4 w-4 text-indigo-500" />
                                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Cena</span>
                                                </div>
                                                {!isCenaClosure && cenaShifts.length > 0 && (
                                                    <span className="text-[10px] font-bold text-gray-400">{cenaShifts.length} Persone</span>
                                                )}
                                            </div>
                                            {isCenaClosure ? (
                                                <ClosedBanner holidayName={holiday?.description} />
                                            ) : cenaShifts.length > 0 ? (
                                                <div className="space-y-2">
                                                    {cenaShifts.map((shift: any) => (
                                                        <ShiftCard key={shift.id} shift={shift} getRoleColor={getRoleColor} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyShifts />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    /* GRID VIEW */
                    <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden">
                        {/* Grid Header */}
                        <div className="grid grid-cols-8 border-b border-gray-100">
                            <div className="p-4 bg-gray-50 border-r border-gray-100">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Turno</span>
                            </div>
                            {days.map((day, idx) => {
                                const date = addWeekCalendarDays(currentWeek, idx)
                                const dayIsToday = isToday(idx)
                                return (
                                    <div key={idx} className={cn(
                                        "p-3 text-center border-r border-gray-100 last:border-r-0",
                                        dayIsToday ? "bg-orange-50" : "bg-gray-50"
                                    )}>
                                        <p className={cn(
                                            "text-[10px] font-black uppercase tracking-widest",
                                            dayIsToday ? "text-orange-600" : "text-gray-400"
                                        )}>{shortDays[idx]}</p>
                                        <p className={cn(
                                            "text-lg font-black mt-0.5",
                                            dayIsToday ? "text-orange-600" : "text-gray-900"
                                        )}>{date.getUTCDate()}</p>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Pranzo Row */}
                        <div className="grid grid-cols-8 border-b border-gray-100">
                            <div className="p-4 bg-amber-50 border-r border-gray-100 flex items-center gap-2">
                                <Sun className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-black text-amber-700 uppercase">Pranzo</span>
                            </div>
                            {days.map((_, idx) => {
                                const holiday = getHolidayForDay(idx)
                                const isFullClosure = holiday?.closureType === 'FULL_DAY'
                                const isPranzoClosure = isFullClosure || holiday?.closureType === 'PRANZO_ONLY'
                                const pranzoShifts = shiftsByDay[idx]?.['PRANZO'] || []
                                const dayIsToday = isToday(idx)

                                return (
                                    <div key={idx} className={cn(
                                        "p-2 border-r border-gray-100 last:border-r-0 min-h-[120px]",
                                        dayIsToday ? "bg-orange-50/30" : ""
                                    )}>
                                        {isPranzoClosure ? (
                                            <div className="h-full flex items-center justify-center">
                                                <span className="text-[9px] font-bold text-red-500 uppercase">Chiuso</span>
                                            </div>
                                        ) : pranzoShifts.length > 0 ? (
                                            <div className="space-y-1">
                                                {pranzoShifts.map((shift: any) => (
                                                    <GridShiftChip key={shift.id} shift={shift} getRoleColor={getRoleColor} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center">
                                                <span className="text-[9px] text-gray-300">—</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Cena Row */}
                        <div className="grid grid-cols-8">
                            <div className="p-4 bg-indigo-50 border-r border-gray-100 flex items-center gap-2">
                                <Moon className="h-4 w-4 text-indigo-600" />
                                <span className="text-xs font-black text-indigo-700 uppercase">Cena</span>
                            </div>
                            {days.map((_, idx) => {
                                const holiday = getHolidayForDay(idx)
                                const isFullClosure = holiday?.closureType === 'FULL_DAY'
                                const isCenaClosure = isFullClosure || holiday?.closureType === 'CENA_ONLY'
                                const cenaShifts = shiftsByDay[idx]?.['CENA'] || []
                                const dayIsToday = isToday(idx)

                                return (
                                    <div key={idx} className={cn(
                                        "p-2 border-r border-gray-100 last:border-r-0 min-h-[120px]",
                                        dayIsToday ? "bg-orange-50/30" : ""
                                    )}>
                                        {isCenaClosure ? (
                                            <div className="h-full flex items-center justify-center">
                                                <span className="text-[9px] font-bold text-red-500 uppercase">Chiuso</span>
                                            </div>
                                        ) : cenaShifts.length > 0 ? (
                                            <div className="space-y-1">
                                                {cenaShifts.map((shift: any) => (
                                                    <GridShiftChip key={shift.id} shift={shift} getRoleColor={getRoleColor} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center">
                                                <span className="text-[9px] text-gray-300">—</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    )
}

function ShiftCard({ shift, getRoleColor }: { shift: any, getRoleColor: (role: string) => any }) {
    const colors = getRoleColor(shift.role)
    return (
        <div className={cn(
            "flex items-center justify-between p-3 rounded-2xl border transition-all hover:shadow-md",
            colors.light, colors.border
        )}>
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-sm",
                    colors.bg
                )}>
                    {shift.user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-sm font-black text-gray-900 leading-tight">{shift.user.username}</p>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", colors.text)}>
                        {getRoleName(shift.role)}
                    </p>
                </div>
            </div>
            <div className="px-3 py-1.5 bg-white rounded-lg text-xs font-black text-gray-700 shadow-sm border border-gray-100">
                {shift.startTime}
            </div>
        </div>
    )
}

function GridShiftChip({ shift, getRoleColor }: { shift: any, getRoleColor: (role: string) => any }) {
    const colors = getRoleColor(shift.role)
    return (
        <div className={cn(
            "px-2 py-1.5 rounded-lg border text-[10px] font-bold truncate",
            colors.light, colors.border
        )}>
            <div className="flex items-center gap-1.5">
                <div className={cn("w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-black", colors.bg)}>
                    {shift.user.username.charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-gray-700">{shift.user.username.split('.')[0]}</span>
            </div>
        </div>
    )
}

function ClosedBanner({ holidayName }: { holidayName?: string }) {
    return (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-red-600" />
            </div>
            <div>
                <p className="text-xs font-black text-red-600 uppercase tracking-widest">Chiuso</p>
                {holidayName && <p className="text-[10px] font-medium text-red-400">{holidayName}</p>}
            </div>
        </div>
    )
}

function EmptyShifts() {
    return (
        <div className="h-20 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl">
            <p className="text-xs font-medium text-gray-300">Nessun turno</p>
        </div>
    )
}
