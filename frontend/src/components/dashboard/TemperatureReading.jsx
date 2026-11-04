import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'

export function TemperatureReading({ value, warningThreshold, criticalThreshold }) {
  if (!Number.isFinite(value)) return '—'

  const status = value >= criticalThreshold
    ? 'critical'
    : value >= warningThreshold
      ? 'warning'
      : 'normal'
  const Icon = status === 'critical' ? CircleAlert : status === 'warning' ? TriangleAlert : CircleCheck
  const label = status === 'critical' ? 'Critical' : status === 'warning' ? 'Warning' : 'Normal'

  return (
    <span className={`temperature-reading ${status}`} title={`${label}: configured temperature thresholds`}>
      <Icon size={15} aria-hidden="true" />
      <span>{value}°C · {label}</span>
    </span>
  )
}
