const hourFormatter = new Intl.DateTimeFormat('en-MW', {
  hour: '2-digit',
  hour12: false,
  timeZone: 'Africa/Blantyre',
})

export function formatReadingHistory(readings, hourly = false) {
  const validReadings = readings
    .map((reading) => ({ ...reading, timestamp: new Date(reading.recorded_at).getTime() }))
    .filter((reading) => Number.isFinite(reading.timestamp))
    .sort((first, second) => first.timestamp - second.timestamp)

  if (!hourly) {
    return validReadings.map((reading) => ({
      ...reading,
      time: new Date(reading.timestamp).toLocaleTimeString('en-MW', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Blantyre',
      }),
    }))
  }

  const groups = new Map()
  for (const reading of validReadings) {
    const timestamp = Math.floor(reading.timestamp / 3_600_000) * 3_600_000
    const group = groups.get(timestamp) || { timestamp, temperature: 0, humidity: 0, count: 0 }
    group.temperature += reading.temperature_c
    group.humidity += reading.humidity_percent
    group.count += 1
    groups.set(timestamp, group)
  }

  return Array.from(groups.values(), (group) => ({
    timestamp: group.timestamp,
    recorded_at: new Date(group.timestamp).toISOString(),
    time: `${hourFormatter.format(group.timestamp)}:00`,
    temperature: Number((group.temperature / group.count).toFixed(2)),
    humidity: Number((group.humidity / group.count).toFixed(2)),
  }))
}

export function chartTickInterval(itemCount) {
  return Math.max(0, Math.ceil(itemCount / 6) - 1)
}
