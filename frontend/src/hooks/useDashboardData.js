import { useCallback, useEffect, useRef, useState } from 'react'
import { alertService, fetchDashboard, notifyAlertsUpdated } from '../services/api.js'
import { useDataMode } from './useDataMode.js'

const REFRESH_INTERVAL_MS = 30_000

export function useDashboardData() {
  const { dataSource } = useDataMode()
  const [silos, setSilos] = useState([])
  const [alerts, setAlerts] = useState([])
  const [actionError, setActionError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loadedSource, setLoadedSource] = useState(null)
  const loadedSourceRef = useRef(null)

  const load = useCallback((isActive) => fetchDashboard(dataSource).then((data) => {
    if (!isActive()) return
    setSilos(data.silos.map((silo) => ({
      ...silo,
      temperature: silo.latest_reading?.temperature_c,
      humidity: silo.latest_reading?.humidity_percent,
      grain_moisture_percent: silo.latest_reading?.grain_moisture_percent,
      data_source: silo.latest_reading?.data_source,
    })))
    setAlerts(data.alerts)
    setLoadError('')
    loadedSourceRef.current = dataSource
    setLoadedSource(dataSource)
  }).catch((error) => {
    if (!isActive()) return
    // Keep showing the last good data on a failed refresh; only blank the view on first load.
    setLoadError(error.response?.data?.detail || 'Could not reach the API. Data may be out of date.')
    if (loadedSourceRef.current !== dataSource) {
      setSilos([])
      setAlerts([])
      loadedSourceRef.current = dataSource
      setLoadedSource(dataSource)
    }
  }), [dataSource])

  useEffect(() => {
    let active = true
    const isActive = () => active
    load(isActive)
    // "Online" is derived from reading age, so the view must refresh to stay truthful.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(isActive)
    }, REFRESH_INTERVAL_MS)
    const onAlertsUpdated = () => load(isActive)
    window.addEventListener('alerts:updated', onAlertsUpdated)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('alerts:updated', onAlertsUpdated)
    }
  }, [load])

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
    loading: !sourceReady,
    loadError,
    actionError,
    acknowledge,
    resolve,
    dataSource,
  }
}
