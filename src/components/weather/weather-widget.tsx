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

const getWeatherInfo = (code: number): { icon: React.ComponentType<{ className?: string }>, label: string } => {
  if (code === 0) return { icon: Sun, label: 'Sereno' }
  if (code >= 1 && code <= 3) return { icon: Cloud, label: 'Nuvoloso' }
  if (code >= 45 && code <= 48) return { icon: CloudFog, label: 'Nebbia' }
  if (code >= 51 && code <= 57) return { icon: CloudRain, label: 'Pioggerella' }
  if (code >= 61 && code <= 67) return { icon: CloudRain, label: 'Pioggia' }
  if (code >= 71 && code <= 77) return { icon: CloudSnow, label: 'Neve' }
  if (code >= 80 && code <= 82) return { icon: CloudRain, label: 'Rovesci' }
  if (code >= 85 && code <= 86) return { icon: CloudSnow, label: 'Nevicate' }
  if (code >= 95 && code <= 99) return { icon: CloudLightning, label: 'Temporale' }
  return { icon: Cloud, label: 'Variabile' }
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
      const lat = 46.0167
      const lon = 8.9500

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&hourly=temperature_2m,weather_code,precipitation,relative_humidity_2m&timezone=Europe/Zurich&forecast_days=7`
      )

      if (!response.ok) throw new Error('Errore nel caricamento meteo')

      const data = await response.json()

      const dailyWeather: DailyWeather[] = data.daily.time.map((date: string, i: number) => {
        const dayStartIndex = i * 24
        const hourlyData: HourlyWeather[] = []

        for (let h = 11; h <= 14; h++) {
          const idx = dayStartIndex + h
          hourlyData.push({
            hour: h,
            temp: Math.round(data.hourly.temperature_2m[idx] || 0),
            weatherCode: data.hourly.weather_code[idx] || 0,
            precipitation: data.hourly.precipitation[idx] || 0
          })
        }

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
      <div className="pd-card p-6">
        <div className="flex items-center justify-center gap-3 py-6">
          <span style={{ color: 'var(--pd-muted)' }}><Loader2 className="h-5 w-5 animate-spin" /></span>
          <span className="text-sm font-medium" style={{ color: 'var(--pd-muted)' }}>Caricamento meteo…</span>
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
    <div className="pd-card overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-5">
          <div className="mb-4">
            <p className="text-sm font-medium" style={{ color: 'var(--pd-muted)' }}>Meteo settimana</p>
            <p className="pd-display text-xl font-semibold tracking-tight mt-0.5">{weather.location}, CH</p>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {weather.daily.map((day, i) => {
              const { icon: WeatherIcon } = getWeatherInfo(day.weatherCode)
              const isTodayItem = isToday(day.date)

              return (
                <div
                  key={i}
                  className="flex-shrink-0 flex flex-col items-center p-2.5 min-w-[56px] transition-all"
                  style={{
                    borderRadius: 'var(--pd-radius)',
                    background: isTodayItem ? 'var(--pd-accent-soft)' : 'var(--pd-surface-muted)',
                    border: isTodayItem ? '1px solid color-mix(in srgb, var(--pd-accent) 35%, transparent)' : '1px solid transparent',
                  }}
                >
                  <span className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--pd-muted)' }}>
                    {format(day.date, 'EEE', { locale: it })}
                  </span>
                  <span className="text-xs font-semibold mb-1.5" style={{ color: 'var(--pd-muted)' }}>
                    {format(day.date, 'd')}
                  </span>
                  <span style={{ color: isTodayItem ? 'var(--pd-accent)' : 'var(--pd-muted)' }}><WeatherIcon className="h-5 w-5 mb-1.5" /></span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--pd-text)' }}>
                    {day.tempMax}°
                  </span>
                  <span className="text-[10px] font-medium tabular-nums" style={{ color: 'var(--pd-muted)' }}>
                    {day.tempMin}°
                  </span>
                  {day.precipitation > 0 && (
                    <div className="flex items-center gap-0.5 mt-1" style={{ color: 'var(--pd-accent)' }}>
                      <Droplets className="h-2.5 w-2.5" />
                      <span className="text-[8px] font-medium">{Math.round(day.precipitation)} mm</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div
          className="lg:w-80 p-5 lg:border-l border-t lg:border-t-0"
          style={{ borderColor: 'var(--pd-border)', background: 'var(--pd-surface-muted)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--pd-muted)' }}>Oggi</p>
              <p className="text-sm font-semibold">{format(todayWeather.date, 'd MMMM', { locale: it })}</p>
            </div>
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ borderRadius: 'var(--pd-radius)', background: 'var(--pd-surface)' }}
            >
              <span style={{ color: 'var(--pd-accent)' }}><TodayIcon className="h-6 w-6" /></span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: 'var(--pd-accent)' }}><UtensilsCrossed className="h-3.5 w-3.5" /></span>
              <span className="text-xs font-semibold">Pranzo</span>
              <span className="text-[10px] font-medium" style={{ color: 'var(--pd-muted)' }}>11:00 – 14:00</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {todayWeather.hourly.filter(h => h.hour >= 11 && h.hour <= 14).map(hourData => {
                const { icon: HourIcon } = getWeatherInfo(hourData.weatherCode)
                return (
                  <div
                    key={hourData.hour}
                    className="p-2 text-center"
                    style={{ borderRadius: 'var(--pd-radius-sm)', background: 'var(--pd-surface)' }}
                  >
                    <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--pd-muted)' }}>{hourData.hour}:00</p>
                    <span className="mx-auto mb-1 inline-flex" style={{ color: 'var(--pd-muted)' }}><HourIcon className="h-4 w-4" /></span>
                    <p className="text-sm font-semibold tabular-nums">{hourData.temp}°</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: 'var(--pd-muted)' }}><Moon className="h-3.5 w-3.5" /></span>
              <span className="text-xs font-semibold">Cena</span>
              <span className="text-[10px] font-medium" style={{ color: 'var(--pd-muted)' }}>17:00 – 22:00</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {todayWeather.hourly.filter(h => h.hour >= 17 && h.hour <= 22).map(hourData => {
                const { icon: HourIcon } = getWeatherInfo(hourData.weatherCode)
                return (
                  <div
                    key={hourData.hour}
                    className="p-1.5 text-center"
                    style={{ borderRadius: 'var(--pd-radius-sm)', background: 'var(--pd-surface)' }}
                  >
                    <p className="text-[9px] font-medium mb-0.5" style={{ color: 'var(--pd-muted)' }}>{hourData.hour}</p>
                    <span className="mx-auto mb-0.5 inline-flex" style={{ color: 'var(--pd-muted)' }}><HourIcon className="h-3.5 w-3.5" /></span>
                    <p className="text-xs font-semibold tabular-nums">{hourData.temp}°</p>
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
