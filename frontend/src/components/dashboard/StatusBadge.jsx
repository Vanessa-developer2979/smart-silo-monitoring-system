export function StatusBadge({ status }) {
  const labels = { normal: 'Normal', warning: 'Warning', critical: 'Critical', info: 'Info', online: 'Online', offline: 'Offline', simulated: 'Simulated' }
  return <span className={`status-badge ${status}`}>{labels[status] || status}</span>
}
