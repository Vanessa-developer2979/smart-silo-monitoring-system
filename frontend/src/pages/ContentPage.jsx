import { useEffect, useState } from 'react'
import { Activity, ArrowDownToLine, Check, ChevronLeft, ChevronRight, Plus, Settings, Shield, Trash2, UserPlus, Warehouse } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DataModeSelector } from '../components/common/DataModeSelector.jsx'
import { DataSourceBadge } from '../components/dashboard/DataSourceBadge.jsx'
import { StatusBadge } from '../components/dashboard/StatusBadge.jsx'
import { TemperatureReading } from '../components/dashboard/TemperatureReading.jsx'
import { alertService, inspectionService, notifyAlertsUpdated, readingService, reportService, siloService, userService } from '../services/api.js'
import { useDataMode } from '../hooks/useDataMode.js'
import { useAuth } from '../hooks/useAuth.js'
import './reports.css'

const pageCopy = {
  silos: ['Local silo management', 'Manage details and capacity for the Local Silo.', 'Silos'],
  monitoring: ['Live monitoring', 'Monitor the latest readings from your Local Silo.', 'Monitoring'],
  alerts: ['Alerts & events', 'Review conditions that may need your attention.', 'Alerts'],
  reports: ['Monitoring reports', 'Review and export trends from your silo network.', 'Reports'],
  users: ['User management', 'Manage workspace access and silo operator assignments.', 'Users'],
  settings: ['Workspace settings', 'Configure thresholds and workspace preferences.', 'Settings'],
}
const sourceNames = { hardware: 'Hardware', manual: 'Manual' }

function formatAlertDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Blantyre',
  }).format(date)
}

function buildReportCharts(readings, silos) {
  const charts = new Map()
  for (const reading of readings) {
    let chart = charts.get(reading.silo_id)
    if (!chart) {
      chart = {
        id: reading.silo_id,
        name: reading.silo_name || silos.find((silo) => silo.id === reading.silo_id)?.name || `Silo ${reading.silo_id}`,
        hours: new Map(),
      }
      charts.set(reading.silo_id, chart)
    }

    const hour = new Date(reading.recorded_at)
    hour.setMinutes(0, 0, 0)
    const timestamp = hour.getTime()
    let group = chart.hours.get(timestamp)
    if (!group) {
      group = { timestamp, count: 0, temperature: 0, humidity: 0, moistureTotal: 0, moistureCount: 0 }
      chart.hours.set(timestamp, group)
    }
    group.count += 1
    group.temperature += reading.temperature_c
    group.humidity += reading.humidity_percent
    if (reading.grain_moisture_percent != null) {
      group.moistureTotal += reading.grain_moisture_percent
      group.moistureCount += 1
    }
  }

  return Array.from(charts.values()).map((chart) => ({
    id: chart.id,
    name: chart.name,
    readings: Array.from(chart.hours.values()).sort((a, b) => a.timestamp - b.timestamp).map((group) => ({
      time: new Date(group.timestamp).toLocaleString('en-MW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' }),
      temperature: Number((group.temperature / group.count).toFixed(2)),
      humidity: Number((group.humidity / group.count).toFixed(2)),
      moisture: group.moistureCount ? Number((group.moistureTotal / group.moistureCount).toFixed(2)) : null,
    })),
  }))
}

export function ContentPage({ page }) {
  const { dataSource } = useDataMode()
  const { user } = useAuth()
  const isAdministrator = user?.role === 'administrator'
  const [silos, setSilos] = useState([])
  const [alerts, setAlerts] = useState([])
  const [alertFilter, setAlertFilter] = useState('all')
  const [users, setUsers] = useState([])
  const [inspections, setInspections] = useState([])
  const [history, setHistory] = useState([])
  const [readingLog, setReadingLog] = useState([])
  const [report, setReport] = useState(null)
  const [reportPeriod, setReportPeriod] = useState('7d')
  const [reportPage, setReportPage] = useState(1)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [message, setMessage] = useState('')
  const [successToast, setSuccessToast] = useState('')
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
    if (!successToast) return undefined
    const timeout = window.setTimeout(() => setSuccessToast(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [successToast])

  useEffect(() => {
    let active = true
    const request = {
      silos: () => siloService.list(dataSource).then((data) => { if (active) setSilos(data) }),
      alerts: () => alertService.list().then((data) => { if (active) setAlerts(data) }),
      users: () => userService.list().then((data) => { if (active) setUsers(data) }),
      reports: () => {
        setReport(null)
        setReadingLog([])
        setReportError('')
        setReportLoading(true)
        return reportService.history({ period: reportPeriod, data_source: dataSource }).then((data) => {
          if (active) {
            setReport(data)
            setReadingLog(data.readings)
          }
        }).finally(() => {
          if (active) setReportLoading(false)
        })
      },
      monitoring: () => Promise.all([
        siloService.list(dataSource).then((data) => { if (active) setSilos(data) }),
        inspectionService.list().then((data) => { if (active) setInspections(data) }),
        readingService.list(dataSource).then((data) => { if (active) setHistory(data) }),
      ]),
    }[page]
    if (!request) return undefined
    request().then(() => {
      if (active) {
        if (page === 'monitoring') setMessage('')
        setApiReady(true)
        setLoadedDataSource(dataSource)
      }
    }).catch((error) => {
      if (active) {
        setApiReady(false)
        setLoadedDataSource(dataSource)
        setSilos([])
        setAlerts([])
        setHistory([])
        setInspections([])
        if (page === 'monitoring') {
          setMessage('')
          return
        }
        const detail = page === 'alerts'
          ? 'Alerts are temporarily unavailable. Please check your connection and try again.'
          : error.response?.data?.detail || 'The local API could not load this page. Check the connection and try again.'
        if (page === 'reports') {
          setReadingLog([])
          setReportError(detail)
        } else setMessage(detail)
      }
    })
    return () => { active = false }
  }, [page, dataSource, reportPeriod])

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
      const updated = await alertService.acknowledge(alertId)
      setAlerts((items) => items.map((item) => item.id === alertId ? { ...item, ...updated } : item))
      notifyAlertsUpdated()
      setSuccessToast('Alert acknowledged. Please inspect the silo.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not acknowledge alert. Check the API connection.')
    }
  }

  const resolveAlert = async (alertId) => {
    try {
      const updated = await alertService.resolve(alertId)
      setAlerts((items) => items.map((item) => item.id === alertId ? { ...item, ...updated } : item))
      notifyAlertsUpdated()
      setSuccessToast('Alert resolved successfully.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not resolve alert. Check the API connection.')
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
    setMessage('')
    try {
      const saved = await inspectionService.create({ ...inspectionForm, silo_id: Number(inspectionForm.silo_id) })
      setInspections((items) => [saved, ...items])
      setInspectionForm({ silo_id: '', activity_type: 'inspection', notes: '' })
      setSuccessToast('Inspection record saved successfully.')
    } catch (error) {
      const status = error.response?.status
      const detail = error.response?.data?.detail
      setMessage(detail || (status === 403
        ? 'You are not assigned to this silo. Ask an administrator to assign it to your account.'
        : status === 404
          ? 'The selected silo could not be found. Refresh the page and select it again.'
          : status === 422
            ? 'Check that you selected a silo and entered notes for this record.'
            : 'Could not save the inspection record. Check your connection and try again.'))
    }
  }

  const deleteInspection = async (inspection) => {
    if (!window.confirm('Delete this inspection record? This cannot be undone.')) return
    try {
      await inspectionService.delete(inspection.id)
      setInspections((items) => items.filter((item) => item.id !== inspection.id))
      setSuccessToast('Inspection record deleted.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not delete the inspection record.')
    }
  }

  const deleteReading = async (reading) => {
    if (!window.confirm('Delete this manual reading? This cannot be undone.')) return
    try {
      await readingService.delete(reading.id)
      setHistory((items) => items.filter((item) => item.id !== reading.id))
      setSuccessToast('Manual reading deleted.')
      try {
        setSilos(await siloService.list('manual'))
      } catch (error) {
        setMessage(`Reading was deleted, but summary values could not be refreshed. ${error.response?.data?.detail || 'Check the service connection.'}`)
      }
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not delete the manual reading.')
    }
  }

  const submitReading = async (event) => {
    event.preventDefault()
    setMessage('')
    let saved
    try {
      saved = await readingService.create({
        ...readingForm,
        silo_id: Number(readingForm.silo_id),
        temperature_c: Number(readingForm.temperature_c),
        humidity_percent: Number(readingForm.humidity_percent),
        grain_moisture_percent: Number(readingForm.grain_moisture_percent),
        data_source: 'manual',
      })
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Could not save manual reading.')
      return
    }

    setReadingForm({ silo_id: '', temperature_c: '', humidity_percent: '', grain_moisture_percent: '' })
    setHistory((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
    setSuccessToast('Reading saved successfully.')
    try {
      const readings = await readingService.list('manual')
      setHistory(readings)
    } catch (error) {
      setMessage(`Reading was saved, but the list could not be refreshed. ${error.response?.data?.detail || 'Check the service connection.'}`)
    }
    try {
      setSilos(await siloService.list('manual'))
    } catch (error) {
      setMessage(`Reading was saved, but summary values could not be refreshed. ${error.response?.data?.detail || 'Check the service connection.'}`)
    }
  }

  const [title, description, tab] = pageCopy[page]
  const pageSilos = loadedDataSource === dataSource
    ? silos
    : []
  const pageHistory = loadedDataSource === dataSource ? history : []
  const visibleHistory = pageHistory.filter((reading) => reading.data_source === dataSource)
  const averageOf = (field, digits = 1) => {
    const values = pageSilos.map((silo) => silo.latest_reading?.[field]).filter(Number.isFinite)
    return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(digits)}${field === 'temperature_c' ? '°C' : '%'}` : '—'
  }
  const reportReadings = report?.readings || []
  const filteredAlerts = alerts.filter((alert) => (
    alertFilter === 'all' || (alertFilter === 'resolved' ? alert.resolved : !alert.resolved)
  ))
  const reportPageSize = 10
  const reportPageCount = Math.max(1, Math.ceil(readingLog.length / reportPageSize))
  const visibleReportReadings = readingLog.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize)
  const reportCharts = buildReportCharts(reportReadings, [])

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
            <label className="report-control">Date range
              <select aria-label="Report date range" value={reportPeriod} onChange={(event) => { setReportPage(1); setReportPeriod(event.target.value) }}>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </label>
            {isAdministrator && <button className="button button-primary" onClick={exportReportCsv} disabled={!reportReadings.length}><ArrowDownToLine size={16} /> Export CSV</button>}
          </>}
        </div>
      </div>
      <DataModeSelector />
      {successToast && <div className="toast-notice" role="status">{successToast}</div>}
      {message && <div className="inline-notice" role="status">{message}</div>}

      {page === 'monitoring' && dataSource === 'manual' && <section className="panel content-panel manual-entry-panel"><div className="panel-heading"><div><h2>Enter a manual reading</h2><p>Enter the values you measured. Saved readings are labeled Manual, not sensor data. You can delete an incorrect entry from the reading log.</p></div></div><form className="silo-form reading-form" onSubmit={submitReading}><label>Silo<select required value={readingForm.silo_id} onChange={(event) => setReadingForm({ ...readingForm, silo_id: event.target.value })}><option value="">Select silo</option>{pageSilos.map((silo) => <option key={silo.id} value={silo.id}>{silo.name}</option>)}</select></label><label>Air temperature (°C)<input type="number" step="0.1" required value={readingForm.temperature_c} onChange={(event) => setReadingForm({ ...readingForm, temperature_c: event.target.value })} /></label><label>Air humidity (%)<input type="number" step="0.1" min="0" max="100" required value={readingForm.humidity_percent} onChange={(event) => setReadingForm({ ...readingForm, humidity_percent: event.target.value })} /></label><label>Grain moisture (%)<input type="number" step="0.1" min="0" max="100" required value={readingForm.grain_moisture_percent} onChange={(event) => setReadingForm({ ...readingForm, grain_moisture_percent: event.target.value })} /></label><button className="button button-primary" disabled={!pageSilos.length}>Save manual reading</button></form>{!pageSilos.length && apiReady && <p className="page-footnote">No silos are assigned to your account. Ask an administrator to assign a silo before entering a reading.</p>}</section>}
      {page === 'silos' && (
        <section className="panel silo-panel content-panel">
          <div className="panel-heading"><div><h2>Local Silo</h2><p>Storage details and current readings for your local site.</p></div></div>
          {showForm && isAdministrator && <form className="silo-form" onSubmit={submitSilo}>
            <label>Silo name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Lilongwe Silo 03" /></label>
            <label>Location<input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="District or region" /></label>
            <label>Grain type<select value={form.grain_type} onChange={(event) => setForm({ ...form, grain_type: event.target.value })}><option>Wheat</option><option>Barley</option><option>Maize</option><option>Oats</option><option>Soybean</option></select></label>
            <label>Capacity (tonnes)<input type="number" min="1" required value={form.capacity_tonnes} onChange={(event) => setForm({ ...form, capacity_tonnes: event.target.value })} /></label>
            <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save silo'}</button>
          </form>}
          <SiloTable silos={pageSilos} />
        </section>
      )}

      {page === 'monitoring' && <>
        <div className="metric-grid compact-metrics">{[['Temperature', averageOf('temperature_c'), 'Air temperature'], ['Air humidity', averageOf('humidity_percent'), 'Relative humidity'], ['Grain moisture', averageOf('grain_moisture_percent'), 'Moisture content']].map(([label, value, note]) => <article className="metric-card" key={label}><div className="metric-top">{label}<span className="metric-icon green"><Activity size={18} /></span></div><div className="metric-value">{value}</div><DataSourceBadge source={dataSource} /><div className="metric-bottom">{note}</div></article>)}</div>
        <section className="panel content-panel">
          <div className="panel-heading"><div><h2>Active silo readings</h2><p>Latest {sourceNames[dataSource]?.toLowerCase() || 'selected-mode'} readings for each silo you can access.</p></div></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>SILO</th><th>LAST UPDATED</th><th>TEMPERATURE</th><th>AIR HUMIDITY</th><th>GRAIN MOISTURE</th><th>SOURCE</th><th>STATUS</th></tr></thead>
              <tbody>
                {pageSilos.filter((silo) => silo.latest_reading).map((silo) => (
                  <tr key={silo.id}>
                    <td>{silo.name}</td>
                    <td>{silo.latest_reading ? formatAlertDate(silo.latest_reading.recorded_at) : '—'}</td>
                    <td>{silo.latest_reading ? `${silo.latest_reading.temperature_c}°C` : '—'}</td>
                    <td>{silo.latest_reading ? `${silo.latest_reading.humidity_percent}%` : '—'}</td>
                    <td>{silo.latest_reading?.grain_moisture_percent == null ? '—' : `${silo.latest_reading.grain_moisture_percent}%`}</td>
                    <td>{silo.latest_reading && <span className={`source-badge ${silo.latest_reading.data_source}`}>{sourceNames[silo.latest_reading.data_source] || silo.latest_reading.data_source}</span>}</td>
                    <td><StatusBadge status={silo.status || 'offline'} /></td>
                  </tr>
                ))}
                {!pageSilos.length && <tr><td className="empty-table" colSpan="7">{loadedDataSource !== dataSource ? 'Loading readings…' : apiReady ? 'No silo is assigned to your account.' : 'Readings are unavailable right now.'}</td></tr>}
                {pageSilos.length > 0 && !pageSilos.some((silo) => silo.latest_reading) && <tr><td className="empty-table" colSpan="7">No readings are available for this mode yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel content-panel">
          <div className="panel-heading"><div><h2>Recent reading log</h2><p>Saved {dataSource === 'manual' ? 'manual' : 'hardware'} entries for the selected mode.</p></div><span className="status-badge info">{visibleHistory.length} records</span></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>DATE</th><th>TIME</th><th>SILO</th><th>TEMPERATURE</th><th>AIR HUMIDITY</th><th>GRAIN MOISTURE</th><th>SOURCE</th>{dataSource === 'manual' && <th><span className="visually-hidden">Actions</span></th>}</tr></thead>
              <tbody>
                {visibleHistory.slice(0, 10).map((reading) => (
                  <tr key={reading.id}>
                    <td>{new Date(reading.recorded_at).toLocaleDateString('en-MW', { timeZone: 'Africa/Blantyre' })}</td>
                    <td>{new Date(reading.recorded_at).toLocaleTimeString('en-MW', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' })}</td>
                    <td>{pageSilos.find((silo) => silo.id === reading.silo_id)?.name || 'Local Silo'}</td>
                    <td>{reading.temperature_c}°C</td>
                    <td>{reading.humidity_percent}%</td>
                    <td>{reading.grain_moisture_percent == null ? '—' : `${reading.grain_moisture_percent}%`}</td>
                    <td><span className={`source-badge ${reading.data_source}`}>{sourceNames[reading.data_source] || reading.data_source}</span></td>
                    {dataSource === 'manual' && <td><button type="button" className="icon-button inspection-delete-button" aria-label={`Delete manual reading for ${pageSilos.find((silo) => silo.id === reading.silo_id)?.name || `Silo ${reading.silo_id}`}`} title="Delete manual reading" onClick={() => deleteReading(reading)}><Trash2 size={16} /></button></td>}
                  </tr>
                ))}
                {!visibleHistory.length && <tr><td className="empty-table" colSpan={dataSource === 'manual' ? 8 : 7}>{loadedDataSource !== dataSource ? 'Loading readings…' : 'No readings available'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel content-panel">
          <div className="panel-heading"><div><h2>Inspection & maintenance log</h2><p>Record operator work and keep a history by silo.</p></div></div>
          <form className="silo-form inspection-form" onSubmit={submitInspection}>
            <label>Silo<select required value={inspectionForm.silo_id} onChange={(event) => setInspectionForm({ ...inspectionForm, silo_id: event.target.value })}><option value="">Select silo</option>{pageSilos.map((silo) => <option key={silo.id} value={silo.id}>{silo.name}</option>)}</select></label>
            <label>Activity<select value={inspectionForm.activity_type} onChange={(event) => setInspectionForm({ ...inspectionForm, activity_type: event.target.value })}><option value="inspection">Inspection</option><option value="maintenance">Maintenance</option><option value="cleaning">Cleaning</option><option value="other">Other</option></select></label>
            <label>Notes<input required value={inspectionForm.notes} onChange={(event) => setInspectionForm({ ...inspectionForm, notes: event.target.value })} placeholder="Work performed or observations" /></label>
            <button className="button button-primary">Save record</button>
          </form>
          <div className="table-scroll inspection-table-wrap">
            <table className="inspection-table">
              <thead><tr><th>Date & Time</th><th>Silo</th><th>Activity</th><th>Notes</th><th>Logged By</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {inspections.map((item) => (
                  <tr key={item.id}>
                    <td>{formatAlertDate(item.performed_at)}</td>
                    <td>{pageSilos.find((silo) => silo.id === item.silo_id)?.name || `Silo ${item.silo_id}`}</td>
                    <td>{item.activity_type}</td>
                    <td className="inspection-notes-cell">{item.notes}</td>
                    <td>{item.logged_by || (item.user_id === user?.id ? user.full_name : '—')}</td>
                    <td>{(isAdministrator || item.user_id === user?.id) && <button type="button" className="icon-button inspection-delete-button" aria-label={`Delete ${item.activity_type} record for ${pageSilos.find((silo) => silo.id === item.silo_id)?.name || `Silo ${item.silo_id}`}`} title="Delete record" onClick={() => deleteInspection(item)}><Trash2 size={16} /></button>}</td>
                  </tr>
                ))}
                {!inspections.length && <tr><td className="empty-table" colSpan="6">No inspection records have been saved.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}

      {page === 'alerts' && (
        <section className="panel content-panel">
          <div className="panel-heading"><div><h2>Alerts</h2><p>{isAdministrator ? 'Acknowledge alerts, inspect the silo, then resolve each issue when it is addressed.' : 'Review alert status for your assigned silos. An administrator manages alert actions.'}</p></div></div>
          <div className="alert-filter-tabs" role="tablist" aria-label="Filter alerts">
            {[['all', 'All'], ['active', 'Active'], ['resolved', 'Resolved']].map(([value, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={alertFilter === value}
                className={`alert-filter-tab${alertFilter === value ? ' active' : ''}`}
                key={value}
                onClick={() => setAlertFilter(value)}
              >
                {label}
                <span>{value === 'all' ? alerts.length : alerts.filter((alert) => value === 'resolved' ? alert.resolved : !alert.resolved).length}</span>
              </button>
            ))}
          </div>
          <div className="full-alert-list">{filteredAlerts.map((alert) => (
            <article className="full-alert" key={alert.id}>
              <span className={`alert-symbol ${alert.severity}`}>{alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '↑' : 'i'}</span>
              <div>
                <div className="alert-title"><strong>{alert.silo_name || `Silo ${alert.silo_id}`}</strong><StatusBadge status={alert.severity} />{alert.acknowledged && <span className="acknowledged-tag">Acknowledged</span>}{alert.resolved && <span className="resolved-label">Resolved</span>}</div>
                <p>{alert.message}</p>
                <small>{formatAlertDate(alert.created_at)}</small>
                {alert.acknowledged && !alert.resolved && <small className="alert-next-step">Acknowledged · inspect the silo before resolving</small>}
                {!isAdministrator && !alert.acknowledged && !alert.resolved && <small className="alert-view-status">Awaiting administrator action</small>}
              </div>
              <div className="full-alert-actions">
                {isAdministrator && !alert.resolved && !alert.acknowledged && <button className="button button-primary" onClick={() => acknowledge(alert.id)}><Check size={14} /> Acknowledge alert</button>}
                {isAdministrator && !alert.resolved && alert.acknowledged && <button className="button button-primary" onClick={() => resolveAlert(alert.id)}>Resolve alert</button>}
              </div>
            </article>
          ))}</div>
          {!filteredAlerts.length && <p className="activity-empty">{alertFilter === 'resolved' ? 'No resolved alerts.' : alertFilter === 'active' ? 'No active alerts.' : 'No alerts found.'}</p>}
        </section>
      )}

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
        ) : (
          <>
            {report?.truncated && <div className="inline-notice" role="status">This range holds {report.reading_count} readings. Totals and averages cover all of them; the chart and log below show only the newest {report.returned_count}. Choose a shorter date range to see everything.</div>}
            {reportReadings.length ? (
              <section className="panel content-panel report-chart-panel">
                <div className="panel-heading">
                  <div><h2>Historical Storage Conditions</h2><p>{report.reading_count} {sourceNames[dataSource]?.toLowerCase() || dataSource} readings across {report.silo_count} silos · charts shown separately for each silo</p></div>
                  <span className="status-badge info">{`${sourceNames[dataSource] || dataSource} mode selected`}</span>
                </div>
                <div className="report-silo-charts">
                  {reportCharts.map((chart) => (
                    <section className="report-silo-chart" key={chart.id} aria-label={`${chart.name} historical conditions`}>
                      <h3>{chart.name}</h3>
                      <div className="report-legend">
                        <span><i className="report-legend-temp" /> Temperature (°C)</span>
                        <span><i className="report-legend-humidity" /> Air humidity (%)</span>
                        <span><i className="report-legend-moisture" /> Grain moisture (%)</span>
                      </div>
                      <div className="large-chart report-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chart.readings} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                            <CartesianGrid stroke="#edf1ed" vertical={false} />
                            <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={30} />
                            <YAxis yAxisId="temperature" orientation="left" domain={['auto', 'auto']} tickLine={false} axisLine={false} label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
                            <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} label={{ value: '%', angle: 90, position: 'insideRight' }} />
                            <Tooltip />
                            <Line yAxisId="temperature" type="monotone" dataKey="temperature" name={`${chart.name} temperature (°C)`} stroke="#28814d" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                            <Line yAxisId="percent" type="monotone" dataKey="humidity" name={`${chart.name} air humidity (%)`} stroke="#76a4ce" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line yAxisId="percent" type="monotone" dataKey="moisture" name={`${chart.name} grain moisture (%)`} stroke="#c58b3b" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ) : (
              <section className="panel content-panel report-empty-state">
                <Warehouse size={28} />
                <h2>No readings available</h2>
                <p>No readings in the selected mode and date range. The historical log below shows only readings from the selected data source.</p>
              </section>
            )}
            <section className="panel content-panel report-table-panel">
              <div className="panel-heading"><div><h2>Historical reading log</h2><p>Saved {sourceNames[dataSource]?.toLowerCase() || dataSource} readings in the selected date range</p></div><span className="status-badge info">{readingLog.length} records</span></div>
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
                  })}{!readingLog.length && <tr><td className="empty-table" colSpan="8">No readings have been recorded in this date range.</td></tr>}</tbody>
                </table>
              </div>
              <div className="report-pagination">
                <span>{readingLog.length ? `Showing ${((reportPage - 1) * reportPageSize) + 1}–${Math.min(reportPage * reportPageSize, readingLog.length)} of ${readingLog.length}` : 'No readings to display'}</span>
                {readingLog.length > reportPageSize && <div>
                  <button className="button button-secondary" aria-label="Previous report page" disabled={reportPage <= 1} onClick={() => setReportPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /> Previous</button>
                  <span>Page {reportPage} of {reportPageCount}</span>
                  <button className="button button-secondary" aria-label="Next report page" disabled={reportPage >= reportPageCount} onClick={() => setReportPage((current) => Math.min(reportPageCount, current + 1))}>Next <ChevronRight size={15} /></button>
                </div>}
              </div>
            </section>
          </>
        )}
      </>}

      {page === 'users' && <section className="panel content-panel"><div className="panel-heading"><div><h2>Workspace users</h2><p>Manage account access and role assignments.</p></div><span className="status-badge normal">ROLE PROTECTED</span></div>{showUserForm && <form className="silo-form user-form" onSubmit={submitUser}><label>Full name<input required maxLength="150" value={userForm.full_name} onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })} /></label><label>Email<input type="email" required value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label><label>Role<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option value="operator">Silo operator</option><option value="administrator">Administrator</option></select></label><label>Temporary password<input type="password" autoComplete="new-password" minLength="8" maxLength="128" required value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Create account'}</button></form>}<div className="user-list">{users.map((user) => <div className="user-row" key={user.id}><span className="profile-avatar">{user.full_name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{user.full_name}</strong><small>{user.email} · {user.is_active === false ? 'Inactive' : 'Active'}</small></div><span className="role-tag"><Shield size={14} />{user.role}</span>{Number.isInteger(user.id) && <button className="button button-secondary" onClick={() => setUserActive(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</button>}</div>)}</div></section>}

      {page === 'settings' && <section className="panel content-panel settings-list"><div className="panel-heading"><div><h2>Alert thresholds</h2><p>Default silo threshold configuration</p></div><Settings size={19} /></div><div className="setting-row"><div><strong>Temperature warning</strong><small>Alert when silo temperature rises above this value</small></div><span>24 °C</span></div><div className="setting-row"><div><strong>Temperature critical</strong><small>Critical alert threshold for grain storage</small></div><span>28 °C</span></div><div className="setting-row"><div><strong>Humidity warning</strong><small>Alert when relative humidity rises above this value</small></div><span>65 %</span></div><div className="setting-row"><div><strong>Humidity critical</strong><small>Critical alert threshold for relative humidity</small></div><span>72 %</span></div><p className="page-footnote">Thresholds can be configured per silo through the API. This settings preview is read-only.</p></section>}

      <p className={`page-footnote system-status${apiReady && loadedDataSource === dataSource ? ' operational' : ''}`}><Activity size={14} /> <span className="system-status-dot" /> System status: {apiReady && loadedDataSource === dataSource ? 'Operational' : reportError ? 'Unavailable' : 'Connecting'}</p>
    </>
  )
}

function SiloTable({ silos }) {
  return <div className="table-scroll"><table><thead><tr><th>SILO</th><th>GRAIN TYPE</th><th>TEMPERATURE</th><th>HUMIDITY</th><th>GRAIN MOISTURE</th><th>CAPACITY</th><th>CONNECTION</th></tr></thead><tbody>{silos.map((silo) => <tr key={silo.id}><td><div className="silo-name"><span className="silo-icon"><Warehouse size={16} /></span><span><strong>{silo.name}</strong><small>{silo.location}</small></span></div></td><td>{silo.grain_type}</td><td><TemperatureReading value={silo.latest_reading?.temperature_c} warningThreshold={silo.temperature_warning_c} criticalThreshold={silo.temperature_critical_c} /></td><td>{silo.latest_reading ? `${silo.latest_reading.humidity_percent}%` : '—'}</td><td>{silo.latest_reading?.grain_moisture_percent != null ? <span className="moisture-cell">{silo.latest_reading.grain_moisture_percent}% <span className={`source-badge ${silo.latest_reading.data_source}`}>{sourceNames[silo.latest_reading.data_source]}</span></span> : '—'}</td><td><span className={(silo.capacity_percent || 0) > 90 ? 'capacity-high' : ''}>{silo.capacity_tonnes?.toLocaleString()} t · {silo.capacity_percent || 0}%</span></td><td><StatusBadge status={silo.connection_status || 'offline'} /></td></tr>)}</tbody></table>{silos.length === 0 && <div className="empty-state">Local Silo is not available yet.</div>}</div>
}
