import { useDataMode } from '../../hooks/useDataMode.js'

export function SimulatedDataNotice() {
  const { dataSource, selectDataSource } = useDataMode()
  const labels = { simulation: 'SIMULATION MODE', hardware: 'LIVE HARDWARE MODE', manual: 'MANUAL ENTRY MODE' }
  return (
    <div className="data-notice mode-notice">
      <div className="mode-description"><span>{labels[dataSource]}</span></div>
      <label className="mode-picker">Data mode
        <select value={dataSource} onChange={(event) => selectDataSource(event.target.value)} aria-label="Select data mode">
          <option value="simulation">Simulation Mode</option>
          <option value="hardware">Live Hardware Mode</option>
          <option value="manual">Manual Entry Mode</option>
        </select>
      </label>
    </div>
  )
}
