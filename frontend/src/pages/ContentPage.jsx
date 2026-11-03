import { useEffect, useState } from 'react'
import { Activity, ArrowDownToLine, Check, ChevronLeft, ChevronRight, Plus, Search, Settings, Shield, UserPlus, Warehouse } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SimulatedDataNotice } from '../components/common/SimulatedDataNotice.jsx'
import { StatusBadge } from '../components/dashboard/StatusBadge.jsx'
import { alertService, inspectionService, readingService, reportService, siloService, userService } from '../services/api.js'
import { useDataMode } from '../hooks/useDataMode.js'
import { useAuth } from '../hooks/useAuth.js'
import { demoAlerts, demoSilos } from '../utils/demoData.js'
import './reports.css'

const pageCopy = {
  silos: ['Silo management', 'Manage your storage locations, grain types, and capacity.', 'Silos'],
  monitoring: ['Live monitoring', 'Track temperature and humidity across your storage network.', 'Monitoring'],
  alerts: ['Alerts & events', 'Review conditions that may need your attention.', 'Alerts'],
  reports: ['Monitoring reports', 'Review and export trends from your silo network.', 'Reports'],
  users: ['User management', 'Manage workspace access and silo operator assignments.', 'Users'],
  settings: ['Workspace settings', 'Configure thresholds and workspace preferences.', 'Settings'],
}
const sourceNames = { simulation: 'Simulated', hardware: 'Hardware', manual: 'Manual' }

export function ContentPage({ page }) {
  const { dataSource } = useDataMode()
  const { user } = useAuth()
  const isAdministrator = user?.role === 'administrator'
  const [silos, setSilos] = useState(demoSilos)
  const [alerts, setAlerts] = useState(demoAlerts)
  const [users, setUsers] = useState([])
  const [inspections, setInspections] = useState([])
  const [history, setHistory] = useState([])
  const [report, setReport] = useState(null)
  const [reportSilos, setReportSilos] = useState([])
  const [reportPeriod, setReportPeriod] = useState('7d')
  const [reportSiloId, setReportSiloId] = useState('')
  const [reportPage, setReportPage] = useState(1)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', location: '', grain_type: 'Wheat', capacity_tonnes: 1000 })
  const [userForm, setUserForm] = useState({ full_name: '', email: '', role: 'operator', password: '' })
  const [inspectionForm, setInspectionForm] = useState({ silo_id: '', activity_type: 'inspection', notes: '' })
  const [readingForm, setReadingForm] = useState({ silo_id: '', temperature_c: '', humidity_percent: '', grain_moisture_percent: '' })
  const [apiReady, setApiReady] = useState(false)
  const [loadedDataSource, setLoadedDataSource] = useState(null)

  useEffect(() => {
    let active = true
    const request = {
      silos: () => siloService.list(dataSource).then(setSilos),
      alerts: () => alertService.list().then(setAlerts),
      users: () => userService.list().then(setUsers),
      reports: () => {
        setReport(null)
        setReportError('')
        setReportLoading(true)
        return Promise.all([
          siloService.list(dataSource).then((items) => {
            if (active) setReportSilos(items)
          }),
          reportService.history({
            period: reportPeriod,
            data_source: dataSource,
            ...(reportSiloId ? { silo_id: Number(reportSiloId) } : {}),
          }).then((data) => {
            if (active) setReport(data)
          }),
        ]).finally(() => {
          if (active) setReportLoading(false)
        })
      },
      monitoring: () => Promise.all([
        siloService.list(dataSource).then(setSilos),
        inspectionService.list().then(setInspections),
        readingService.list(dataSource).then((items) => setHistory(items.map((reading) => ({
          time: new Date(reading.recorded_at).toLocaleTimeString('en-MW', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' }),
          temperature: reading.temperature_c,
          humidity: reading.humidity_percent,
        })).reverse())),
      ]),
    }[page]
    if (!request) return undefined
    request().then(() => {
      if (active) {
        setApiReady(true)
        setLoadedDataSource(dataSource)
      }
    }).catch((error) => {
      if (active) {
        const detail = error.response?.data?.detail || 'The local API could not load this page. Check the connection and try again.'
        setApiReady(false)
        if (page === 'reports') setReportError(detail)
        else setMessage(detail)
      }
    })
    return () => { active = false }
  }, [page, dataSource, reportPeriod, reportSiloId])

  const submitSilo = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const created = await siloService.create({ ...form, capacity_tonnes: Number(form.capacity_tonnes) })
      setSilos((items) => [created, ...items])
      setShowForm(false)
      setForm({ name: '', location: '', grain_type: 'Wheat', capacity_tonnes: 1000 })
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not save silo. Check the API connection and form values.')
    } finally { setBusy(false) }
  }

  const acknowledge = async (alertId) => {
    try {
      await alertService.acknowledge(alertId)
      setAlerts((items) => items.map((item) => item.id === alertId ? { ...item, acknowledged: true } : item))
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not acknowledge alert. Check the API connection.')
    }
  }

  const submitUser = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const created = await userService.create(userForm)
      setUsers((items) => [...items, created])
      setShowUserForm(false)
      setUserForm({ full_name: '', email: '', role: 'operator', password: '' })
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not create user record. Check the API connection and form values.')
    } finally { setBusy(false) }
  }

  const setUserActive = async (user) => {
    try {
      const updated = await userService.setActive(user.id, !user.is_active)
      setUsers((items) => items.map((item) => item.id === updated.id ? updated : item))
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not update user status.')
    }
  }

  const submitInspection = async (event) => {
    event.preventDefault()
    try {
      const saved = await inspectionService.create({ ...inspectionForm, silo_id: Number(inspectionForm.silo_id) })
      setInspections((items) => [saved, ...items])
      setInspectionForm({ silo_id: '', activity_type: 'inspection', notes: '' })
      setMessage('Inspection record saved.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not save the inspection record.')
    }
  }

  const submitReading = async (event) => {
    event.preventDefault()
    try {
      const saved = await readingService.create({
        ...readingForm,
        silo_id: Number(readingForm.silo_id),
        temperature_c: Number(readingForm.temperature_c),
        humidity_percent: Number(readingForm.humidity_percent),
        grain_moisture_percent: Number(readingForm.grain_moisture_percent),
        data_source: 'manual',
      })
      setMessage(`Manual reading saved for silo ${saved.silo_id}.`)
      const updatedSilos = await siloService.list('manual')
      setSilos(updatedSilos)
      setHistory(await readingService.list('manual').then((items) => items.map((reading) => ({
        time: new Date(reading.recorded_at).toLocaleTimeString('en-MW', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' }),
        temperature: reading.temperature_c,
        humidity: reading.humidity_percent,
      })).reverse()))
      setReadingForm({ silo_id: '', temperature_c: '', humidity_percent: '', grain_moisture_percent: '' })
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not save manual reading.')
    }
  }

  const [title, description, tab] = pageCopy[page]
  const pageSilos = loadedDataSource === dataSource
    ? silos
    : loadedDataSource === null && dataSource === 'simulation'
      ? demoSilos
      : []
  const filteredSilos = pageSilos.filter((silo) => `${silo.name} ${silo.location} ${silo.grain_type}`.toLowerCase().includes(search.toLowerCase()))
  const averageOf = (field, digits = 1) => {
    const values = pageSilos.map((silo) => silo.latest_reading?.[field]).filter(Number.isFinite)
    return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(digits)}${field === 'temperature_c' ? '°C' : '%'}` : '—'
  }
  const reportReadings = report?.readings || []
  const reportPageSize = 10
  const reportPageCount = Math.max(1, Math.ceil(reportReadings.length / reportPageSize))
  const visibleReportReadings = reportReadings.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize)
  const reportChartData = Object.values(reportReadings.reduce((groups, reading) => {
    const recordedAt = new Date(reading.recorded_at)
    const hour = new Date(recordedAt)
    hour.setMinutes(0, 0, 0)
    const key = hour.toISOString()
    const group = groups[key] || { timestamp: hour, count: 0, temperature: 0, humidity: 0, moistureTotal: 0, moistureCount: 0 }
    group.count += 1
    group.temperature += reading.temperature_c
    group.humidity += reading.humidity_percent
    if (reading.grain_moisture_percent != null) {
      group.moistureTotal += reading.grain_moisture_percent
      group.moistureCount += 1
    }
    groups[key] = group
    return groups
  }, {})).sort((a, b) => a.timestamp - b.timestamp).map((group) => ({
    time: group.timestamp.toLocaleString('en-MW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' }),
    temperature: Number((group.temperature / group.count).toFixed(2)),
    humidity: Number((group.humidity / group.count).toFixed(2)),
    moisture: group.moistureCount ? Number((group.moistureTotal / group.moistureCount).toFixed(2)) : null,
  }))

  const exportReportCsv = () => {
    const headers = ['Date', 'Time', 'Silo', 'Temperature (°C)', 'Air Humidity (%)', 'Grain Moisture (%)', 'Data Source', 'Status']
    const safeCell = (value) => {
      const text = String(value ?? '')
      const safe = typeof value !== 'number' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
      return `"${safe.replaceAll('"', '""')}"`
    }
    const lines = [
      headers,
      ...reportReadings.map((reading) => {
        const recordedAt = new Date(reading.recorded_at)
        return [
          recordedAt.toLocaleDateString('en-MW', { timeZone: 'Africa/Blantyre' }),
          recordedAt.toLocaleTimeString('en-MW', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' }),
          reading.silo_name,
          reading.temperature_c,
          reading.humidity_percent,
          reading.grain_moisture_percent ?? '',
          sourceNames[reading.data_source] || reading.data_source,
          reading.status,
        ]
      }),
    ]
    const blob = new Blob([lines.map((row) => row.map(safeCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `smart-silo-report-${reportPeriod}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <div className="content-title-row">
        <div><div className="eyebrow">{tab.toUpperCase()}</div><h1>{title}</h1><p>{description}</p></div>
        <div className={`content-actions${page === 'reports' ? ' report-controls' : ''}`}>
          {page === 'silos' && isAdministrator && <button className="button button-primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> Register silo</button>}
          {page === 'users' && <button className="button button-primary" onClick={() => setShowUserForm((value) => !value)}><UserPlus size={16} /> Add user record</button>}
          {page === 'reports' && <>
            <label className="report-control">Silo
              <select aria-label="Filter reports by silo" value={reportSiloId} onChange={(event) => { setReportPage(1); setReportSiloId(event.target.value) }}>
                <option value="">All Silos</option>
                {reportSilos.map((silo) => <option key={silo.id} value={silo.id}>{silo.name}</option>)}
              </select>
            </label>
            <label className="report-control">Date range
              <select aria-label="Report date range" value={reportPeriod} onChange={(event) => { setReportPage(1); setReportPeriod(event.target.value) }}>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </label>
            <button className="button button-primary" onClick={exportReportCsv} disabled={!reportReadings.length}><ArrowDownToLine size={16} /> Export CSV</button>
          </>}
        </div>
      </div>
      <SimulatedDataNotice>{dataSource === 'simulation' ? 'Generated readings are for demonstration only; no physical sensor is connected.' : dataSource === 'hardware' ? 'Hardware mode is selected, but no ESP32/DHT22 integration or device is connected.' : 'Manually entered values are labeled Manual; no physical sensor is connected.'}</SimulatedDataNotice>
      {message && <div className="inline-notice" role="status">{message}</div>}

      {page === 'silos' && (
        <section className="panel silo-panel content-panel">
          <div className="panel-heading"><div><h2>Registered silos</h2><p>{pageSilos.length} storage locations{apiReady && loadedDataSource === dataSource ? ' · synced with local API' : ''}</p></div><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search silos" /></label></div>
          {showForm && isAdministrator && <form className="silo-form" onSubmit={submitSilo}>
            <label>Silo name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Lilongwe Silo 03" /></label>
            <label>Location<input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="District or region" /></label>
            <label>Grain type<select value={form.grain_type} onChange={(event) => setForm({ ...form, grain_type: event.target.value })}><option>Wheat</option><option>Barley</option><option>Maize</option><option>Oats</option><option>Soybean</option></select></label>
            <label>Capacity (tonnes)<input type="number" min="1" required value={form.capacity_tonnes} onChange={(event) => setForm({ ...form, capacity_tonnes: event.target.value })} /></label>
            <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save silo'}</button>
          </form>}
          <SiloTable silos={filteredSilos} />
        </section>
      )}

      {page === 'monitoring' && <>
        <div className="metric-grid compact-metrics">{[['Temperature', averageOf('temperature_c'), 'Air temperature'], ['Air humidity', averageOf('humidity_percent'), 'Relative humidity'], ['Grain moisture', averageOf('grain_moisture_percent'), 'Moisture content']].map(([label, value, note]) => <article className="metric-card" key={label}><div className="metric-top">{label}<span className="metric-icon green"><Activity size={18} /></span></div><div className="metric-value">{value}</div><div className="metric-bottom">{note}</div></article>)}</div>
        <section className="panel trend-panel content-panel"><div className="panel-heading"><div><h2>Temperature & humidity history</h2><p>{dataSource === 'simulation' ? 'Simulated sample readings' : `${dataSource} data-source readings`}</p></div><span className="chart-axis-caption">Left: °C · Right: %</span></div><div className="large-chart chart-watermark-wrap">{dataSource === 'simulation' && <span className="chart-watermark">SIMULATED DATA</span>}{!history.length && <span className="chart-empty">{dataSource === 'hardware' ? 'No hardware readings received.' : 'No readings available for this data source.'}</span>}<ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid stroke="#edf1ed" vertical={false} /><XAxis dataKey="time" tickLine={false} axisLine={false} /><YAxis yAxisId="temperature" orientation="left" domain={['auto', 'auto']} tickLine={false} axisLine={false} /><YAxis yAxisId="humidity" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} /><Tooltip /><Line yAxisId="temperature" type="monotone" dataKey="temperature" name="Temperature °C" stroke="#28814d" strokeDasharray={dataSource === 'simulation' ? '5 4' : undefined} dot={false} isAnimationActive={false} /><Line yAxisId="humidity" type="monotone" dataKey="humidity" name="Humidity %" stroke="#76a4ce" strokeDasharray={dataSource === 'simulation' ? '5 4' : undefined} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></section>
        {dataSource === 'manual' && <section className="panel content-panel"><div className="panel-heading"><div><h2>Enter a manual reading</h2><p>Saved values are labeled Manual and are never presented as sensor measurements.</p></div></div><form className="silo-form reading-form" onSubmit={submitReading}><label>Silo<select required value={readingForm.silo_id} onChange={(event) => setReadingForm({ ...readingForm, silo_id: event.target.value })}><option value="">Select silo</option>{pageSilos.map((silo) => <option key={silo.id} value={silo.id}>{silo.name}</option>)}</select></label><label>Air temperature (°C)<input type="number" step="0.1" required value={readingForm.temperature_c} onChange={(event) => setReadingForm({ ...readingForm, temperature_c: event.target.value })} /></label><label>Air humidity (%)<input type="number" step="0.1" min="0" max="100" required value={readingForm.humidity_percent} onChange={(event) => setReadingForm({ ...readingForm, humidity_percent: event.target.value })} /></label><label>Grain moisture (%)<input type="number" step="0.1" min="0" max="100" required value={readingForm.grain_moisture_percent} onChange={(event) => setReadingForm({ ...readingForm, grain_moisture_percent: event.target.value })} /></label><button className="button button-primary">Save manual reading</button></form></section>}
        <section className="panel content-panel"><div className="panel-heading"><div><h2>Inspection & maintenance log</h2><p>Record operator work and keep a history by silo.</p></div></div><form className="silo-form" onSubmit={submitInspection}><label>Silo<select required value={inspectionForm.silo_id} onChange={(event) => setInspectionForm({ ...inspectionForm, silo_id: event.target.value })}><option value="">Select silo</option>{pageSilos.map((silo) => <option key={silo.id} value={silo.id}>{silo.name}</option>)}</select></label><label>Activity<select value={inspectionForm.activity_type} onChange={(event) => setInspectionForm({ ...inspectionForm, activity_type: event.target.value })}><option value="inspection">Inspection</option><option value="maintenance">Maintenance</option><option value="cleaning">Cleaning</option><option value="other">Other</option></select></label><label>Notes<input required value={inspectionForm.notes} onChange={(event) => setInspectionForm({ ...inspectionForm, notes: event.target.value })} placeholder="Work performed or observations" /></label><button className="button button-primary">Save record</button></form>{inspections.length > 0 && <div className="inspection-list">{inspections.map((item) => <p key={item.id}><strong>{pageSilos.find((silo) => silo.id === item.silo_id)?.name || `Silo ${item.silo_id}`}</strong> · {item.activity_type} — {item.notes}</p>)}</div>}</section>
        <SiloTable silos={pageSilos} />
      </>}

      {page === 'alerts' && <section className="panel content-panel"><div className="panel-heading"><div><h2>All alerts</h2><p>{alerts.length} alerts from the sample dataset</p></div></div><div className="full-alert-list">{alerts.map((alert) => <article className="full-alert" key={alert.id}><span className={`alert-symbol ${alert.severity}`}>{alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '↑' : 'i'}</span><div><div className="alert-title"><strong>{alert.silo_name || `Silo ${alert.silo_id}`}</strong><StatusBadge status={alert.severity} />{alert.acknowledged && <span className="acknowledged-tag">Acknowledged</span>}{alert.resolved && <span className="resolved-label">Resolved</span>}</div><p>{alert.message}</p><small>{alert.created_at}</small></div><div className="full-alert-actions">{!alert.acknowledged && <button className="button button-secondary" onClick={() => acknowledge(alert.id)}><Check size={14} /> Acknowledge</button>}{!alert.resolved && <button className="button button-secondary" onClick={() => alertService.resolve(alert.id).then((updated) => setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, ...updated } : item))).catch((error) => setMessage(error.response?.data?.detail || 'Could not resolve alert.'))}>Resolve</button>}</div></article>)}</div></section>}

      {page === 'reports' && <>
        <div className="metric-grid compact-metrics report-metrics">
          {[
            ['Silos', report?.silo_count ?? 0],
            ['Avg. temperature', report?.average_temperature_c != null ? `${report.average_temperature_c}°C` : '—'],
            ['Avg. humidity', report?.average_humidity_percent != null ? `${report.average_humidity_percent}%` : '—'],
            ['Avg. grain moisture', report?.average_grain_moisture_percent != null ? `${report.average_grain_moisture_percent}%` : '—'],
          ].map(([label, value]) => <article className="metric-card" key={label}><div className="metric-top">{label}</div><div className="metric-value">{value}</div><div className="metric-bottom">{report?.reading_count ?? 0} readings in selected range</div></article>)}
        </div>
        {reportLoading ? (
          <section className="panel content-panel report-empty-state" role="status">Loading report data…</section>
        ) : reportError ? (
          <section className="panel content-panel report-empty-state" role="alert">
            <h2>Unable to Load Report</h2>
            <p>{reportError}</p>
          </section>
        ) : reportReadings.length === 0 ? (
          <section className="panel content-panel report-empty-state">
            <Warehouse size={28} />
            <h2>No Data Available</h2>
            <p>No readings match the selected silo, source, and date range.</p>
            {dataSource === 'simulation' && <span>Simulation readings are generated demonstration data, not physical sensor measurements.</span>}
          </section>
        ) : (
          <>
            <section className="panel content-panel report-chart-panel">
              <div className="panel-heading">
                <div><h2>Historical Storage Conditions</h2><p>{report.reading_count} readings · hourly averages{reportSiloId ? ` · ${reportSilos.find((silo) => String(silo.id) === reportSiloId)?.name || 'selected silo'}` : ' across accessible silos'}</p></div>
                <span className="status-badge info">{dataSource === 'simulation' ? 'Simulation Mode Active' : `${dataSource} mode selected`}</span>
              </div>
              <div className="report-legend">
                <span><i className="report-legend-temp" /> Temperature (°C)</span>
                <span><i className="report-legend-humidity" /> Air humidity (%)</span>
                <span><i className="report-legend-moisture" /> Grain moisture (%)</span>
              </div>
              <div className="large-chart report-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportChartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="#edf1ed" vertical={false} />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis yAxisId="temperature" orientation="left" domain={['auto', 'auto']} tickLine={false} axisLine={false} label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} label={{ value: '%', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Line yAxisId="temperature" type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#28814d" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="percent" type="monotone" dataKey="humidity" name="Air humidity (%)" stroke="#76a4ce" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="percent" type="monotone" dataKey="moisture" name="Grain moisture (%)" stroke="#c58b3b" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel content-panel report-table-panel">
              <div className="panel-heading"><div><h2>Historical reading log</h2><p>Raw readings from the selected period and data source</p></div><span className="status-badge info">{report.reading_count} records</span></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>DATE</th><th>TIME</th><th>SILO</th><th>TEMPERATURE</th><th>AIR HUMIDITY</th><th>GRAIN MOISTURE</th><th>DATA SOURCE</th><th>STATUS</th></tr></thead>
                  <tbody>{visibleReportReadings.map((reading) => {
                    const recordedAt = new Date(reading.recorded_at)
                    return <tr key={reading.id}>
                      <td>{recordedAt.toLocaleDateString('en-MW', { timeZone: 'Africa/Blantyre' })}</td>
                      <td>{recordedAt.toLocaleTimeString('en-MW', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' })}</td>
                      <td>{reading.silo_name}</td>
                      <td>{reading.temperature_c}°C</td>
                      <td>{reading.humidity_percent}%</td>
                      <td>{reading.grain_moisture_percent == null ? '—' : `${reading.grain_moisture_percent}%`}</td>
                      <td><span className={`source-badge ${reading.data_source}`}>{sourceNames[reading.data_source] || reading.data_source}</span></td>
                      <td><StatusBadge status={reading.status} /></td>
                    </tr>
                  })}</tbody>
                </table>
              </div>
              <div className="report-pagination">
                <span>Showing {((reportPage - 1) * reportPageSize) + 1}–{Math.min(reportPage * reportPageSize, reportReadings.length)} of {reportReadings.length}</span>
                <div>
                  <button className="button button-secondary" aria-label="Previous report page" disabled={reportPage <= 1} onClick={() => setReportPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /> Previous</button>
                  <span>Page {reportPage} of {reportPageCount}</span>
                  <button className="button button-secondary" aria-label="Next report page" disabled={reportPage >= reportPageCount} onClick={() => setReportPage((current) => Math.min(reportPageCount, current + 1))}>Next <ChevronRight size={15} /></button>
                </div>
              </div>
            </section>
          </>
        )}
      </>}

      {page === 'users' && <section className="panel content-panel"><div className="panel-heading"><div><h2>Workspace users</h2><p>Manage account access and role assignments.</p></div><span className="status-badge normal">ROLE PROTECTED</span></div>{showUserForm && <form className="silo-form user-form" onSubmit={submitUser}><label>Full name<input required maxLength="150" value={userForm.full_name} onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })} /></label><label>Email<input type="email" required value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label><label>Role<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option value="operator">Silo operator</option><option value="administrator">Administrator</option></select></label><label>Temporary password<input type="password" autoComplete="new-password" minLength="8" maxLength="128" required value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Create account'}</button></form>}<div className="user-list">{users.map((user) => <div className="user-row" key={user.id}><span className="profile-avatar">{user.full_name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{user.full_name}</strong><small>{user.email} · {user.is_active === false ? 'Inactive' : 'Active'}</small></div><span className="role-tag"><Shield size={14} />{user.role}</span>{Number.isInteger(user.id) && <button className="button button-secondary" onClick={() => setUserActive(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</button>}</div>)}</div></section>}

      {page === 'settings' && <section className="panel content-panel settings-list"><div className="panel-heading"><div><h2>Alert thresholds</h2><p>Default silo threshold configuration</p></div><Settings size={19} /></div><div className="setting-row"><div><strong>Temperature warning</strong><small>Alert when silo temperature rises above this value</small></div><span>24 °C</span></div><div className="setting-row"><div><strong>Temperature critical</strong><small>Critical alert threshold for grain storage</small></div><span>28 °C</span></div><div className="setting-row"><div><strong>Humidity warning</strong><small>Alert when relative humidity rises above this value</small></div><span>65 %</span></div><div className="setting-row"><div><strong>Humidity critical</strong><small>Critical alert threshold for relative humidity</small></div><span>72 %</span></div><p className="page-footnote">Thresholds can be configured per silo through the API. This settings preview is read-only.</p></section>}

      <p className={`page-footnote system-status${apiReady ? ' operational' : ''}`}><Activity size={14} /> <span className="system-status-dot" /> System status: {apiReady ? 'Operational' : reportError ? 'Unavailable' : 'Connecting'}</p>
    </>
  )
}

function SiloTable({ silos }) {
  return <div className="table-scroll"><table><thead><tr><th>SILO</th><th>GRAIN TYPE</th><th>TEMPERATURE</th><th>HUMIDITY</th><th>GRAIN MOISTURE</th><th>CAPACITY</th><th>CONNECTION</th></tr></thead><tbody>{silos.map((silo) => <tr key={silo.id}><td><div className="silo-name"><span className="silo-icon"><Warehouse size={16} /></span><span><strong>{silo.name}</strong><small>{silo.location}</small></span></div></td><td>{silo.grain_type}</td><td>{silo.latest_reading ? `${silo.latest_reading.temperature_c}°C` : '—'}</td><td>{silo.latest_reading ? `${silo.latest_reading.humidity_percent}%` : '—'}</td><td>{silo.latest_reading?.grain_moisture_percent != null ? <span className="moisture-cell">{silo.latest_reading.grain_moisture_percent}% <span className={`source-badge ${silo.latest_reading.data_source}`}>{sourceNames[silo.latest_reading.data_source]}</span></span> : '—'}</td><td><span className={(silo.capacity_percent || 0) > 90 ? 'capacity-high' : ''}>{silo.capacity_tonnes?.toLocaleString()} t · {silo.capacity_percent || 0}%</span></td><td><StatusBadge status={silo.connection_status || 'offline'} /></td></tr>)}</tbody></table>{silos.length === 0 && <div className="empty-state">No silos match that search.</div>}</div>
}
