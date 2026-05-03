import { useRef } from 'react'
import ApplianceGrid from '@/components/dashboard/ApplianceGrid'
import DeviceHistoryModal from '@/components/dashboard/DeviceHistoryModal'
import AddDeviceModal from '@/components/dashboard/AddDeviceModal'
import LoadingSkeleton from '@/components/dashboard/LoadingSkeleton'
import { useDashboard, formatWatts, formatRM, formatTime, formatReadingDate } from '@/context/DashboardContext'

function exportReadingsToCSV(
  readings: any[],
  deviceName: string,
  devices: any[],
  forecastHelper: any,
  metricHelper: any,
) {
  const device = devices.find((d: any) => d.name === deviceName)
  if (!device) return

  const headers = ['Timestamp', 'Power (W)', 'Status', 'Forecast', 'Confidence (%)', 'Metrics']
  const rows = readings.map((reading: any) => {
    const isRunning = reading.power_usage_watts >= 3
    const forecast = forecastHelper(
      reading.device_id,
      reading.id,
      isRunning ? 'on' : 'off',
      reading.timestamp,
      reading.power_usage_watts,
    )
    const metrics = metricHelper(device, reading)
    const metricsString = metrics.map((m: any) => `${m.label}=${m.value}`).join(' | ')

    return [
      new Date(reading.timestamp).toLocaleString('en-GB'),
      reading.power_usage_watts.toString(),
      isRunning ? 'Running' : 'Closed',
      forecast.forecastStatus,
      forecast.confidence.toString(),
      metricsString,
    ]
  })

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"` ).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${deviceName.replace(/\s+/g, '-').toLowerCase()}-readings.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function Appliances() {
  const {
    devices,
    togglingId,
    isPageLoading,
    toasts,
    selectedDeviceId,
    deviceHistoryCache,
    deviceHistoryLoading,
    deviceHistoryError,
    deviceHistoryFilter,
    isModalOpen,
    isSubmitting,
    form,
    forecastMaintenance,
    maintenanceExplanation,
    readingMetricHelper,
    openDeviceHistory,
    closeDeviceHistory,
    setDeviceHistoryFilter,
    toggleDevice,
    openModal,
    handleSubmit,
    setForm,
    closeModal,
  } = useDashboard()

  const modalRef = useRef<HTMLDivElement | null>(null)

  return (
    <div className="page-shell">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.newStatus === 'on' ? 'toast-on' : 'toast-off'}`}
          >
            <span className="toast-device">{toast.deviceName}</span>
            <span className="toast-status">turned {toast.newStatus}</span>
          </div>
        ))}
      </div>

      <main className="dashboard">
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div>
              <h1 className="hero-title">Manage Appliances</h1>
              <p className="hero-copy">Monitor, control, and manage all your devices in one place.</p>
            </div>
            <button className="button button-primary" onClick={openModal}>
              Add appliance
            </button>
          </div>
        </section>

        {isPageLoading ? (
          <LoadingSkeleton />
        ) : devices.length === 0 ? (
          <div className="empty-state">No devices yet. Add a device to start tracking live energy usage.</div>
        ) : (
          <>
            <ApplianceGrid devices={devices} togglingId={togglingId} onOpenHistory={openDeviceHistory} onToggle={toggleDevice} />

            <DeviceHistoryModal
              selectedDeviceId={selectedDeviceId}
              devices={devices}
              deviceHistoryCache={deviceHistoryCache}
              deviceHistoryLoading={deviceHistoryLoading}
              deviceHistoryError={deviceHistoryError}
              deviceHistoryFilter={deviceHistoryFilter}
              onSetDeviceHistoryFilter={setDeviceHistoryFilter}
              onClose={closeDeviceHistory}
              modalRef={modalRef}
              forecastMaintenance={forecastMaintenance}
              maintenanceExplanation={maintenanceExplanation as any}
              readingMetricHelper={readingMetricHelper as any}
              exportReadingsToCSV={(readings, deviceName) => exportReadingsToCSV(readings, deviceName, devices, forecastMaintenance, readingMetricHelper)}
              formatWatts={formatWatts}
              formatTime={formatTime}
              formatReadingDate={formatReadingDate}
            />
          </>
        )}
      </main>

      <AddDeviceModal
        isOpen={isModalOpen}
        isSubmitting={isSubmitting}
        form={form}
        onClose={() => closeModal()}
        onSubmit={handleSubmit}
        onSetForm={setForm}
      />
    </div>
  )
}
