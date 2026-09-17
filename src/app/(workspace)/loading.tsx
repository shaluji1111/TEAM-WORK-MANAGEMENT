export default function Loading() {
  return <div className="workspace-loading" role="status" aria-label="Loading page">
    <p className="loading-label">Loading your workspace…</p>
    <div className="loading-skeleton loading-heading" aria-hidden="true" />
    <div className="overview-cards" aria-hidden="true">
      {[0, 1, 2, 3].map(item => <div key={item} className="surface loading-card"><div className="loading-skeleton" /><div className="loading-skeleton loading-value" /></div>)}
    </div>
    <div className="surface loading-list" aria-hidden="true">
      {[0, 1, 2, 3].map(item => <div key={item} className="loading-skeleton" />)}
    </div>
  </div>;
}
