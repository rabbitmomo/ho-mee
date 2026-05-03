import type { Dispatch, SetStateAction, FormEvent } from 'react'

type DeviceStatus = 'on' | 'off'
type ConnectionType = 'wifi' | 'bluetooth'

interface DeviceFormState {
  name: string
  room: string
  category: string
  status: DeviceStatus
  power_rating_watts: string
  connection_type: ConnectionType
  wifi_ssid?: string
  wifi_ip?: string
  bluetooth_mac?: string
  bluetooth_pairing_code?: string
}

interface AddDeviceModalProps {
  isOpen: boolean
  isSubmitting: boolean
  form: DeviceFormState
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSetForm: Dispatch<SetStateAction<DeviceFormState>>
}

export default function AddDeviceModal({ isOpen, isSubmitting, form, onClose, onSubmit, onSetForm }: AddDeviceModalProps) {
  if (!isOpen) return null

  const handleConnectionTypeChange = (type: ConnectionType) => {
    onSetForm((prev) => ({
      ...prev,
      connection_type: type,
      // Clear connection‑specific fields when switching
      wifi_ssid: type === 'wifi' ? prev.wifi_ssid : undefined,
      wifi_ip: type === 'wifi' ? prev.wifi_ip : undefined,
      bluetooth_mac: type === 'bluetooth' ? prev.bluetooth_mac : undefined,
      bluetooth_pairing_code: type === 'bluetooth' ? prev.bluetooth_pairing_code : undefined,
    }))
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={onSubmit}>
          <div className="modal-header">
            <div>
              <h2 className="panel-title">Add device</h2>
              <p className="panel-copy">Create a tracked appliance to see live energy usage and estimated RM cost.</p>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close add device">
              ×
            </button>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">Device name</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(event) => onSetForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Air Conditioner"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="room">Room</label>
              <input
                id="room"
                type="text"
                value={form.room}
                onChange={(event) => onSetForm((current) => ({ ...current, room: event.target.value }))}
                placeholder="e.g. Living Room"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <input
                id="category"
                type="text"
                value={form.category}
                onChange={(event) => onSetForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="e.g. Cooling"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={form.status}
                onChange={(event) => onSetForm((current) => ({ ...current, status: event.target.value as DeviceStatus }))}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="power">Power rating (watts)</label>
              <input
                id="power"
                type="number"
                min="1"
                step="1"
                value={form.power_rating_watts}
                onChange={(event) => onSetForm((current) => ({ ...current, power_rating_watts: event.target.value }))}
                placeholder="e.g. 1800"
                required
              />
            </div>

            {/* Connection Type Section */}
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Connection type</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="connection_type"
                    value="wifi"
                    checked={form.connection_type === 'wifi'}
                    onChange={() => handleConnectionTypeChange('wifi')}
                  />
                  <span>WiFi</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="connection_type"
                    value="bluetooth"
                    checked={form.connection_type === 'bluetooth'}
                    onChange={() => handleConnectionTypeChange('bluetooth')}
                  />
                  <span>Bluetooth</span>
                </label>
              </div>
            </div>

            {/* Conditional fields based on connection type */}
            {form.connection_type === 'wifi' && (
              <>
                <div className="field">
                  <label htmlFor="wifi_ssid">WiFi SSID</label>
                  <input
                    id="wifi_ssid"
                    type="text"
                    value={form.wifi_ssid || ''}
                    onChange={(e) => onSetForm((current) => ({ ...current, wifi_ssid: e.target.value }))}
                    placeholder="e.g. MyHomeWiFi"
                  />
                </div>
                <div className="field">
                  <label htmlFor="wifi_ip">IP Address (optional)</label>
                  <input
                    id="wifi_ip"
                    type="text"
                    value={form.wifi_ip || ''}
                    onChange={(e) => onSetForm((current) => ({ ...current, wifi_ip: e.target.value }))}
                    placeholder="192.168.1.100"
                  />
                </div>
              </>
            )}

            {form.connection_type === 'bluetooth' && (
              <>
                <div className="field">
                  <label htmlFor="bluetooth_mac">Bluetooth MAC Address</label>
                  <input
                    id="bluetooth_mac"
                    type="text"
                    value={form.bluetooth_mac || ''}
                    onChange={(e) => onSetForm((current) => ({ ...current, bluetooth_mac: e.target.value }))}
                    placeholder="AA:BB:CC:DD:EE:FF"
                  />
                </div>
                <div className="field">
                  <label htmlFor="bluetooth_pairing_code">Pairing Code (if required)</label>
                  <input
                    id="bluetooth_pairing_code"
                    type="text"
                    value={form.bluetooth_pairing_code || ''}
                    onChange={(e) => onSetForm((current) => ({ ...current, bluetooth_pairing_code: e.target.value }))}
                    placeholder="0000 or 1234"
                  />
                </div>
              </>
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={`button button-primary ${isSubmitting ? 'shimmer' : ''}`} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Add device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}