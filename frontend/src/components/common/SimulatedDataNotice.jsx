import { useDataMode } from '../../hooks/useDataMode.js'

export function SimulatedDataNotice({ children }) {
  const { dataSource, selectDataSource } = useDataMode()
  const messages = {
    simulation: 'Generated sample readings are shown for demonstration. No physical sensor hardware is connected.',
    hardware: 'Hardware mode is selected, but no sensor integration is connected. Live readings will appear after a supported device is configured.',
    manual: 'Manual mode displays values entered by authorized users. These records are labeled as manually entered.',
  }
  const labels = { simulation: 'SIMULATION MODE', hardware: 'LIVE HARDWARE MODE', manual: 'MANUAL ENTRY MODE' }
  return (
    <div className="data-notice mode-notice">
      <div className="mode-description"><span>{labels[dataSource]}</span><p>{dataSource === 'simulation' ? messages.simulation : messages[dataSource]}</p></div>
      <label className="mode-picker">Data mode
        <select value={dataSource} onChange={(event) => selectDataSource(event.target.value)} aria-label="Select data mode">
          <option value="simulation">Simulation Mode</option>
          <option value="hardware">Live Hardware Mode</option>
          <option value="manual">Manual Entry Mode</option>
        </select>
      </label>
      {children && <small className="mode-detail">{children}</small>}
    </div>
  )
}
