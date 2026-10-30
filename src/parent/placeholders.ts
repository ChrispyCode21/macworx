// SAMPLE DATA (SPEC §5.3). The app has no source yet for a device's Online or Offline state or for its
// browser and system line, so the Devices screen shows these fixed values, each with a visible "Sample"
// label. Replace the bodies with real data when a source exists (follow-up issue "Replace Devices sample data").
import type { Device } from './api'

export type DeviceStatus = 'online' | 'offline'

/** Sample: every connected device reads as Online. */
export function deviceStatus(_device: Device): DeviceStatus {
  return 'online'
}

/** Sample: the browser and system line under a device's name. */
export function deviceBrowserLine(_device: Device): string {
  return 'Tablet · Safari'
}
