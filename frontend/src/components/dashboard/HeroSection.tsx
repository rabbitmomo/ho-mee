interface HeroSummary {
  total_power_usage_watts: number
  efficiency_score: number
}

interface HeroSectionProps {
  summary: HeroSummary | null
  totalCost: number
  formatWatts: (value: number) => string
  formatRM: (value: number) => string
  onAddAppliance: () => void
  onRefresh: () => void
}

export default function HeroSection({ summary, totalCost, formatWatts, formatRM, onAddAppliance, onRefresh }: HeroSectionProps) {
  return (
    <section className="hero">
      <div className="hero-card hero-card-command">
        <div className="hero-card-topline">
          <span className="eyebrow">Ho-Mee Energy Optimization</span>
          <div className="hero-live-chip">
            <span className="pulse-dot" />
            Live command center
          </div>
        </div>
        <h1 className="hero-title">AI-Driven Real-Time Energy Monitoring</h1>
        <p className="hero-copy">
          Tracks appliance-level energy usage and estimated costs (RM) to identify high-consumption sources.
        </p>

        <div className="hero-actions">
          <button className="button button-primary" onClick={onAddAppliance}>
            Add appliance
          </button>
          <button className="button button-secondary" onClick={onRefresh}>
            Refresh live usage
          </button>
        </div>

      </div>

      <div className="hero-aside">
        <div className="panel mini-stat mini-stat-usage">
          <div className="mini-label">Live total usage</div>
          <div className="mini-value">{summary ? formatWatts(summary.total_power_usage_watts) : '—'}</div>
          <div className="mini-note">Updated every few seconds</div>
        </div>
        <div className="panel mini-stat mini-stat-cost">
          <div className="mini-label">Estimated hourly cost</div>
          <div className="mini-value">{summary ? formatRM(totalCost) : '—'}</div>
          <div className="mini-note">Based on RM 0.57 per kWh</div>
        </div>
        <div className="panel mini-stat mini-stat-score">
          <div className="mini-label">Energy efficiency score</div>
          <div className="mini-value">{summary ? `${summary.efficiency_score}/100` : '—'}</div>
          <div className="mini-note">Higher is better</div>
        </div>
      </div>
    </section>
  )
}
