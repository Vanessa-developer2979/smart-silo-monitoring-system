import { useEffect, useState } from 'react'
import { alertService, fetchDashboard, notifyAlertsUpdated } from '../services/api.js'
import { useDataMode } from './useDataMode.js'
import { demoAlerts, demoSilos } from '../utils/demoData.js'
import { formatReadingHistory } from '../utils/chartReadings.js'

export function useDashboardData() {
  const { dataSource } = useDataMode()
  const [silos, setSilos] = useState([])
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [apiState, setApiState] = useState('connecting')
  const [actionError, setActionError] = useState('')
  const [loadedSource, setLoadedSource] = useState(null)

  useEffect(() => {
    let active = true
    fetchDashboard(dataSource).then((data) => {
      if (!active) return
      setSilos(data.silos.map((silo) => ({
        ...silo,
        temperature: silo.latest_reading?.temperature_c,
        humidity: silo.latest_reading?.humidity_percent,
        grain_moisture_percent: silo.latest_reading?.grain_moisture_percent,
        data_source: silo.latest_reading?.data_source,
      })))
      setAlerts(data.alerts)
      const siloNames = new Map(data.silos.map((silo) => [silo.id, silo.name]))
      const recentReadings = dataSource === 'manual'
        ? data.manualReadings
        : data.history
      const readingActivity = recentReadings.map((reading) => ({
        id: `${dataSource}-reading-${reading.id}`,
        type: 'reading',
        siloName: siloNames.get(reading.silo_id) || `Silo ${reading.silo_id}`,
        description: dataSource === 'simulation'
          ? 'Simulated reading generated'
          : dataSource === 'hardware'
            ? 'Sensor reading received'
            : `Manual moisture entry · ${reading.grain_moisture_percent ?? '—'}%`,
        occurredAt: reading.recorded_at,
      }))
      const inspectionActivity = dataSource === 'manual'
        ? data.inspections.map((inspection) => ({
          id: `inspection-${inspection.id}`,
          type: 'inspection',
          siloName: siloNames.get(inspection.silo_id) || `Silo ${inspection.silo_id}`,
          description: `${inspection.activity_type[0].toUpperCase()}${inspection.activity_type.slice(1)} saved`,
          occurredAt: inspection.performed_at,
        }))
        : []
      setRecentActivity([...readingActivity, ...inspectionActivity]
        .sort((first, second) => new Date(second.occurredAt) - new Date(first.occurredAt))
        .slice(0, 4))
      setHistory(formatReadingHistory(data.history, dataSource === 'simulation'))
      setApiState('connected')
      setLoadedSource(dataSource)
    }).catch(() => {
      if (active) {
        setApiState('offline')
        setLoadedSource(dataSource)
        setSilos([])
        setAlerts([])
        setHistory([])
        setRecentActivity([])
      }
    })
    return () => { active = false }
  }, [dataSource])

  const acknowledge = async (alertId) => {
    setActionError('')
    try {
      const updated = await alertService.acknowledge(alertId)
      setAlerts((items) => items.map((item) => item.id === alertId ? { ...item, ...updated } : item))
      notifyAlertsUpdated()
      return true
    } catch (error) {
      setActionError(error.response?.data?.detail || 'Could not acknowledge alert. Check the API connection.')
      return false
    }
  }

  const resolve = async (alertId) => {
    setActionError('')
    try {
      const updated = await alertService.resolve(alertId)
      setAlerts((items) => items.map((item) => item.id === alertId ? { ...item, ...updated } : item))
      notifyAlertsUpdated()
      return true
    } catch (error) {
      setActionError(error.response?.data?.detail || 'Could not resolve alert. Check the API connection.')
      return false
    }
  }

  const sourceReady = loadedSource === dataSource
  return {
    silos: sourceReady ? silos : [],
    alerts: sourceReady ? alerts : [],
    history: sourceReady ? history : [],
    recentActivity: sourceReady ? recentActivity : [],
    apiState,
    isLoading: !sourceReady,
    actionError,
    acknowledge,
    resolve,
    dataSource,
  }
}
