import type { CliItem } from './fusion-types';

export function CLIDetail({ cli }: { cli: CliItem }) {
  return (
    <div className="rv-fusion-detail-header">
      <div className="rv-fusion-detail-title">
        <span className="material-symbols-outlined">terminal</span>
        {cli.name}
      </div>

      <div className="rv-fusion-detail-subtitle">
        {cli.description}
      </div>

      <div className="rv-fusion-detail-meta">
        <div className="rv-fusion-detail-meta-item">
          <span className="rv-fusion-detail-meta-label">Author</span>
          <span className="rv-fusion-detail-meta-value">{cli.author}</span>
        </div>
        {cli.version && (
          <div className="rv-fusion-detail-meta-item">
            <span className="rv-fusion-detail-meta-label">Version</span>
            <span className="rv-fusion-detail-meta-value">{cli.version}</span>
          </div>
        )}
        <div className="rv-fusion-detail-meta-item">
          <span className="rv-fusion-detail-meta-label">Status</span>
          <span className={`rv-fusion-detail-meta-value ${cli.active ? 'highlight' : ''}`}>
            {cli.active ? 'Active' : 'Installed'}
          </span>
        </div>
      </div>

      {cli.pricing_url && (
        <div className="rv-fusion-detail-meta-item" style={{ marginTop: '12px' }}>
          <span className="rv-fusion-detail-meta-label">Pricing</span>
          <a href={cli.pricing_url} target="_blank" rel="noopener noreferrer" className="rv-fusion-detail-meta-value highlight">
            View plans →
          </a>
        </div>
      )}

      {cli.docs_url && (
        <div className="rv-fusion-detail-meta-item" style={{ marginTop: '4px' }}>
          <span className="rv-fusion-detail-meta-label">Docs</span>
          <a href={cli.docs_url} target="_blank" rel="noopener noreferrer" className="rv-fusion-detail-meta-value highlight">
            Documentation →
          </a>
        </div>
      )}
    </div>
  );
}

export function CLIRegistry({ items }: { items: CliItem[] }) {
  return (
    <div className="rv-fusion-registry">
      <div className="rv-fusion-detail-header">
        <div className="rv-fusion-detail-title">
          <span className="material-symbols-outlined">add_circle</span>
          Add a CLI
        </div>
        <div className="rv-fusion-detail-subtitle">
          Choose an AI assistant to connect to Fusion Studio. You'll need the CLI installed on your
          machine first — each one has its own setup instructions.
        </div>
      </div>

      <div className="rv-fusion-registry-list">
        {items.map(cli => (
          <div key={cli.id} className="rv-fusion-registry-item">
            <div className="rv-fusion-registry-item-info">
              <div className="rv-fusion-registry-item-top">
                <span className="rv-fusion-registry-item-name">{cli.name}</span>
                {cli.version && <span className="rv-fusion-registry-item-version">v{cli.version}</span>}
              </div>
              <div className="rv-fusion-registry-item-by">by {cli.author}</div>
              <div className="rv-fusion-registry-item-desc">{cli.description}</div>
            </div>
            <button className="rv-fusion-registry-add-btn">
              <span className="material-symbols-outlined">download</span>
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
