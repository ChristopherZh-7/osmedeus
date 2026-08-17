/**
 * Demo mode utility for runtime switching between mock and real API
 *
 * Priority:
 * 1. localStorage.osmedeus_demo_mode_v2 (runtime toggle)
 * 2. process.env.NEXT_PUBLIC_USE_MOCK (build-time fallback)
 */

const DEMO_MODE_STORAGE_KEY = "osmedeus_demo_mode_v2";
const LEGACY_DEMO_MODE_STORAGE_KEY = "osmedeus_demo_mode";

/**
 * Check if demo mode is enabled (runtime check)
 * Call this in API functions instead of checking env var directly
 */
export function isDemoMode(): boolean {
  // First check localStorage (runtime toggle)
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
  }
  // Fallback to env var (build-time setting)
  return process.env.NEXT_PUBLIC_USE_MOCK === "true";
}

/**
 * Set demo mode preference
 * Note: Page reload is recommended after calling this
 */
export function setDemoMode(enabled: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(enabled));
    localStorage.removeItem(LEGACY_DEMO_MODE_STORAGE_KEY);
  }
}

/**
 * Get raw demo mode preference from localStorage
 * Returns null if not set (use for display purposes)
 */
export function getDemoModePreference(): boolean | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
  }
  return null;
}

/**
 * Clear demo mode preference (will fall back to env var)
 */
export function clearDemoModePreference(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DEMO_MODE_STORAGE_KEY);
  }
}
