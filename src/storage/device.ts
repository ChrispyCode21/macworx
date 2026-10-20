// The iPad's device key (SPEC §2, §5.4), in the app's own storage. #19 grows this into the full storage
// module. Storage can be missing or refuse writes (private mode, quota); that reads as "not paired".

const KEY = 'macworx.deviceKey'

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function getDeviceKey(): string | null {
  try {
    return storage()?.getItem(KEY) ?? null
  } catch {
    return null
  }
}

/** Stores the key; false if this iPad's storage is missing or refused it. */
export function setDeviceKey(key: string): boolean {
  try {
    const s = storage()
    if (!s) return false
    s.setItem(KEY, key)
    return s.getItem(KEY) === key
  } catch {
    return false
  }
}

export function forgetDeviceKey(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    // Nothing stored, nothing to forget.
  }
}

/** Whether the app runs installed from the home screen, not in a Safari tab (SPEC §5.4). */
export function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || globalThis.matchMedia?.('(display-mode: standalone)').matches === true
}
