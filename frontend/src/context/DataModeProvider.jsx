import { useState } from 'react'
import { DataModeContext } from './DataModeContext.js'

export function DataModeProvider({ children }) {
  const [dataSource, setDataSource] = useState(() => {
    const saved = localStorage.getItem('dataSource')
    return ['simulation', 'hardware', 'manual'].includes(saved) ? saved : 'simulation'
  })

  const selectDataSource = (value) => {
    if (!['simulation', 'hardware', 'manual'].includes(value)) return
    localStorage.setItem('dataSource', value)
    setDataSource(value)
  }

  return <DataModeContext.Provider value={{ dataSource, selectDataSource }}>{children}</DataModeContext.Provider>
}
