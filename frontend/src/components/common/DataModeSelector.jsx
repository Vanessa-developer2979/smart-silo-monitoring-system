import { useDataMode } from '../../hooks/useDataMode.js'

export function DataModeSelector() {
  const { dataSource, selectDataSource } = useDataMode()
  const labels = { hardware: 'HARDWARE READINGS', manual: 'MANUAL READINGS' }
  return (
    <div className="data-notice mode-notice">
      <div className="mode-description"><span>{labels[dataSource]}</span></div>
      <label className="mode-picker">Data mode
        <select value={dataSource} onChange={(event) => selectDataSource(event.target.value)} aria-label="Select data mode">
          <option value="hardware">Hardware Readings</option>
          <option value="manual">Manual Readings</option>
        </select>
      </label>
    </div>
  )
}
