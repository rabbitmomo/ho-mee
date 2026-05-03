import { useMemo } from 'react'
import UsageTrendPanel from '@/components/dashboard/UsageTrendPanel'
import SummaryCards from '@/components/dashboard/SummaryCards'
import { useDashboard, formatWatts, formatRM, formatWeekDate } from '@/context/DashboardContext'

function exportWeeklyTrendToCSV(weeklyTrend: any[], devices: any[]) {
  const headers = ['Date', 'Total Power (W)', 'Total Cost (RM/hr)']
  const rows = weeklyTrend.map((point) => [
    new Date(point.date).toLocaleDateString('en-GB'),
    point.total_power_usage_watts.toString(),
    point.total_estimated_cost_rm_per_hour.toFixed(2),
  ])

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"` ).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `energy-analytics-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function Analytics() {
  const {
    summary,
    weeklyTrend,
    devices,
    toasts,
  } = useDashboard()

  const avgWeeklyPower = useMemo(() => {
    if (weeklyTrend.length === 0) return 0
    const total = weeklyTrend.reduce((sum, point) => sum + point.total_power_usage_watts, 0)
    return Math.round(total / weeklyTrend.length)
  }, [weeklyTrend])

  const avgWeeklyCost = useMemo(() => {
    if (weeklyTrend.length === 0) return 0
    const total = weeklyTrend.reduce((sum, point) => sum + point.total_estimated_cost_rm_per_hour, 0)
    return (total / weeklyTrend.length).toFixed(2)
  }, [weeklyTrend])

  const peakPower = useMemo(() => {
    if (weeklyTrend.length === 0) return 0
    return Math.max(...weeklyTrend.map((point) => point.total_power_usage_watts))
  }, [weeklyTrend])

  const trendDelta = useMemo(() => {
    if (weeklyTrend.length < 2) return 0
    const firstPoint = weeklyTrend[0]?.total_power_usage_watts ?? 0
    const lastPoint = weeklyTrend[weeklyTrend.length - 1]?.total_power_usage_watts ?? 0
    return lastPoint - firstPoint
  }, [weeklyTrend])

  const trendDirection = trendDelta > 0 ? 'Upward' : trendDelta < 0 ? 'Downward' : 'Flat'

  return (
    <div className="page-shell">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.newStatus === 'on' ? 'toast-on' : 'toast-off'}`}
          >
            <span className="toast-device">{toast.deviceName}</span>
            <span className="toast-status">turned {toast.newStatus}</span>
          </div>
        ))}
      </div>

      <main className="dashboard">
        <section className="analytics-hero panel">
          <div className="analytics-hero-main">
            <div className="eyebrow">Analytics & Reports</div>
            <h1 className="hero-title">Historical energy reports with AI-style clarity</h1>
            <p className="hero-copy">
              A compact reporting view for the last 7 days, designed to make trends, cost, and efficiency easy to scan at a glance.
            </p>

            <div className="analytics-meta-grid">
              <div className="analytics-meta-card">
                <span className="analytics-meta-label">Average weekly power</span>
                <strong>{formatWatts(avgWeeklyPower)}</strong>
                <span>Last 7 days</span>
              </div>
              <div className="analytics-meta-card">
                <span className="analytics-meta-label">Average weekly cost</span>
                <strong>{formatRM(Number(avgWeeklyCost))}</strong>
                <span>Per hour</span>
              </div>
              <div className="analytics-meta-card">
                <span className="analytics-meta-label">Peak power usage</span>
                <strong>{formatWatts(peakPower)}</strong>
                <span>This week</span>
              </div>
              <div className="analytics-meta-card analytics-meta-accent">
                <span className="analytics-meta-label">Efficiency score</span>
                <strong>{summary ? `${summary.efficiency_score}/100` : '—'}</strong>
                <span>Current status</span>
              </div>
            </div>
          </div>

          <div className="analytics-hero-side">
            <button className="button button-primary analytics-export-button" onClick={() => exportWeeklyTrendToCSV(weeklyTrend, devices)}>
              Export to CSV
            </button>

            <div className="analytics-export-card">
              <div className="signal-label">Report signal</div>
              <div className="analytics-export-value">{trendDirection}</div>
              <p>
                Weekly trend movement is {trendDirection.toLowerCase()} by {formatWatts(Math.abs(trendDelta))} from the first to the last recorded day.
              </p>
            </div>

            <div className="analytics-export-card analytics-export-card-muted">
              <div className="signal-label">Insights at a glance</div>
              <div className="analytics-export-value">{summary ? summary.high_consumption_devices : 0} alerts</div>
              <p>High-consumption devices remain the most likely waste source to review first.</p>
            </div>
          </div>
        </section>

        <section className="analytics-panels">
          <div className="analytics-panel-wrap">
            <div className="panel-heading-row">
              <div>
                <h2 className="panel-title">Current status</h2>
                <p className="panel-copy">A concise snapshot of live usage, cost, and likely waste signals.</p>
              </div>
              <span className="pill pill-green">Live snapshot</span>
            </div>
            <SummaryCards summary={summary} formatWatts={formatWatts} formatRM={formatRM} variant="compact" />
          </div>

          <div className="analytics-panel-wrap analytics-panel-wrap-chart">
            <div className="panel-heading-row">
              <div>
                <h2 className="panel-title">Weekly trend</h2>
                <p className="panel-copy">Seven days of total load, framed as a reporting surface instead of a raw chart block.</p>
              </div>
              <span className="pill pill-amber">{summary ? `${summary.high_consumption_devices} alerts` : '—'}</span>
            </div>
            <UsageTrendPanel summary={summary} weeklyTrend={weeklyTrend} formatWeekDate={formatWeekDate} formatWatts={formatWatts} formatRM={formatRM} />
          </div>
        </section>
      </main>
    </div>
  )
}
