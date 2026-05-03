import AdvisorPanel from '@/components/dashboard/AdvisorPanel'
import TopConsumersPanel from '@/components/dashboard/TopConsumersPanel'
import { useDashboard, formatRM } from '@/context/DashboardContext'

export default function Advisor() {
  const {
    topConsumers,
    toasts,
    advisorRecommendations,
    weeklySavingsPotential,
    executedAdvisorRanks,
    expandedAdvisorRanks,
    executeAdvisorPlan,
    toggleAdvisorDetails,
  } = useDashboard()

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
        <section style={{ marginBottom: 32 }}>
          <div>
            <h1 className="hero-title">Smart Advisor</h1>
            <p className="hero-copy">AI-powered recommendations to optimize your energy usage and reduce costs.</p>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="main-column">
            <AdvisorPanel
              advisorRecommendations={advisorRecommendations}
              executedAdvisorRanks={executedAdvisorRanks}
              expandedAdvisorRanks={expandedAdvisorRanks}
              weeklySavingsPotential={weeklySavingsPotential}
              formatRM={formatRM}
              onExecutePlan={executeAdvisorPlan}
              onToggleDetails={toggleAdvisorDetails}
            />
          </div>

          <div className="side-column">
            <TopConsumersPanel topConsumers={topConsumers} formatWatts={(v) => `${v.toLocaleString('en-MY')} W`} formatRM={formatRM} />
          </div>
        </section>
      </main>
    </div>
  )
}
