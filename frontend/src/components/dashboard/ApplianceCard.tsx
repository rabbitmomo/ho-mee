interface ApplianceCardDevice {
  id: number
  name: string
  room: string
  category: string
  status: 'on' | 'off'
  current_power_usage_watts: number
  estimated_cost_rm_per_hour: number
  estimated_monthly_cost_rm: number
  high_consumption: boolean
  trend: string
}

interface ApplianceCardProps {
  device: ApplianceCardDevice
  togglingId: number | null
  onOpenHistory: (id: number) => void
  onToggle: (id: number) => void
  formatWatts: (value: number) => string
  formatRM: (value: number) => string
}

export default function ApplianceCard({ device, togglingId, onOpenHistory, onToggle, formatWatts, formatRM }: ApplianceCardProps) {
  return (
    <article
      className="device-card"
      key={device.id}
      role="button"
      tabIndex={0}
      onClick={() => onOpenHistory(device.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenHistory(device.id)
        }
      }}
    >
      <div className="device-head">
        <div>
          <h3 className="device-name">{device.name}</h3>
          <div className="device-room">
            {device.room} · {device.category}
          </div>
        </div>
        <button
          className={`button ${device.status === 'on' ? 'button-primary' : 'button-secondary'}`}
          onClick={(event) => {
            event.stopPropagation()
            onToggle(device.id)
          }}
          disabled={togglingId === device.id}
          style={{ padding: '8px 12px', fontSize: 12 }}
        >
          {togglingId === device.id ? '...' : device.status === 'on' ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <span className={`pill ${device.high_consumption ? 'pill-red' : 'pill-green'}`}>
          {device.high_consumption ? 'High usage' : device.status === 'on' ? 'Running' : 'Off'}
        </span>
      </div>

      <div className="device-metrics">
        <div className="metric-box">
          <div className="metric-label">Power</div>
          <div className="metric-value">{formatWatts(device.current_power_usage_watts)}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Cost / hour</div>
          <div className="metric-value">{formatRM(device.estimated_cost_rm_per_hour)}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Monthly</div>
          <div className="metric-value">{formatRM(device.estimated_monthly_cost_rm)}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Trend</div>
          <div className="metric-value">{device.trend}</div>
        </div>
      </div>
    </article>
  )
}
