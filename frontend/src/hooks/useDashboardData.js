import { useEffect, useState } from 'react'
import { alertService, fetchDashboard, notifyAlertsUpdated } from '../services/api.js'
import { useDataMode } from './useDataMode.js'
import { demoAlerts, demoSilos } from '../utils/demoData.js'

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
      setRecentActivity([
        ...data.manualReadings
          .filter((reading) => reading.grain_moisture_percent != null)
          .map((reading) => ({
            id: `reading-${reading.id}`,
            type: 'reading',
            siloName: siloNames.get(reading.silo_id) || `Silo ${reading.silo_id}`,
            description: `Manual moisture entry · ${reading.grain_moisture_percent}%`,
            occurredAt: reading.recorded_at,
          })),
        ...data.inspections.map((inspection) => ({
          id: `inspection-${inspection.id}`,
          type: 'inspection',
          siloName: siloNames.get(inspection.silo_id) || `Silo ${inspection.silo_id}`,
          description: `${inspection.activity_type[0].toUpperCase()}${inspection.activity_type.slice(1)} saved for ${siloNames.get(inspection.silo_id) || `Silo ${inspection.silo_id}`}`,
          occurredAt: inspection.performed_at,
        })),
      ].sort((first, second) => new Date(second.occurredAt) - new Date(first.occurredAt)).slice(0, 4))
      setHistory(data.history.map((reading) => ({
        time: new Date(reading.recorded_at).toLocaleTimeString('en-MW', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' }),
        temperature: reading.temperature_c,
        humidity: reading.humidity_percent,
        data_source: reading.data_source,
      })).reverse())
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
    } catch (error) {
      setActionError(error.response?.data?.detail || 'Could not acknowledge alert. Check the API connection.')
    }
  }

  const resolve = async (alertId) => {
    setActionError('')
    try {
      const updated = await alertService.resolve(alertId)
      setAlerts((items) => items.map((item) => item.id === alertId ? { ...item, ...updated } : item))
      notifyAlertsUpdated()
    } catch (error) {
      setActionError(error.response?.data?.detail || 'Could not resolve alert. Check the API connection.')
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
