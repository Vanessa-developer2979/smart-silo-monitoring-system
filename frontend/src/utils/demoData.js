export const demoSilos = [
  { id: 1, name: 'Kanengo', location: 'Lilongwe District', grain_type: 'Maize', capacity_tonnes: 1200, capacity_percent: 78, status: 'normal', connection_status: 'simulated', temperature: 20.4, humidity: 56, grain_moisture_percent: 13.2, data_source: 'simulation', operator_ids: [] },
  { id: 2, name: 'Mzuzu (Msonda)', location: 'Mzuzu District', grain_type: 'Maize', capacity_tonnes: 950, capacity_percent: 62, status: 'normal', connection_status: 'simulated', temperature: 21.1, humidity: 58, grain_moisture_percent: 13.5, data_source: 'simulation', operator_ids: [] },
  { id: 3, name: 'Luchenza', location: 'Thyolo District', grain_type: 'Maize', capacity_tonnes: 1100, capacity_percent: 74, status: 'normal', connection_status: 'simulated', temperature: 22.0, humidity: 61, grain_moisture_percent: 13.8, data_source: 'simulation', operator_ids: [] },
  { id: 4, name: 'Blantyre', location: 'Blantyre District', grain_type: 'Groundnuts', capacity_tonnes: 1400, capacity_percent: 83, status: 'normal', connection_status: 'simulated', temperature: 23.2, humidity: 63, grain_moisture_percent: 12.9, data_source: 'simulation', operator_ids: [] },
  { id: 5, name: 'Salima', location: 'Salima District', grain_type: 'Rice', capacity_tonnes: 1000, capacity_percent: 68, status: 'warning', connection_status: 'simulated', temperature: 24.0, humidity: 65, grain_moisture_percent: 14.1, data_source: 'simulation', operator_ids: [] },
  { id: 6, name: 'Dowa', location: 'Dowa District', grain_type: 'Wheat', capacity_tonnes: 1500, capacity_percent: 91, status: 'warning', connection_status: 'simulated', temperature: 24.8, humidity: 68, grain_moisture_percent: 13.6, data_source: 'simulation', operator_ids: [] },
]

export const demoAlerts = [
  { id: 1, severity: 'critical', silo_id: 6, silo_name: 'Dowa', message: 'Simulated temperature above the critical threshold.', created_at: 'Today, 10:42 AM', acknowledged: true, resolved: true },
  { id: 2, severity: 'warning', silo_id: 5, silo_name: 'Salima', message: 'Simulated humidity is approaching the recommended limit.', created_at: 'Today, 09:18 AM', acknowledged: false, resolved: false },
  { id: 3, severity: 'info', silo_id: 3, silo_name: 'Luchenza', message: 'Simulated inspection is due this week.', created_at: 'Yesterday, 03:30 PM', acknowledged: true, resolved: false },
]
