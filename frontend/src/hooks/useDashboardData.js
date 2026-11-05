import { useEffect, useState } from 'react'
import { alertService, fetchDashboard, notifyAlertsUpdated } from '../services/api.js'
import { useDataMode } from './useDataMode.js'

export function useDashboardData() {
  const { dataSource } = useDataMode()
  const [silos, setSilos] = useState([])
  const [alerts, setAlerts] = useState([])
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
      setLoadedSource(dataSource)
    }).catch(() => {
      if (active) {
        setLoadedSource(dataSource)
        setSilos([])
        setAlerts([])
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
    actionError,
    acknowledge,
    resolve,
    dataSource,
  }
}
