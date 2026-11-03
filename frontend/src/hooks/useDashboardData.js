import { useEffect, useState } from 'react'
import { alertService, fetchDashboard } from '../services/api.js'
import { useDataMode } from './useDataMode.js'
import { demoAlerts, demoSilos } from '../utils/demoData.js'

export function useDashboardData() {
  const { dataSource } = useDataMode()
  const [silos, setSilos] = useState(demoSilos)
  const [alerts, setAlerts] = useState(demoAlerts)
  const [history, setHistory] = useState([])
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
        if (dataSource !== 'simulation') {
          setSilos([])
          setAlerts([])
          setHistory([])
        }
      }
    })
    return () => { active = false }
  }, [dataSource])

  const acknowledge = async (alertId) => {
    setActionError('')
    try {
      const updated = await alertService.acknowledge(alertId)
      setAlerts((items) => items.map((item) => item.id === alertId ? { ...item, ...updated } : item))
    } catch (error) {
      setActionError(error.response?.data?.detail || 'Could not acknowledge alert. Check the API connection.')
    }
  }

  const resolve = async (alertId) => {
    setActionError('')
    try {
      const updated = await alertService.resolve(alertId)
      setAlerts((items) => items.map((item) => item.id === alertId ? { ...item, ...updated } : item))
    } catch (error) {
      setActionError(error.response?.data?.detail || 'Could not resolve alert. Check the API connection.')
    }
  }

  const sourceReady = loadedSource === dataSource
  return {
    silos: sourceReady ? silos : [],
    alerts: sourceReady ? alerts : [],
    history: sourceReady ? history : [],
    apiState,
    isLoading: !sourceReady,
    actionError,
    acknowledge,
    resolve,
    dataSource,
  }
}
