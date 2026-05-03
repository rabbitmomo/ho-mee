export default function LoadingSkeleton() {
  return (
    <div className="panel" style={{ position: 'relative', minHeight: 220 }}>
      <div className="loading-overlay">
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: '#475569', fontWeight: 600 }}>Syncing live energy data</p>
        </div>
      </div>
      <div className="shimmer" style={{ height: 24, width: '42%', borderRadius: 12, background: '#eef2ff' }} />
      <div style={{ height: 12 }} />
      <div className="shimmer" style={{ height: 82, borderRadius: 18, background: '#f8fafc' }} />
      <div style={{ height: 12 }} />
      <div className="shimmer" style={{ height: 82, borderRadius: 18, background: '#f8fafc' }} />
    </div>
  )
}
