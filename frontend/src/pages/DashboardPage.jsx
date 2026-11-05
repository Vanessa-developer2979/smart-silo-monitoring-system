import { useEffect, useState } from 'react'
import { Activity, ArrowRight, CircleAlert, Droplets, Plus, Thermometer, Warehouse } from 'lucide-react'
import { StatusBadge } from '../components/dashboard/StatusBadge.jsx'
import { TemperatureReading } from '../components/dashboard/TemperatureReading.jsx'
import { DataSourceBadge } from '../components/dashboard/DataSourceBadge.jsx'
import { SimulatedDataNotice } from '../components/common/SimulatedDataNotice.jsx'
import { useDashboardData } from '../hooks/useDashboardData.js'
import { useAuth } from '../hooks/useAuth.js'

const numberAverage = (items) => items.length
  ? items.reduce((total, value) => total + value, 0) / items.length
  : null

const sourceLabel = (source) => ({
  simulation: 'Simulated',
  hardware: 'Sensor',
  manual: 'Manual',
}[source] || 'Unknown')

export function DashboardPage({ operatorMode = false }) {
  const { silos, alerts, actionError, acknowledge, resolve, dataSource } = useDashboardData()
  const { user } = useAuth()
  const isAdministrator = user?.role === 'administrator'
  const visibleSilos = silos
  const siloIds = new Set(visibleSilos.map((silo) => silo.id))
  const visibleAlerts = alerts.filter((alert) => siloIds.has(alert.silo_id))
  const activeAlerts = visibleAlerts.filter((alert) => !alert.resolved)
  const criticalCount = activeAlerts.filter((alert) => alert.severity === 'critical').length
  const warningCount = activeAlerts.filter((alert) => alert.severity === 'warning').length
  const activeThresholdCount = criticalCount + warningCount
  const activeAlertSummary = [
    criticalCount > 0 && `${criticalCount} Critical`,
    warningCount > 0 && `${warningCount} Warning`,
  ].filter(Boolean).join(' / ') || '0 Critical'
  const averageTemperature = numberAverage(visibleSilos.map((silo) => silo.temperature).filter(Number.isFinite))
  const averageHumidity = numberAverage(visibleSilos.map((silo) => silo.humidity).filter(Number.isFinite))
  const averageMoisture = numberAverage(visibleSilos.map((silo) => silo.grain_moisture_percent).filter(Number.isFinite))
  const [now, setNow] = useState(() => new Date())
  const [actionToast, setActionToast] = useState('')
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!actionToast) return undefined
    const timer = window.setTimeout(() => setActionToast(''), 3500)
    return () => window.clearTimeout(timer)
  }, [actionToast])
  const acknowledgeAlert = async (alertId) => {
    if (await acknowledge(alertId)) setActionToast('Alert acknowledged. Please inspect the silo.')
  }
  const resolveAlert = async (alertId) => {
    if (await resolve(alertId)) setActionToast('Alert resolved successfully.')
  }
  const currentDate = new Intl.DateTimeFormat('en-MW', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Africa/Blantyre',
  }).format(now)

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{currentDate.toUpperCase()} <span className="live-tag"><i /> {dataSource === 'hardware' ? 'HARDWARE MODE' : dataSource === 'manual' ? 'MANUAL MODE' : 'SIMULATION'}</span></div>
          <h1>{operatorMode ? 'Silo monitoring' : `Storage operations${user?.full_name ? ` · ${user.full_name.split(' ')[0]}` : ''}`}</h1>
          <p>{operatorMode ? 'Monitoring overview for your assigned silos.' : 'An overview of storage conditions and active alerts.'}</p>
        </div>
        <div className="welcome-actions">
          {user?.role === 'administrator' && <a className="button button-secondary" href="/reports">View reports</a>}
          {!operatorMode && <a className="button button-primary" href="/silos"><Plus size={17} /> Add silo</a>}
        </div>
      </div>
      <SimulatedDataNotice />
      {actionToast && <div className="toast-notice" role="status">{actionToast}</div>}
      {actionError && <div className="inline-notice" role="alert">{actionError}</div>}

      <section className="metric-grid">
        <MetricCard label="Avg. temperature" value={averageTemperature == null ? '—' : `${averageTemperature.toFixed(1)}°C`} note="Air temperature" icon={Thermometer} style="blue" dataSource={dataSource} />
        <MetricCard label="Avg. air humidity" value={averageHumidity == null ? '—' : `${Math.round(averageHumidity)}%`} note="Relative humidity" icon={Droplets} style="purple" dataSource={dataSource} />
        <MetricCard label="Avg. grain moisture" value={averageMoisture == null ? '—' : `${averageMoisture.toFixed(1)}%`} note="Grain moisture content" icon={Activity} style="green" dataSource={dataSource} />
        <MetricCard label="Active alerts" value={activeAlertSummary} note={`${activeThresholdCount} unresolved alerts`} icon={CircleAlert} style="orange" alertValue />
      </section>

      <section className="panel dashboard-alerts">
        <div className="panel-heading"><div><h2>Active alerts <span className="heading-count">{activeAlerts.length}</span></h2><p>Conditions that need attention across your silos</p></div><a className="text-link" href="/alerts">View all alerts <ArrowRight size={14} /></a></div>
        <div className="alert-list">{activeAlerts.slice(0, 4).map((alert) => (
              <div className="alert-item" key={alert.id}>
                <span className={`alert-symbol ${alert.severity}`}>{alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '↑' : 'i'}</span>
                <div className="alert-description">
                  <div><strong>{alert.silo_name || 'Storage alert'}</strong><StatusBadge status={alert.severity} /></div>
                  <p>{alert.message}</p><small>{new Date(alert.created_at).toLocaleString('en-MW', { timeZone: 'Africa/Blantyre' })}</small>
                  <div className="alert-actions">
                    {!isAdministrator && !alert.acknowledged && !alert.resolved && <span className="alert-view-status">Awaiting administrator action</span>}
                    {isAdministrator && !alert.acknowledged && !alert.resolved && <button className="mini-action" onClick={() => acknowledgeAlert(alert.id)}>Acknowledge</button>}
                    {isAdministrator && alert.acknowledged && !alert.resolved && <button className="mini-action resolve-action" onClick={() => resolveAlert(alert.id)}>Resolve</button>}
                    {alert.acknowledged && <span className="acknowledged-tag">Acknowledged</span>}
                    {alert.resolved && <span className="resolved-label">Resolved</span>}
                  </div>
                </div>
              </div>
            ))}</div>
        {!activeAlerts.length && <p className="activity-empty">No active alerts. All monitored conditions are within their configured limits.</p>}
      </section>

      <section className="panel silo-panel">
        <div className="panel-heading"><div><h2>Local silo health</h2><p>Latest readings, fill level, and connection state</p></div><a className="text-link" href="/silos">Local silo details <ArrowRight size={14} /></a></div>
        <div className="table-scroll"><table><thead><tr><th>SILO</th><th>GRAIN TYPE</th><th>TEMPERATURE</th><th>AIR HUMIDITY</th><th>GRAIN MOISTURE</th><th>CAPACITY</th><th>CONNECTION</th></tr></thead><tbody>
          {visibleSilos.map((silo) => {
            const moisture = silo.grain_moisture_percent
            const fill = silo.capacity_percent ?? 0
            return <tr key={silo.id}>
              <td><div className="silo-name"><span className="silo-icon"><Warehouse size={16} /></span><span><strong>{silo.name}</strong><small>{silo.location}</small></span></div></td>
              <td>{silo.grain_type}</td>
              <td><TemperatureReading value={silo.temperature} warningThreshold={silo.temperature_warning_c} criticalThreshold={silo.temperature_critical_c} /></td>
              <td>{Number.isFinite(silo.humidity) ? `${silo.humidity}%` : '—'}</td>
              <td><div className="moisture-cell"><span>{Number.isFinite(moisture) ? `${moisture}%` : '—'}</span>{Number.isFinite(moisture) && <span className={`source-badge ${silo.data_source || 'simulation'}`}>{sourceLabel(silo.data_source)}</span>}</div></td>
              <td><div className={`capacity-cell${fill > 90 ? ' capacity-high' : ''}`}><div className="capacity-track"><i style={{ width: `${fill}%` }} /></div><small>{fill}%</small></div></td>
              <td><StatusBadge status={silo.connection_status || 'offline'} /></td>
            </tr>
          })}
          {!visibleSilos.length && <tr><td colSpan="7" className="empty-table">No silo readings are available for this data mode.</td></tr>}
        </tbody></table></div>
      </section>
    </>
  )
}

function MetricCard({ label, value, note, icon: Icon, style, alertValue = false, dataSource }) {
  return <article className={`metric-card${alertValue ? ' alert-metric' : ''}`}>
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${style}`}><Icon size={18} /></span></div>
    <div className={`metric-value${alertValue ? ' alert-split' : ''}`}>{value}</div>
    {dataSource && <DataSourceBadge source={dataSource} />}
    <div className="metric-bottom"><span>{note}</span></div>
  </article>
}
