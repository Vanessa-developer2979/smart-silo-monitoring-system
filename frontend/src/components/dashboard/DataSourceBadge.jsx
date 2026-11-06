const sourceDetails = {
  manual: { label: 'Manual', className: 'manual' },
  hardware: { label: 'Hardware', className: 'hardware' },
}

export function DataSourceBadge({ source }) {
  const details = sourceDetails[source]
  if (!details) return null
  return <span className={`data-source-badge ${details.className}`}>{details.label}</span>
}
