interface TopConsumer {
  id: number
  name: string
  room: string
  category: string
  current_power_usage_watts: number
  estimated_cost_rm_per_hour: number
  share_percent: number
}

interface TopConsumersPanelProps {
  topConsumers: TopConsumer[]
  formatWatts: (value: number) => string
  formatRM: (value: number) => string
  maxConsumers?: number
}

export default function TopConsumersPanel({ topConsumers, formatWatts, formatRM, maxConsumers }: TopConsumersPanelProps) {
  const visibleConsumers = typeof maxConsumers === 'number'
    ? topConsumers.slice(0, maxConsumers)
    : topConsumers

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Top consumers</h2>
          <p className="panel-copy">Highest-load appliances and their share of total demand.</p>
        </div>
      </div>

      <div className="drawer">
        {visibleConsumers.map((consumer) => (
          <div className="consumer-card" key={consumer.id}>
            <div className="consumer-top">
              <div>
                <p className="consumer-name">{consumer.name}</p>
                <div className="device-meta">
                  {consumer.room} · {consumer.category}
                </div>
              </div>
              <span className="pill pill-red">{consumer.share_percent}%</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.min(100, consumer.share_percent)}%` }} />
            </div>
            <div className="device-meta" style={{ marginTop: 12 }}>
              {formatWatts(consumer.current_power_usage_watts)} · {formatRM(consumer.estimated_cost_rm_per_hour)} / hour
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
