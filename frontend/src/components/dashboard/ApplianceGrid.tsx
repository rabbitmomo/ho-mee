import { useMemo, useState } from 'react'
import ApplianceCard from '@/components/dashboard/ApplianceCard'

interface ApplianceGridDevice {
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

type DeviceSort = 'power' | 'cost-hour' | 'monthly-cost'
type DeviceFilter = 'all' | 'running' | 'off'

interface ApplianceGridProps {
  devices: ApplianceGridDevice[]
  togglingId: number | null
  onOpenHistory: (id: number) => void
  onToggle: (id: number) => void
  maxDevices?: number
  showControls?: boolean
}

export default function ApplianceGrid({ devices, togglingId, onOpenHistory, onToggle, maxDevices, showControls = true }: ApplianceGridProps) {
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all')
  const [deviceSort, setDeviceSort] = useState<DeviceSort>('power')

  const visibleDevices = useMemo(() => {
    const filtered = devices.filter((device) => {
      const isRunning = device.status === 'on'
      if (deviceFilter === 'running') return isRunning
      if (deviceFilter === 'off') return !isRunning
      return true
    })

    const sortValueForDevice = (device: ApplianceGridDevice) => {
      if (deviceSort === 'cost-hour') return device.estimated_cost_rm_per_hour
      if (deviceSort === 'monthly-cost') return device.estimated_monthly_cost_rm
      return device.current_power_usage_watts
    }

    const sorted = [...filtered].sort((left, right) => {
      const rightValue = sortValueForDevice(right)
      const leftValue = sortValueForDevice(left)

      if (rightValue !== leftValue) {
        return rightValue - leftValue
      }

      return left.name.localeCompare(right.name)
    })

    return typeof maxDevices === 'number' ? sorted.slice(0, maxDevices) : sorted
  }, [devices, deviceFilter, deviceSort, maxDevices])

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        <h2 className="panel-title">Appliance snapshot</h2>
        <span className="pill pill-amber">{devices.length} devices</span>
      </div>

      {showControls ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <p className="panel-copy">Tracked devices with live usage, RM estimate, and consumption trend.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className={`filter-btn ${deviceFilter === 'all' ? 'active' : ''}`} onClick={() => setDeviceFilter('all')} type="button">All</button>
              <button className={`filter-btn ${deviceFilter === 'running' ? 'active' : ''}`} onClick={() => setDeviceFilter('running')} type="button">Running</button>
              <button className={`filter-btn ${deviceFilter === 'off' ? 'active' : ''}`} onClick={() => setDeviceFilter('off')} type="button">Off</button>
            </div>
          </div>

          <div className="status-filter" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{visibleDevices.length} shown</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 600 }} htmlFor="device-sort">
                Sort by
              </label>
              <select
                id="device-sort"
                value={deviceSort}
                onChange={(e) => setDeviceSort(e.target.value as DeviceSort)}
                style={{
                  border: '1px solid rgba(148, 163, 184, 0.28)',
                  borderRadius: 12,
                  background: '#fff',
                  color: '#0f172a',
                  padding: '8px 12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <option value="power">Power</option>
                <option value="cost-hour">Cost / hour</option>
                <option value="monthly-cost">Monthly cost</option>
              </select>
            </div>
          </div>
        </>
      ) : (
        <p className="panel-copy" style={{ marginBottom: 18 }}>
          A compact snapshot of the most important devices right now.
        </p>
      )}

      <div className="device-grid" style={{ marginTop: 8 }}>
        {visibleDevices.map((device) => (
          <ApplianceCard
            key={device.id}
            device={device}
            togglingId={togglingId}
            onOpenHistory={onOpenHistory}
            onToggle={onToggle}
            formatWatts={(value) => `${value.toLocaleString('en-MY')} W`}
            formatRM={(value) => `RM ${value.toFixed(2)}`}
          />
        ))}
      </div>
    </div>
  )
}
