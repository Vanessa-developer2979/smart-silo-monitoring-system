import { useState } from 'react'
import { Activity, ArrowRight, CircleAlert, Clock3, Droplets, Download, Plus, Thermometer, Warehouse } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { StatusBadge } from '../components/dashboard/StatusBadge.jsx'
import { TemperatureReading } from '../components/dashboard/TemperatureReading.jsx'
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
  const { silos, alerts, history, apiState, isLoading, actionError, acknowledge, resolve, dataSource } = useDashboardData()
  const { user } = useAuth()
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
  const simulatedChart = dataSource === 'simulation'
  const emptyReadingsMessage = isLoading
    ? 'Loading readings from the monitoring service…'
    : apiState === 'offline'
      ? 'Readings could not be loaded. Check the service connection and try again.'
      : dataSource === 'simulation'
        ? 'No simulated readings are available for the selected silos.'
        : dataSource === 'hardware'
          ? 'No sensor readings have been received. Connect and configure a supported device to view live data.'
          : 'No manual readings are available. Add a reading from the Monitoring page.'
  const [currentDate] = useState(() => new Intl.DateTimeFormat('en-MW', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Africa/Blantyre',
  }).format(new Date()))

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{currentDate.toUpperCase()} <span className="live-tag"><i /> {dataSource === 'hardware' ? 'HARDWARE MODE' : dataSource === 'manual' ? 'MANUAL MODE' : 'SIMULATION'}</span></div>
          <h1>{operatorMode ? 'Silo monitoring' : `Storage operations${user?.full_name ? ` · ${user.full_name.split(' ')[0]}` : ''}`}</h1>
          <p>{operatorMode ? 'Monitoring overview for your assigned silos.' : 'An overview of storage conditions and active alerts.'}</p>
        </div>
        <div className="welcome-actions">
          {!operatorMode && <button className="button button-secondary"><Download size={16} /> Export report</button>}
          {!operatorMode && <a className="button button-primary" href="/silos"><Plus size={17} /> Add silo</a>}
        </div>
      </div>
      <SimulatedDataNotice />
      {actionError && <div className="inline-notice" role="alert">{actionError}</div>}

      <section className="metric-grid">
        <MetricCard label="Active silos" value={visibleSilos.length.toString().padStart(2, '0')} note="Across assigned locations" icon={Warehouse} style="green" />
        <MetricCard label="Avg. temperature" value={averageTemperature == null ? '—' : `${averageTemperature.toFixed(1)}°C`} note="Air temperature" icon={Thermometer} style="blue" />
        <MetricCard label="Avg. air humidity" value={averageHumidity == null ? '—' : `${Math.round(averageHumidity)}%`} note="Relative humidity" icon={Droplets} style="purple" />
        <MetricCard label="Avg. grain moisture" value={averageMoisture == null ? '—' : `${averageMoisture.toFixed(1)}%`} note="Grain moisture content" icon={Activity} style="green" />
        <MetricCard label="Active alerts" value={activeAlertSummary} note={`${activeThresholdCount} unresolved alerts`} icon={CircleAlert} style="orange" alertValue />
      </section>

      <div className="dashboard-grid">
        <section className="panel trend-panel">
          <div className="panel-heading"><div><h2>Storage conditions</h2><p>Air temperature and relative humidity · selected data source</p></div><select aria-label="Chart time range"><option>Latest readings</option></select></div>
          <div className="chart-legend"><span><i className="legend-temp" /> Air temperature (°C)</span><span><i className="legend-hum" /> Relative humidity (%)</span></div>
          <div className="chart-wrap chart-watermark-wrap">
            {simulatedChart && <span className="chart-watermark">SIMULATED DATA</span>}
            {!history.length && <span className="chart-empty" role="status">{emptyReadingsMessage}</span>}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#edf1ed" vertical={false} />
                <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: '#8a948d', fontSize: 10 }} minTickGap={30} />
                <YAxis yAxisId="temperature" orientation="left" domain={['auto', 'auto']} tickLine={false} axisLine={false} tick={{ fill: '#438055', fontSize: 10 }} label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#438055', fontSize: 10 }} />
                <YAxis yAxisId="humidity" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#5989b0', fontSize: 10 }} label={{ value: '%', angle: 90, position: 'insideRight', fill: '#5989b0', fontSize: 10 }} />
                <Tooltip />
                <Line yAxisId="temperature" type="monotone" dataKey="temperature" name="Temperature °C" stroke="#28814d" strokeWidth={2.2} strokeDasharray={simulatedChart ? '5 4' : undefined} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="humidity" type="monotone" dataKey="humidity" name="Humidity %" stroke="#76a4ce" strokeWidth={2} strokeDasharray={simulatedChart ? '5 4' : undefined} dot={false} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footer"><span><Clock3 size={14} /> {apiState === 'connected' ? 'Latest available readings' : 'Waiting for monitoring service'}</span><span>{simulatedChart ? 'Dashed lines represent generated sample values' : 'Values are filtered by the selected data source'}</span></div>
        </section>

        <section className="panel alert-panel">
          <div className="panel-heading"><div><h2>Recent alerts <span className="heading-count">{activeAlerts.length}</span></h2><p>Active problems · resolved alerts are hidden</p></div><a className="text-link" href="/alerts">View all <ArrowRight size={14} /></a></div>
          <div className="alert-list">{activeAlerts.slice(0, 4).map((alert) => (
            <div className="alert-item" key={alert.id}>
              <span className={`alert-symbol ${alert.severity}`}>{alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '↑' : 'i'}</span>
              <div className="alert-description">
                <div><strong>{alert.silo_name || 'Storage alert'}</strong><StatusBadge status={alert.severity} /></div>
                <p>{alert.message}</p><small>{new Date(alert.created_at).toLocaleString('en-MW', { timeZone: 'Africa/Blantyre' })}</small>
                <div className="alert-actions">
                  {!alert.acknowledged && <button className="mini-action" onClick={() => acknowledge(alert.id)}>Acknowledge</button>}
                  {!alert.resolved && <button className="mini-action resolve-action" onClick={() => resolve(alert.id)}>Resolve</button>}
                  {alert.resolved && <span className="resolved-label">Resolved</span>}
                </div>
              </div>
            </div>
          ))}</div>
        </section>
      </div>

      <section className="panel silo-panel">
        <div className="panel-heading"><div><h2>{operatorMode ? 'Assigned silo health' : 'Silo health'}</h2><p>Latest readings, fill level, and connection state</p></div><a className="text-link" href="/silos">All silos <ArrowRight size={14} /></a></div>
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

function MetricCard({ label, value, note, icon: Icon, style, alertValue = false }) {
  return <article className={`metric-card${alertValue ? ' alert-metric' : ''}`}>
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${style}`}><Icon size={18} /></span></div>
    <div className={`metric-value${alertValue ? ' alert-split' : ''}`}>{value}</div>
    <div className="metric-bottom"><span>{note}</span></div>
  </article>
}
