'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import {
    Calendar, Clock, Download, ChevronLeft, ChevronRight,
    Pizza, Users, MapPin, Loader2, Sparkles, Filter
} from 'lucide-react'
import { format, addWeeks, subWeeks, addDays, startOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import { getWeekStart } from '@/lib/date-utils'
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
        const today = new Date()
        const checkDate = addDays(currentWeek, dayIndex)
        return format(checkDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    }

    const getHolidayForDay = (dayIndex: number) => {
        if (!data?.holidays) return null
        const checkDate = addDays(currentWeek, dayIndex)
        const dateStr = format(checkDate, 'yyyy-MM-dd')
        return data.holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr)
    }

    return (
        <MainLayout>
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-orange-600" />
                            </div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Piano Settimanale</h1>
                        </div>
                        <p className="text-gray-500 font-medium text-sm">Consulta i turni di tutta la squadra</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPDF}
                            className="rounded-xl border-gray-200 font-bold text-gray-700 h-10 px-4"
                        >
                            <Download className="h-4 w-4 mr-2 text-orange-500" />
                            PDF
                        </Button>
                        <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                            <button
                                onClick={() => { lightClick(); setActiveTab('LIST') }}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                                    activeTab === 'LIST' ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >LISTA</button>
                            <button
                                onClick={() => { lightClick(); setActiveTab('GRID') }}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                                    activeTab === 'GRID' ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >GRIGLIA</button>
                        </div>
                    </div>
                </div>

                {/* Navigation Bar */}
                <div className="glass rounded-2xl p-4 flex items-center justify-between shadow-soft border-0">
                    <Button variant="ghost" size="sm" onClick={prevWeek} className="rounded-xl hover:bg-orange-50 text-orange-600 p-2">
                        <ChevronLeft className="h-6 w-6" />
                    </Button>

                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-0.5">Settimana selezionata</span>
                        <div className="flex items-center gap-2">
                            <span className="text-base font-black text-gray-900">
                                {format(currentWeek, 'd MMMM', { locale: it })}
                            </span>
                            <span className="text-gray-300">-</span>
                            <span className="text-base font-black text-gray-900">
                                {format(addDays(currentWeek, 6), 'd MMMM yyyy', { locale: it })}
                            </span>
                        </div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={nextWeek} className="rounded-xl hover:bg-orange-50 text-orange-600 p-2">
                        <ChevronRight className="h-6 w-6" />
                    </Button>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Caricamento piano...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {days.map((dayName, index) => {
                            const holiday = getHolidayForDay(index)
                            const date = addDays(currentWeek, index)
                            const dayIsToday = isToday(index)
                            const pranzoShifts = shiftsByDay[index]?.['PRANZO'] || []
                            const cenaShifts = shiftsByDay[index]?.['CENA'] || []
                            const hasShifts = pranzoShifts.length > 0 || cenaShifts.length > 0

                            const isFullClosure = holiday?.closureType === 'FULL_DAY'
                            const isPranzoClosure = isFullClosure || holiday?.closureType === 'PRANZO_ONLY'
                            const isCenaClosure = isFullClosure || holiday?.closureType === 'CENA_ONLY'

                            return (
                                <div key={index} className={cn(
                                    "relative group transition-all",
                                    dayIsToday ? "scale-[1.02]" : "hover:scale-[1.01]"
                                )}>
                                    {dayIsToday && (
                                        <div className="absolute -left-1 top-0 bottom-0 w-1 bg-orange-500 rounded-full shadow-glow-orange z-10" />
                                    )}

                                    <div className={cn(
                                        "glass rounded-[2rem] overflow-hidden border-0 shadow-soft",
                                        dayIsToday ? "ring-2 ring-orange-100 shadow-xl" : ""
                                    )}>
                                        {/* Day Header */}
                                        <div className={cn(
                                            "px-6 py-4 flex items-center justify-between border-b border-white/20",
                                            dayIsToday ? "bg-orange-50/50" : "bg-gray-50/30"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-2xl flex flex-col items-center justify-center font-black",
                                                    dayIsToday ? "bg-orange-500 text-white shadow-glow-orange" : "bg-white text-gray-500 shadow-sm"
                                                )}>
                                                    <span className="text-[10px] uppercase leading-none">{dayName.substring(0, 3)}</span>
                                                    <span className="text-sm mt-0.5">{format(date, 'd')}</span>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">
                                                        {dayName}
                                                    </h3>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                        {format(date, 'MMMM yyyy', { locale: it })}
                                                    </p>
                                                </div>
                                            </div>

                                            {dayIsToday && (
                                                <span className="px-3 py-1 bg-orange-500 text-white text-[10px] font-black rounded-full shadow-glow-orange">OGGI</span>
                                            )}
                                        </div>

                                        {/* Shifts Content */}
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Pranzo Column */}
                                            <ShiftSection
                                                title="☀️ Pranzo"
                                                shifts={pranzoShifts}
                                                isClosed={isPranzoClosure}
                                                holidayName={holiday?.description}
                                                colorClass="orange"
                                            />

                                            {/* Cena Column */}
                                            <ShiftSection
                                                title="🌙 Cena"
                                                shifts={cenaShifts}
                                                isClosed={isCenaClosure}
                                                holidayName={holiday?.description}
                                                colorClass="blue"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </MainLayout>
    )
}

function ShiftSection({ title, shifts, isClosed, holidayName, colorClass }: any) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</span>
                {!isClosed && shifts.length > 0 && (
                    <span className="text-[10px] font-bold text-gray-400">{shifts.length} Persone</span>
                )}
            </div>

            {isClosed ? (
                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center min-h-[100px]">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-red-600 uppercase tracking-widest">Chiuso per festività</p>
                        {holidayName && <p className="text-[10px] font-bold text-red-400 mt-0.5">{holidayName}</p>}
                    </div>
                </div>
            ) : shifts.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                    {shifts.map((shift: any) => (
                        <div key={shift.id} className={cn(
                            "flex items-center justify-between p-3 rounded-[1.25rem] border shadow-sm transition-all group/item",
                            shift.role === 'PIZZAIOLO' ? "bg-red-50/30 border-red-100/50 hover:bg-red-50" :
                                shift.role === 'CUCINA' ? "bg-orange-50/30 border-orange-100/50 hover:bg-orange-50" :
                                    shift.role === 'SALA' ? "bg-green-50/30 border-green-100/50 hover:bg-green-50" :
                                        "bg-blue-50/30 border-blue-100/50 hover:bg-blue-50"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm",
                                    shift.role === 'PIZZAIOLO' ? "bg-red-500 text-white" :
                                        shift.role === 'CUCINA' ? "bg-orange-500 text-white" :
                                            shift.role === 'SALA' ? "bg-green-500 text-white" :
                                                "bg-blue-500 text-white"
                                )}>
                                    {shift.user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-900 leading-none mb-1 text-ellipsis overflow-hidden">{shift.user.username}</p>
                                    <p className={cn(
                                        "text-[10px] font-bold uppercase tracking-widest",
                                        shift.role === 'PIZZAIOLO' ? "text-red-600" :
                                            shift.role === 'CUCINA' ? "text-orange-600" :
                                                shift.role === 'SALA' ? "text-green-600" :
                                                    "text-blue-600"
                                    )}>{getRoleName(shift.role)}</p>
                                </div>
                            </div>
                            <div className="bg-white/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-black text-gray-700 shadow-sm border border-black/5 shrink-0">
                                {shift.startTime}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-[100px] flex items-center justify-center border border-dashed border-gray-200 rounded-2xl">
                    <p className="text-xs font-bold text-gray-300 italic">Nessun turno</p>
                </div>
            )}
        </div>
    )
}
