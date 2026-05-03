interface SummaryCardsData {
  total_power_usage_watts: number
  total_estimated_cost_rm_per_hour: number
  total_estimated_monthly_cost_rm: number
  high_consumption_devices: number
}

interface SummaryCardsProps {
  summary: SummaryCardsData | null
  formatWatts: (value: number) => string
  formatRM: (value: number) => string
  variant?: 'default' | 'compact'
}

export default function SummaryCards({ summary, formatWatts, formatRM, variant = 'default' }: SummaryCardsProps) {
  return (
    <section className={`section overview-grid ${variant === 'compact' ? 'overview-grid-compact' : ''}`}>
      <div className="summary-card summary-card-power">
        <div className="summary-card-top">
          <div className="summary-label">Total usage</div>
          <span className="summary-chip">Live</span>
        </div>
        <div className="summary-value">{summary ? formatWatts(summary.total_power_usage_watts) : '—'}</div>
        <div className="summary-subtext">Appliance-level real-time consumption</div>
      </div>
      <div className="summary-card summary-card-cost">
        <div className="summary-card-top">
          <div className="summary-label">Hourly cost</div>
          {variant === 'compact' ? null : <span className="summary-chip">RM</span>}
        </div>
        <div className="summary-value">{summary ? formatRM(summary.total_estimated_cost_rm_per_hour) : '—'}</div>
        <div className="summary-subtext">Estimated cost in RM</div>
      </div>
      <div className="summary-card summary-card-monthly">
        <div className="summary-card-top">
          <div className="summary-label">Monthly estimate</div>
          <span className="summary-chip">Projected</span>
        </div>
        <div className="summary-value">{summary ? formatRM(summary.total_estimated_monthly_cost_rm) : '—'}</div>
        <div className="summary-subtext">Projected if usage stays consistent</div>
      </div>
      <div className="summary-card summary-card-alerts">
        <div className="summary-card-top">
          <div className="summary-label">High consumption devices</div>
          <span className="summary-chip">Watchlist</span>
        </div>
        <div className="summary-value">{summary ? summary.high_consumption_devices : '—'}</div>
        <div className="summary-subtext">Likely waste sources to prioritize</div>
      </div>
    </section>
  )
}
