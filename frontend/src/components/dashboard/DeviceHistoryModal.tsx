import { useMemo, type RefObject } from 'react'
import PowerChart from '@/components/PowerChart'

type DeviceStatus = 'on' | 'off'
type ForecastStatus = 'Healthy' | 'Monitor' | 'Risk' | 'Fault predicted'

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
  trend: 'rising' | 'steady' | 'falling'
  last_updated: string
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

interface ReadingMetric {
  label: string
  value: string
}

interface ForecastInfo {
  forecastStatus: ForecastStatus
  confidence: number
  note: string
}

interface MaintenanceInsight {
  summary: string
  cause: string
  nextAction: string
  actionLabel: string
}

interface DeviceHistoryModalProps {
  selectedDeviceId: number | null
  devices: any[]
  deviceHistoryCache: Record<number, LiveReading[]>
  deviceHistoryLoading: boolean
  deviceHistoryError: string | null
  deviceHistoryFilter: 'all' | 'running' | 'closed'
  onSetDeviceHistoryFilter: (value: 'all' | 'running' | 'closed') => void
  onClose: () => void
  modalRef: RefObject<HTMLDivElement>
  forecastMaintenance: (deviceId: number, readingId: number, status: DeviceStatus, timestamp: string, powerUsageWatts: number) => ForecastInfo
  maintenanceExplanation: (device: any, reading: any, previousReading: any, forecast: ForecastInfo) => MaintenanceInsight | null
  readingMetricHelper: (device: any, reading: any) => ReadingMetric[]
  exportReadingsToCSV: (readings: LiveReading[], deviceName: string) => void
  formatWatts: (value: number) => string
  formatTime: (value: string) => string
  formatReadingDate: (value: string) => string
}

export default function DeviceHistoryModal({
  selectedDeviceId,
  devices,
  deviceHistoryCache,
  deviceHistoryLoading,
  deviceHistoryError,
  deviceHistoryFilter,
  onSetDeviceHistoryFilter,
  onClose,
  modalRef,
  forecastMaintenance,
  maintenanceExplanation,
  readingMetricHelper,
  exportReadingsToCSV,
  formatWatts,
  formatTime,
  formatReadingDate,
}: DeviceHistoryModalProps) {
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null
  const allReadings = selectedDeviceId !== null ? deviceHistoryCache[selectedDeviceId] ?? [] : []

  const filteredReadings = useMemo(() => {
    return allReadings.filter((reading) => {
      const isRunning = reading.power_usage_watts >= 3
      if (deviceHistoryFilter === 'running') return isRunning
      if (deviceHistoryFilter === 'closed') return !isRunning
      return true
    })
  }, [allReadings, deviceHistoryFilter])

  const sortedReadings = useMemo(() => {
    return [...filteredReadings].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
  }, [filteredReadings])

  const groupedReadings = useMemo(() => {
    return sortedReadings.reduce<Array<{ date: string; readings: LiveReading[] }>>((groups, reading) => {
      const dateKey = formatReadingDate(reading.timestamp)
      const group = groups[groups.length - 1]

      if (group?.date === dateKey) {
        group.readings.push(reading)
      } else {
        groups.push({ date: dateKey, readings: [reading] })
      }

      return groups
    }, [])
  }, [sortedReadings, formatReadingDate])

  if (selectedDeviceId === null || !selectedDevice) {
    return null
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="modal" ref={modalRef} onClick={(event) => event.stopPropagation()} tabIndex={-1}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{selectedDevice.name ?? 'Device history'}</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
              <div className="modal-sub">{selectedDevice.current_power_usage_watts ? `Current: ${formatWatts(selectedDevice.current_power_usage_watts)}` : ''}</div>
              <span className={`pill ${selectedDevice.status === 'on' || selectedDevice.current_power_usage_watts >= 3 ? 'pill-green' : 'pill-red'}`}>
                {selectedDevice.status === 'on' || selectedDevice.current_power_usage_watts >= 3 ? 'Running' : 'Closed'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="button button-secondary"
              onClick={() => exportReadingsToCSV(allReadings, selectedDevice.name)}
              style={{ fontSize: 13, padding: '6px 12px' }}
              type="button"
            >
              Export CSV
            </button>
            <button className="modal-close" onClick={onClose} aria-label="Close history">×</button>
          </div>
        </div>

        <div className="modal-body">
          {deviceHistoryLoading && !deviceHistoryCache[selectedDeviceId] ? (
            <div style={{ padding: 24, textAlign: 'center' }}>Loading history…</div>
          ) : deviceHistoryError ? (
            <div style={{ padding: 24, color: '#ef4444' }}>{deviceHistoryError}</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={`filter-btn ${deviceHistoryFilter === 'all' ? 'active' : ''}`} onClick={() => onSetDeviceHistoryFilter('all')} type="button">All</button>
                  <button className={`filter-btn ${deviceHistoryFilter === 'running' ? 'active' : ''}`} onClick={() => onSetDeviceHistoryFilter('running')} type="button">Running</button>
                  <button className={`filter-btn ${deviceHistoryFilter === 'closed' ? 'active' : ''}`} onClick={() => onSetDeviceHistoryFilter('closed')} type="button">Closed</button>
                </div>
                <div style={{ color: '#64748b' }}>{filteredReadings.length} readings</div>
              </div>

              <PowerChart
                series={filteredReadings.map((reading) => reading.power_usage_watts)}
                labels={filteredReadings.map((reading) => new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
              />

              <div style={{ marginTop: 12 }}>
                <div className="ml-section-label">Machine Learning Predictive Maintenance</div>
                <strong>Recent readings</strong>
                <div style={{ marginTop: 8, maxHeight: 160, overflow: 'auto' }}>
                  {groupedReadings.map((group) => (
                    <div key={group.date} style={{ marginBottom: 12 }}>
                      <div className="reading-date-header">{group.date}</div>
                      {group.readings.map((reading) => {
                        const isRunning = reading.power_usage_watts >= 3
                        const readingIndex = sortedReadings.findIndex((candidate) => candidate.id === reading.id)
                        const previousReading = readingIndex >= 0 ? sortedReadings[readingIndex + 1] : undefined
                        const forecast = forecastMaintenance(
                          reading.device_id,
                          reading.id,
                          isRunning ? 'on' : 'off',
                          reading.timestamp,
                          reading.power_usage_watts,
                        )
                        const explanation = maintenanceExplanation(selectedDevice, reading, previousReading, forecast)
                        const forecastClass = forecast.forecastStatus === 'Healthy' ? 'pill-green' : forecast.forecastStatus === 'Monitor' ? 'pill-amber' : 'pill-red'

                        return (
                          <div key={reading.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                            <div>
                              <div style={{ color: '#475569' }}>{formatTime(reading.timestamp)}</div>
                              <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span className={`pill ${isRunning ? 'pill-green' : 'pill-red'}`} style={{ padding: '6px 10px', fontSize: 12 }}>
                                  {isRunning ? 'Running' : 'Closed'}
                                </span>
                                <span className={`pill ${forecastClass}`} style={{ padding: '6px 10px', fontSize: 12 }}>
                                  {forecast.forecastStatus}
                                </span>
                              </div>
                              <div className="forecast-note">
                                {forecast.note} · {forecast.confidence}% confidence
                              </div>
                              {explanation ? (
                                <div className="maintenance-explanation">
                                  <div className="ml-section-label">AI maintenance note</div>
                                  <div className="maintenance-summary">{explanation.summary}</div>
                                  <div className="maintenance-cause">{explanation.cause}</div>
                                  <div className="maintenance-next-action">
                                    <span className="maintenance-action-label">Next action</span>
                                    <span className="maintenance-action-chip">{explanation.actionLabel}</span>
                                  </div>
                                  <div className="maintenance-next-action-text">{explanation.nextAction}</div>
                                </div>
                              ) : null}
                              <div className="reading-metrics">
                                {readingMetricHelper(selectedDevice, reading).map((metric) => (
                                  <span className="reading-metric" key={`${reading.id}-${metric.label}`}>
                                    <span className="reading-metric-label">{metric.label}</span>
                                    <strong>{metric.value}</strong>
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div style={{ fontWeight: 700 }}>{formatWatts(reading.power_usage_watts)}</div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
