import PowerChart from '@/components/PowerChart'

interface WeeklyUsagePoint {
  date: string
  total_power_usage_watts: number
}

interface UsageTrendSummary {
  high_consumption_devices: number
  total_power_usage_watts: number
  total_estimated_cost_rm_per_hour: number
  efficiency_score: number
}

interface UsageTrendPanelProps {
  summary: UsageTrendSummary | null
  weeklyTrend: WeeklyUsagePoint[]
  formatWeekDate: (value: string) => string
  formatWatts: (value: number) => string
  formatRM: (value: number) => string
}

export default function UsageTrendPanel({ summary, weeklyTrend, formatWeekDate, formatWatts, formatRM }: UsageTrendPanelProps) {
  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Weekly usage trend</h2>
          <p className="panel-copy">Seven days of total load showing how consumption grows across the week.</p>
          <span className="pill pill-amber trend-alert-pill">{summary ? `${summary.high_consumption_devices} alerts` : '—'}</span>
        </div>
      </div>

      <div className="chart-signals">
        <div className="signal-chip">
          <div className="signal-label">Current load</div>
          <div className="signal-value">{summary ? formatWatts(summary.total_power_usage_watts) : '—'}</div>
        </div>
        <div className="signal-chip">
          <div className="signal-label">Hourly cost</div>
          <div className="signal-value">{summary ? formatRM(summary.total_estimated_cost_rm_per_hour) : '—'}</div>
        </div>
        <div className="signal-chip">
          <div className="signal-label">Efficiency score</div>
          <div className="signal-value">{summary ? `${summary.efficiency_score}/100` : '—'}</div>
        </div>
      </div>

      <PowerChart
        series={weeklyTrend.map((point) => point.total_power_usage_watts)}
        labels={weeklyTrend.map((point) => formatWeekDate(point.date))}
      />
    </div>
  )
}
