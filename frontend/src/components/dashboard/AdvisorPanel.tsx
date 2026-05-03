interface AdvisorRecommendation {
  rank: number
  title: string
  deviceName: string
  savingsRmWeekly: number
  effort: 'Low' | 'Medium' | 'High'
  confidence: 'High' | 'Medium' | 'Low'
  reason: string
  adjustments: string[]
  accent: 'primary' | 'secondary' | 'muted'
}

interface AdvisorPanelProps {
  advisorRecommendations: AdvisorRecommendation[]
  executedAdvisorRanks: number[]
  expandedAdvisorRanks: number[]
  weeklySavingsPotential: number
  formatRM: (value: number) => string
  onExecutePlan: (recommendation: AdvisorRecommendation) => void
  onToggleDetails: (rank: number) => void
  maxRecommendations?: number
}

export default function AdvisorPanel({ advisorRecommendations, executedAdvisorRanks, expandedAdvisorRanks, weeklySavingsPotential, formatRM, onExecutePlan, onToggleDetails, maxRecommendations }: AdvisorPanelProps) {
  const visibleRecommendations = typeof maxRecommendations === 'number'
    ? advisorRecommendations.slice(0, maxRecommendations)
    : advisorRecommendations

  return (
    <div className="panel advisor-panel">
      <div className="advisor-header">
        <div>
          <div className="advisor-eyebrow">AI Energy Advisor</div>
          <h2 className="panel-title">Savings plan</h2>
          <p className="panel-copy">Three ranked actions with the highest impact on this week&apos;s bill.</p>
        </div>
        <div className="advisor-metrics">
          <div className="advisor-metric">
            <span className="advisor-metric-label">Weekly savings</span>
            <strong>{formatRM(weeklySavingsPotential)}</strong>
          </div>
          <div className="advisor-badges">
            <span className="pill pill-green">High confidence</span>
            <span className="pill pill-amber">Low effort mix</span>
          </div>
        </div>
      </div>

      <div className="advisor-summary">
        The plan prioritizes the largest appliance loads first, then groups smaller wins into one low-friction routine.
      </div>

      <div className="advisor-list">
        {visibleRecommendations.map((recommendation) => (
          <article
            className={`advisor-card advisor-card-${recommendation.accent} ${executedAdvisorRanks.includes(recommendation.rank) ? 'advisor-card-executed' : ''}`}
            key={`${recommendation.rank}-${recommendation.deviceName}`}
          >
            <div className="advisor-card-top">
              <div className="advisor-rank">{recommendation.rank}</div>
              <div className="advisor-card-body">
                <div className="advisor-card-title-row">
                  <h3>{recommendation.title}</h3>
                  <span className="advisor-device">{recommendation.deviceName}</span>
                </div>
                <div className="advisor-value">Save {formatRM(recommendation.savingsRmWeekly)} / week</div>
              </div>
            </div>

            <div className="advisor-badge-row">
              <span className="advisor-badge">Effort: {recommendation.effort}</span>
              <span className="advisor-badge">Confidence: {recommendation.confidence}</span>
            </div>

            <p className="advisor-reason">
              <strong>Why this works:</strong> {recommendation.reason}
            </p>

            <div className="advisor-actions">
              <button
                className={`button ${executedAdvisorRanks.includes(recommendation.rank) ? 'button-secondary' : 'button-primary'}`}
                onClick={() => onExecutePlan(recommendation)}
                type="button"
              >
                {executedAdvisorRanks.includes(recommendation.rank) ? 'Executed' : 'Execute this plan'}
              </button>

              <button className="button advisor-detail-button" onClick={() => onToggleDetails(recommendation.rank)} type="button">
                {expandedAdvisorRanks.includes(recommendation.rank) ? 'Hide details' : 'Detail'}
              </button>
            </div>

            {expandedAdvisorRanks.includes(recommendation.rank) ? (
              <div className="advisor-details">
                <div className="advisor-details-label">What to adjust</div>
                <ul>
                  {recommendation.adjustments.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="advisor-action-note-inline">
                  {executedAdvisorRanks.includes(recommendation.rank) ? 'Queued for tracking' : 'Ready to apply'}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}
