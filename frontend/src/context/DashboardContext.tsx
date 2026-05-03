import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useMemo } from 'react'

// Types
type DeviceStatus = 'on' | 'off'
type Trend = 'rising' | 'steady' | 'falling'

interface Device {
  id: number
  name: string
  room: string
  category: string
  status: DeviceStatus
  power_rating_watts: number
  current_power_usage_watts: number
  estimated_cost_rm_per_hour: number
  estimated_monthly_cost_rm: number
  high_consumption: boolean
  trend: Trend
  last_updated: string
}

interface Summary {
  total_power_usage_watts: number
  total_estimated_cost_rm_per_hour: number
  total_estimated_monthly_cost_rm: number
  high_consumption_devices: number
  efficiency_score: number
  last_updated: string
}

interface TopConsumer {
  id: number
  name: string
  room: string
  category: string
  current_power_usage_watts: number
  estimated_cost_rm_per_hour: number
  share_percent: number
}

interface LiveReading {
  id: number
  device_id: number
  device_name: string
  power_usage_watts: number
  estimated_cost_rm_per_hour: number
  is_high_consumption: boolean
  timestamp: string
}

interface WeeklyUsagePoint {
  date: string
  total_power_usage_watts: number
  total_estimated_cost_rm_per_hour: number
}

interface Toast {
  id: string
  deviceName: string
  newStatus: 'on' | 'off'
}

interface DashboardContextType {
  // Data
  devices: Device[]
  summary: Summary | null
  topConsumers: TopConsumer[]
  liveReadings: LiveReading[]
  weeklyTrend: WeeklyUsagePoint[]
  toasts: Toast[]

  // Loading States
  isPageLoading: boolean
  isRefreshing: boolean
  togglingId: number | null
  error: string | null

  // Device History Modal
  selectedDeviceId: number | null
  deviceHistoryCache: Record<number, LiveReading[]>
  deviceHistoryLoading: boolean
  deviceHistoryError: string | null
  deviceHistoryFilter: 'all' | 'running' | 'closed'

  // Form States
  isModalOpen: boolean
  isSubmitting: boolean

  // Advisor States
  executedAdvisorRanks: number[]
  expandedAdvisorRanks: number[]

  // Actions
  loadDashboard: (showSpinner?: boolean) => Promise<void>
  toggleDevice: (id: number) => Promise<void>
  openModal: () => void
  closeModal: () => void
  openDeviceHistory: (deviceId: number) => Promise<void>
  closeDeviceHistory: () => void
  setDeviceHistoryFilter: (filter: 'all' | 'running' | 'closed') => void
  executeAdvisorPlan: (recommendation?: any) => void
  toggleAdvisorDetails: (rank: number) => void
  setExecutedAdvisorRanks: (ranks: number[]) => void
  setExpandedAdvisorRanks: (ranks: number[]) => void
  showToast: (deviceName: string, newStatus: 'on' | 'off') => void
  setForm: (form: any) => void
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  setIsModalOpen: (open: boolean) => void
  form: any

  // Helpers
  forecastMaintenance: any
  maintenanceExplanation: any
  readingMetricHelper: any
  advisorRecommendations: any[]
  weeklySavingsPotential: number
  totalCost: number
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface DeviceFormState {
  name: string
  room: string
  category: string
  status: DeviceStatus
  power_rating_watts: string
}

const initialForm: DeviceFormState = {
  name: '',
  room: '',
  category: 'Appliance',
  status: 'on',
  power_rating_watts: '650',
}

// Utility functions (same as in index.tsx)
const formatWatts = (value: number) => `${value.toLocaleString('en-MY')} W`
const formatRM = (value: number) => `RM ${value.toFixed(2)}`
const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const formatReadingDate = (value: string) => new Date(value).toLocaleDateString('en-GB')
const formatWeekDate = (value: string) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' })

function hashForecastSeed(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function createForecastHelper(sessionSeed: number) {
  return (deviceId: number, readingId: number, status: DeviceStatus, timestamp: string, powerUsageWatts: number) => {
    const seed = hashForecastSeed(`${sessionSeed}-${deviceId}-${readingId}-${timestamp}`)
    const normalized = (Math.sin(seed) + 1) / 2
    const statusBias = status === 'on' ? 0.18 : 0.08
    const powerBias = Math.min(0.22, powerUsageWatts / 1200)
    const score = Math.min(0.98, normalized + statusBias + powerBias)

    let forecastStatus = 'Healthy'
    if (score > 0.86) {
      forecastStatus = 'Fault predicted'
    } else if (score > 0.7) {
      forecastStatus = 'Risk'
    } else if (score > 0.45) {
      forecastStatus = 'Monitor'
    }

    if (status === 'on') {
      if (forecastStatus === 'Fault predicted') forecastStatus = 'Risk'
      if (forecastStatus === 'Risk' && normalized < 0.72) forecastStatus = 'Monitor'
    } else {
      if (forecastStatus === 'Fault predicted') forecastStatus = 'Monitor'
      if (forecastStatus === 'Risk' && normalized < 0.78) forecastStatus = 'Monitor'
    }

    const confidence = Math.max(58, Math.min(97, Math.round(score * 100)))

    return {
      forecastStatus,
      confidence,
      note: 'Forecast based on recent energy pattern',
    }
  }
}

function createMaintenanceExplanationHelper(sessionSeed: number) {
  return (device: Device, reading: LiveReading, previousReading: LiveReading | undefined, forecast: any) => {
    if (forecast.forecastStatus === 'Healthy') {
      return null
    }

    const seed = hashForecastSeed(`${sessionSeed}-${device.id}-${reading.id}-${reading.timestamp}`)
    const currentLoad = reading.power_usage_watts
    const previousLoad = previousReading?.power_usage_watts ?? currentLoad
    const loadDelta = currentLoad - previousLoad
    const loadDeltaPercent = previousLoad > 0 ? Math.round((loadDelta / previousLoad) * 100) : 0
    const nearLimit = currentLoad >= device.power_rating_watts * 0.85
    const statusFlip = previousReading ? previousReading.power_usage_watts >= 3 !== currentLoad >= 3 : false

    const category = `${device.name} ${device.category}`.toLowerCase()
    const maintenanceStep = category.includes('cooling') || category.includes('refrigerator') || category.includes('air conditioner')
      ? 'clean filters and check the compressor'
      : category.includes('heating') || category.includes('water heater')
        ? 'descale the heater and verify the thermostat'
        : category.includes('lighting') || category.includes('lamp')
          ? 'check the bulb, fixture, and wiring'
        : category.includes('cleaning') || category.includes('washer')
          ? 'check the drum, belt, and inlet filter'
          : category.includes('cooking') || category.includes('oven')
            ? 'inspect heating elements and ventilation'
            : category.includes('entertainment') || category.includes('tv')
              ? 'check ventilation and standby draw'
              : 'inspect wiring, plugs, and runtime balance'

    const riskSignal =
      forecast.forecastStatus === 'Fault predicted'
        ? 'The readings suggest this appliance needs attention soon.'
        : forecast.forecastStatus === 'Risk'
          ? 'This device is using more power than usual, so it is worth checking soon.'
          : 'This device is showing a small change in usage, so a quick check is enough for now.'

    const patternSignal =
      loadDeltaPercent >= 20
        ? `Power is up by about ${Math.abs(loadDeltaPercent)}% from the previous reading.`
        : loadDeltaPercent <= -20
          ? `Power is down by about ${Math.abs(loadDeltaPercent)}% from the previous reading.`
          : statusFlip
            ? 'The device switched state between readings, which can add extra wear over time.'
            : nearLimit
              ? `Current load is close to the device limit at ${Math.round((currentLoad / device.power_rating_watts) * 100)}% of rated power.`
              : 'Usage has been fairly steady in the latest readings.'

    const nextActionLabel =
      forecast.forecastStatus === 'Fault predicted'
        ? 'Schedule service'
        : forecast.forecastStatus === 'Risk'
          ? 'Check soon'
          : 'Keep an eye on it'

    const actionVerb =
      forecast.forecastStatus === 'Fault predicted'
        ? 'Book maintenance this week and reduce heavy use until it is checked.'
        : forecast.forecastStatus === 'Risk'
          ? 'Plan a quick inspection and avoid long continuous runs for now.'
          : 'Give it a routine check and compare the next few readings.'

    const fallbackHint = seed % 3 === 0 ? 'A quick cleaning or airflow check may help keep it steady.' : seed % 3 === 1 ? 'Try to avoid long continuous runs if you can.' : 'Watch whether the same spike shows up again later.'

    return {
      summary: riskSignal,
      cause: `${patternSignal} The best next step is to ${maintenanceStep}.`,
      nextAction: `${actionVerb} ${fallbackHint}`,
      actionLabel: nextActionLabel,
    }
  }
}

function createReadingMetricHelper(sessionSeed: number) {
  return (device: Device, reading: LiveReading) => {
    const seed = hashForecastSeed(`${sessionSeed}-${device.id}-${reading.id}-${reading.timestamp}`)
    const base = (seed % 1000) / 1000

    if (device.name.toLowerCase().includes('air conditioner') || device.category.toLowerCase().includes('cooling')) {
      const temperature = 18 + Math.round((base * 8) % 8)
      const windSpeeds = ['Low', 'Medium', 'High', 'Auto']
      const windSpeed = windSpeeds[seed % windSpeeds.length]
      return [
        { label: 'Temp set', value: `${temperature}°C` },
        { label: 'Wind speed', value: windSpeed },
      ]
    }

    if (device.category.toLowerCase().includes('heating') || device.name.toLowerCase().includes('heater')) {
      const temperature = 45 + Math.round(base * 15)
      return [
        { label: 'Target temp', value: `${temperature}°C` },
        { label: 'Heat cycle', value: seed % 2 === 0 ? 'Active' : 'Standby' },
      ]
    }

    if (device.category.toLowerCase().includes('cooling') || device.name.toLowerCase().includes('refrigerator')) {
      const temperature = 2 + Math.round(base * 4)
      return [
        { label: 'Compartment temp', value: `${temperature}°C` },
        { label: 'Compressor', value: seed % 3 === 0 ? 'Cycling' : 'Stable' },
      ]
    }

    if (device.category.toLowerCase().includes('lighting') || device.name.toLowerCase().includes('lamp')) {
      const brightness = 50 + Math.round(base * 40)
      return [
        { label: 'Brightness', value: `${brightness}%` },
        { label: 'Driver', value: seed % 2 === 0 ? 'Stable' : 'Warm' },
      ]
    }

    if (device.category.toLowerCase().includes('entertainment') || device.name.toLowerCase().includes('tv')) {
      const brightness = 40 + Math.round(base * 40)
      return [
        { label: 'Brightness', value: `${brightness}%` },
        { label: 'Audio', value: seed % 2 === 0 ? 'Stereo' : 'Cinema' },
      ]
    }

    if (device.category.toLowerCase().includes('cleaning') || device.name.toLowerCase().includes('washer')) {
      const cycleMinutes = 25 + Math.round(base * 20)
      return [
        { label: 'Cycle time', value: `${cycleMinutes} min` },
        { label: 'Load', value: seed % 2 === 0 ? 'Full' : 'Half' },
      ]
    }

    if (device.category.toLowerCase().includes('cooking') || device.name.toLowerCase().includes('oven') || device.name.toLowerCase().includes('rice')) {
      const temperature = 80 + Math.round(base * 80)
      return [
        { label: 'Heat level', value: `${temperature}°C` },
        { label: 'Timer', value: `${15 + (seed % 30)} min` },
      ]
    }

    const loadFactor = 1 + Math.round(base * 3)
    return [
      { label: 'Load factor', value: `x${loadFactor}` },
      { label: 'Duty cycle', value: seed % 2 === 0 ? 'Balanced' : 'Peaking' },
    ]
  }
}

interface AdvisorRecommendation {
  rank: number
  title: string
  deviceName: string
  savingsRmWeekly: number
  effort: string
  confidence: string
  reason: string
  adjustments: string[]
  accent: string
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function buildAdvisorRecommendations(devices: Device[], summary: Summary | null): AdvisorRecommendation[] {
  const rankedDevices = [...devices].sort((a, b) => b.current_power_usage_watts - a.current_power_usage_watts)
  const topThree = rankedDevices.slice(0, 3)

  const templates: Array<Pick<AdvisorRecommendation, 'title' | 'effort' | 'confidence' | 'reason' | 'accent'>> = [
    {
      title: 'Shift runtime out of peak hours',
      effort: 'Low',
      confidence: 'High',
      reason: 'This appliance has the largest load spikes, so trimming runtime during busy hours produces the fastest savings.',
      accent: 'primary',
    },
    {
      title: 'Reduce standby and preheat cycles',
      effort: 'Low',
      confidence: 'High',
      reason: 'High-consumption heating cycles create avoidable cost, especially when the appliance stays warm longer than needed.',
      accent: 'secondary',
    },
    {
      title: 'Batch usage into one off-peak window',
      effort: 'Medium',
      confidence: 'Medium',
      reason: 'Grouping this appliance with other routine loads helps flatten the weekly demand curve and lower the total bill.',
      accent: 'muted',
    },
  ]

  return topThree.map((device, index) => {
    const hourlyCost = device.estimated_cost_rm_per_hour
    const savingsMultiplier = index === 0 ? 9.5 : index === 1 ? 7.2 : 4.8
    const adjustment = summary ? 1 + Math.min(0.14, summary.high_consumption_devices * 0.02) : 1
    const savingsRmWeekly = roundToTwo(hourlyCost * savingsMultiplier * adjustment)
    const template = templates[index]

    return {
      rank: index + 1,
      title: template.title,
      deviceName: device.name,
      savingsRmWeekly,
      effort: template.effort,
      confidence: template.confidence,
      reason: template.reason,
      adjustments:
        index === 0
          ? ['Move usage to early morning or after 10 PM', 'Shorten active runtime by 10–15 minutes', 'Avoid repeated on/off cycles']
          : index === 1
            ? ['Lower standby duration', 'Reduce preheat time by one step', 'Turn off when the room is already comfortable']
            : ['Batch this load with other off-peak devices', 'Run once per day instead of multiple times', 'Keep the cycle away from the dinner peak'],
      accent: template.accent,
    }
  })
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [topConsumers, setTopConsumers] = useState<TopConsumer[]>([])
  const [liveReadings, setLiveReadings] = useState<LiveReading[]>([])
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyUsagePoint[]>([])
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<DeviceFormState>(initialForm)
  const [executedAdvisorRanks, setExecutedAdvisorRanks] = useState<number[]>([])
  const [expandedAdvisorRanks, setExpandedAdvisorRanks] = useState<number[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [deviceHistoryCache, setDeviceHistoryCache] = useState<Record<number, LiveReading[]>>({})
  const [deviceHistoryLoading, setDeviceHistoryLoading] = useState(false)
  const [deviceHistoryError, setDeviceHistoryError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [deviceHistoryFilter, setDeviceHistoryFilter] = useState<'all' | 'running' | 'closed'>('all')
  const forecastSessionSeed = useRef(Math.floor(Math.random() * 1_000_000_000))

  const totalCost = useMemo(() => summary?.total_estimated_cost_rm_per_hour ?? 0, [summary])
  const advisorRecommendations = useMemo(() => buildAdvisorRecommendations(devices, summary), [devices, summary])
  const weeklySavingsPotential = useMemo(() => advisorRecommendations.reduce((sum, rec) => sum + rec.savingsRmWeekly, 0), [advisorRecommendations])

  const forecastMaintenance = useMemo(() => createForecastHelper(forecastSessionSeed.current), [])
  const maintenanceExplanation = useMemo(() => createMaintenanceExplanationHelper(forecastSessionSeed.current), [])
  const readingMetricHelper = useMemo(() => createReadingMetricHelper(forecastSessionSeed.current), [])

  const loadDashboard = async (showSpinner = false) => {
    if (showSpinner) {
      setIsRefreshing(true)
    }

    try {
      const [devicesData, summaryData, topConsumersData, liveData, weeklyData] = await Promise.all([
        requestJson<Device[]>('/api/devices'),
        requestJson<Summary>('/api/energy-summary'),
        requestJson<TopConsumer[]>('/api/top-consumers?limit=3'),
        requestJson<LiveReading[]>('/api/live-readings'),
        requestJson<WeeklyUsagePoint[]>('/api/weekly-usage'),
      ])

      setDevices(devicesData)
      setSummary(summaryData)
      setTopConsumers(topConsumersData)
      setLiveReadings(liveData)
      setWeeklyTrend(weeklyData)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard')
    } finally {
      setIsPageLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboard(true)
    const timer = window.setInterval(() => {
      loadDashboard(false)
    }, 4500)
    return () => window.clearInterval(timer)
  }, [])

  const openModal = () => {
    setForm(initialForm)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const openDeviceHistory = async (deviceId: number) => {
    setSelectedDeviceId(deviceId)
    setDeviceHistoryError(null)

    if (deviceHistoryCache[deviceId]) return

    try {
      setDeviceHistoryLoading(true)
      const readings = await requestJson<LiveReading[]>(`/api/devices/${deviceId}/readings`)
      setDeviceHistoryCache((curr) => ({ ...curr, [deviceId]: readings }))
    } catch (err) {
      setDeviceHistoryError(err instanceof Error ? err.message : 'Unable to load device history')
    } finally {
      setDeviceHistoryLoading(false)
    }
  }

  const closeDeviceHistory = () => {
    setSelectedDeviceId(null)
    setDeviceHistoryError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await requestJson<Device>('/api/devices', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          power_rating_watts: Number(form.power_rating_watts),
        }),
      })

      setIsModalOpen(false)
      setForm(initialForm)
      await loadDashboard(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add device')
    } finally {
      setIsSubmitting(false)
    }
  }

  const showToast = (deviceName: string, newStatus: 'on' | 'off') => {
    const toastId = `${Date.now()}-${Math.random()}`
    const toast: Toast = { id: toastId, deviceName, newStatus }
    setToasts((current) => [...current, toast])
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== toastId))
    }, 2000)
  }

  const toggleDevice = async (id: number) => {
    try {
      setTogglingId(id)
      const device = devices.find((d) => d.id === id)
      const newStatus = device?.status === 'on' ? 'off' : 'on'
      await requestJson<Device>(`/api/devices/${id}/toggle`, { method: 'POST' })
      await loadDashboard(true)
      if (device?.name) {
        showToast(device.name, newStatus)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to toggle device')
    } finally {
      setTogglingId(null)
    }
  }

  const executeAdvisorPlan = (recommendation?: AdvisorRecommendation) => {
    if (recommendation) {
      const isNewExecution = !executedAdvisorRanks.includes(recommendation.rank)
      setExecutedAdvisorRanks((current) => {
        if (current.includes(recommendation.rank)) {
          return current
        }
        return [...current, recommendation.rank]
      })
      if (isNewExecution) {
        showToast(`${recommendation.deviceName} plan`, 'on')
      }
    } else {
      setExecutedAdvisorRanks(advisorRecommendations.map((rec) => rec.rank))
    }
  }

  const toggleAdvisorDetails = (rank: number) => {
    setExpandedAdvisorRanks((current) =>
      current.includes(rank) ? current.filter((item) => item !== rank) : [...current, rank],
    )
  }

  const value: DashboardContextType = {
    devices,
    summary,
    topConsumers,
    liveReadings,
    weeklyTrend,
    toasts,
    isPageLoading,
    isRefreshing,
    togglingId,
    error,
    selectedDeviceId,
    deviceHistoryCache,
    deviceHistoryLoading,
    deviceHistoryError,
    deviceHistoryFilter,
    isModalOpen,
    isSubmitting,
    executedAdvisorRanks,
    expandedAdvisorRanks,
    loadDashboard,
    toggleDevice,
    openModal,
    closeModal,
    openDeviceHistory,
    closeDeviceHistory,
    setDeviceHistoryFilter,
    executeAdvisorPlan,
    toggleAdvisorDetails,
    setExecutedAdvisorRanks,
    setExpandedAdvisorRanks,
    showToast,
    setForm,
    handleSubmit,
    setIsModalOpen,
    form,
    forecastMaintenance,
    maintenanceExplanation,
    readingMetricHelper,
    advisorRecommendations,
    weeklySavingsPotential,
    totalCost,
  }

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider')
  }
  return context
}

export { formatWatts, formatRM, formatTime, formatReadingDate, formatWeekDate }
