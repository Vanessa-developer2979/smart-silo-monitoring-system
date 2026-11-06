import { useState } from 'react'
import { DataModeContext } from './DataModeContext.js'

export function DataModeProvider({ children }) {
  const [dataSource, setDataSource] = useState(() => {
    const saved = localStorage.getItem('dataSource')
    return ['hardware', 'manual'].includes(saved) ? saved : 'manual'
  })

  const selectDataSource = (value) => {
    if (!['hardware', 'manual'].includes(value)) return
    localStorage.setItem('dataSource', value)
    setDataSource(value)
  }

  return <DataModeContext.Provider value={{ dataSource, selectDataSource }}>{children}</DataModeContext.Provider>
}
