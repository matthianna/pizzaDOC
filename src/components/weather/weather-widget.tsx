'use client'

import { useState, useEffect } from 'react'
import { format, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog, Droplets, Loader2, UtensilsCrossed, Moon } from 'lucide-react'

interface HourlyWeather {
  hour: number
  temp: number
  weatherCode: number
  precipitation: number
}

interface DailyWeather {
  date: Date
  weatherCode: number
  tempMax: number
  tempMin: number
  precipitation: number
  windSpeed: number
  humidity: number
  hourly: HourlyWeather[]
}

interface WeatherData {
  daily: DailyWeather[]
  location: string
}

// Open-Meteo weather codes to icons/descriptions
const getWeatherInfo = (code: number): { icon: React.ComponentType<any>, label: string, color: string, bgColor: string } => {
  // Clear
  if (code === 0) return { icon: Sun, label: 'Sereno', color: 'text-amber-500', bgColor: 'bg-amber-50' }
  // Partly cloudy
  if (code >= 1 && code <= 3) return { icon: Cloud, label: 'Nuvoloso', color: 'text-gray-400', bgColor: 'bg-gray-50' }
  // Fog
  if (code >= 45 && code <= 48) return { icon: CloudFog, label: 'Nebbia', color: 'text-gray-500', bgColor: 'bg-gray-100' }
  // Drizzle
  if (code >= 51 && code <= 57) return { icon: CloudRain, label: 'Pioggerella', color: 'text-blue-400', bgColor: 'bg-blue-50' }
  // Rain
  if (code >= 61 && code <= 67) return { icon: CloudRain, label: 'Pioggia', color: 'text-blue-500', bgColor: 'bg-blue-50' }
  // Snow
  if (code >= 71 && code <= 77) return { icon: CloudSnow, label: 'Neve', color: 'text-cyan-400', bgColor: 'bg-cyan-50' }
  // Rain showers
  if (code >= 80 && code <= 82) return { icon: CloudRain, label: 'Rovesci', color: 'text-blue-600', bgColor: 'bg-blue-100' }
  // Snow showers
  if (code >= 85 && code <= 86) return { icon: CloudSnow, label: 'Nevicate', color: 'text-cyan-500', bgColor: 'bg-cyan-100' }
  // Thunderstorm
  if (code >= 95 && code <= 99) return { icon: CloudLightning, label: 'Temporale', color: 'text-purple-500', bgColor: 'bg-purple-50' }
  
  return { icon: Cloud, label: 'Variabile', color: 'text-gray-400', bgColor: 'bg-gray-50' }
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWeather()
  }, [])

  const fetchWeather = async () => {
    try {
      // Savosa, Switzerland (Ticino) coordinates
      const lat = 46.0167
      const lon = 8.9500
      
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&hourly=temperature_2m,weather_code,precipitation,relative_humidity_2m&timezone=Europe/Zurich&forecast_days=7`
      )
      
      if (!response.ok) throw new Error('Errore nel caricamento meteo')
      
      const data = await response.json()
      
      const dailyWeather: DailyWeather[] = data.daily.time.map((date: string, i: number) => {
        // Extract hourly data for this day (hours 11-14 and 17-22)
        const dayStartIndex = i * 24
        const hourlyData: HourlyWeather[] = []
        
        // Pranzo hours: 11, 12, 13, 14
        for (let h = 11; h <= 14; h++) {
          const idx = dayStartIndex + h
          hourlyData.push({
            hour: h,
            temp: Math.round(data.hourly.temperature_2m[idx] || 0),
            weatherCode: data.hourly.weather_code[idx] || 0,
            precipitation: data.hourly.precipitation[idx] || 0
          })
        }
        
        // Cena hours: 17, 18, 19, 20, 21, 22
        for (let h = 17; h <= 22; h++) {
          const idx = dayStartIndex + h
          hourlyData.push({
            hour: h,
            temp: Math.round(data.hourly.temperature_2m[idx] || 0),
            weatherCode: data.hourly.weather_code[idx] || 0,
            precipitation: data.hourly.precipitation[idx] || 0
          })
        }
        
        return {
          date: new Date(date),
          weatherCode: data.daily.weather_code[i],
          tempMax: Math.round(data.daily.temperature_2m_max[i]),
          tempMin: Math.round(data.daily.temperature_2m_min[i]),
          precipitation: data.daily.precipitation_sum[i],
          windSpeed: Math.round(data.daily.wind_speed_10m_max[i]),
          humidity: data.hourly?.relative_humidity_2m?.[dayStartIndex + 12] || 50,
          hourly: hourlyData
        }
      })
      
      setWeather({
        daily: dailyWeather,
        location: 'Savosa'
      })
    } catch (err) {
      console.error('Weather fetch error:', err)
      setError('Impossibile caricare il meteo')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-3xl p-6 shadow-lg shadow-blue-100">
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="h-5 w-5 text-white/80 animate-spin" />
          <span className="text-white/80 text-sm font-medium">Caricamento meteo...</span>
        </div>
      </div>
    )
  }

  if (error || !weather) {
    return null
  }

  const todayWeather = weather.daily.find(d => isToday(d.date)) || weather.daily[0]
  const todayInfo = getWeatherInfo(todayWeather.weatherCode)
  const TodayIcon = todayInfo.icon

  return (
    <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-3xl shadow-lg shadow-blue-100 overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        {/* LEFT SIDE - Week Overview */}
        <div className="flex-1 p-5">
          {/* Header */}
          <div className="mb-4">
            <h3 className="text-white/60 text-[10px] font-black uppercase tracking-widest">Meteo Settimana</h3>
            <p className="text-white text-xl font-black tracking-tight">{weather.location}, CH</p>
          </div>

          {/* Weekly forecast */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {weather.daily.map((day, i) => {
              const { icon: WeatherIcon, color } = getWeatherInfo(day.weatherCode)
              const isTodayItem = isToday(day.date)
              
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center p-2.5 rounded-2xl transition-all min-w-[56px]",
                    isTodayItem 
                      ? "bg-white shadow-lg" 
                      : "bg-white/10 hover:bg-white/20"
                  )}
                >
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-wider mb-0.5",
                    isTodayItem ? "text-blue-600" : "text-white/70"
                  )}>
                    {format(day.date, 'EEE', { locale: it })}
                  </span>
                  <span className={cn(
                    "text-xs font-bold mb-1.5",
                    isTodayItem ? "text-gray-500" : "text-white/50"
                  )}>
                    {format(day.date, 'd')}
                  </span>
                  <WeatherIcon className={cn(
                    "h-5 w-5 mb-1.5",
                    isTodayItem ? color : "text-white"
                  )} />
                  <span className={cn(
                    "text-sm font-black",
                    isTodayItem ? "text-gray-900" : "text-white"
                  )}>
                    {day.tempMax}°
                  </span>
                  <span className={cn(
                    "text-[10px] font-medium",
                    isTodayItem ? "text-gray-400" : "text-white/50"
                  )}>
                    {day.tempMin}°
                  </span>
                  {day.precipitation > 0 && (
                    <div className={cn(
                      "flex items-center gap-0.5 mt-1",
                      isTodayItem ? "text-blue-500" : "text-white/60"
                    )}>
                      <Droplets className="h-2.5 w-2.5" />
                      <span className="text-[8px] font-bold">{Math.round(day.precipitation)}mm</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT SIDE - Shift Hours Weather */}
        <div className="lg:w-80 bg-white/10 backdrop-blur-sm p-5 lg:border-l border-t lg:border-t-0 border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Oggi</p>
              <p className="text-white text-sm font-bold">{format(todayWeather.date, 'd MMMM', { locale: it })}</p>
            </div>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", todayInfo.bgColor)}>
              <TodayIcon className={cn("h-6 w-6", todayInfo.color)} />
            </div>
          </div>

          {/* PRANZO Section (11-14) */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <UtensilsCrossed className="h-3.5 w-3.5 text-orange-300" />
              </div>
              <span className="text-white/80 text-xs font-black uppercase tracking-wider">Pranzo</span>
              <span className="text-white/40 text-[10px] font-medium">11:00 - 14:00</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {todayWeather.hourly.filter(h => h.hour >= 11 && h.hour <= 14).map(hourData => {
                const { icon: HourIcon, color } = getWeatherInfo(hourData.weatherCode)
                return (
                  <div key={hourData.hour} className="bg-white/10 rounded-xl p-2 text-center">
                    <p className="text-white/50 text-[10px] font-bold mb-1">{hourData.hour}:00</p>
                    <HourIcon className={cn("h-4 w-4 mx-auto mb-1", "text-white/80")} />
                    <p className="text-white text-sm font-black">{hourData.temp}°</p>
                    {hourData.precipitation > 0 && (
                      <div className="flex items-center justify-center gap-0.5 mt-0.5">
                        <Droplets className="h-2 w-2 text-blue-300" />
                        <span className="text-blue-300 text-[8px] font-bold">{hourData.precipitation.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* CENA Section (17-22) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Moon className="h-3.5 w-3.5 text-indigo-300" />
              </div>
              <span className="text-white/80 text-xs font-black uppercase tracking-wider">Cena</span>
              <span className="text-white/40 text-[10px] font-medium">17:00 - 22:00</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {todayWeather.hourly.filter(h => h.hour >= 17 && h.hour <= 22).map(hourData => {
                const { icon: HourIcon, color } = getWeatherInfo(hourData.weatherCode)
                return (
                  <div key={hourData.hour} className="bg-white/10 rounded-xl p-1.5 text-center">
                    <p className="text-white/50 text-[9px] font-bold mb-0.5">{hourData.hour}</p>
                    <HourIcon className={cn("h-3.5 w-3.5 mx-auto mb-0.5", "text-white/80")} />
                    <p className="text-white text-xs font-black">{hourData.temp}°</p>
                    {hourData.precipitation > 0 && (
                      <div className="flex items-center justify-center gap-0.5">
                        <Droplets className="h-1.5 w-1.5 text-blue-300" />
                        <span className="text-blue-300 text-[7px] font-bold">{hourData.precipitation.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
