interface LiveReading {
  id: number
  device_name: string
  power_usage_watts: number
  estimated_cost_rm_per_hour: number
  timestamp: string
}

interface LiveActivityPanelProps {
  liveReadings: LiveReading[]
  formatTime: (value: string) => string
  formatWatts: (value: number) => string
  formatRM: (value: number) => string
  maxReadings?: number
}

export default function LiveActivityPanel({ liveReadings, formatTime, formatWatts, formatRM, maxReadings }: LiveActivityPanelProps) {
  const visibleReadings = typeof maxReadings === 'number'
    ? liveReadings.slice(0, maxReadings)
    : liveReadings

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Live activity</h2>
          <p className="panel-copy">Auto-updating readings from the current feed.</p>
        </div>
      </div>

      <div className="drawer">
        {visibleReadings.map((reading) => (
          <div className="live-row" key={reading.id}>
            <div>
              <p className="live-title">{reading.device_name}</p>
              <div className="activity-time">{formatTime(reading.timestamp)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="live-value">{formatWatts(reading.power_usage_watts)}</div>
              <div className="device-meta">{formatRM(reading.estimated_cost_rm_per_hour)} / hour</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
