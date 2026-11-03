import { useDataMode } from '../../hooks/useDataMode.js'

export function SimulatedDataNotice({ children }) {
  const { dataSource, selectDataSource } = useDataMode()
  const messages = {
    simulation: 'Simulation Mode Active: No physical IoT hardware is connected. Displaying generated data for demonstration purposes.',
    hardware: 'Live Hardware Mode selected. No ESP32/DHT22 device is connected; hardware readings will appear only after integration.',
    manual: 'Manual Entry Mode selected. Manually entered readings are labeled by source; no physical IoT hardware is connected.',
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
