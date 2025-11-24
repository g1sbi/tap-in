/**
 * App Information
 * 
 * Centralized location for app metadata including version, title, and subtitle.
 * Update the version number here when releasing a new version.
 */

export const APP_INFO = {
  /** App version number (e.g., "0.12.0") */
  VERSION: '0.15.0',
  
  /** App title displayed on home screen */
  TITLE: 'DICE RUSH!',
  
  /** App subtitle displayed on home screen */
  SUBTITLE: 'The Party Betting Game',
  
  /** Version label prefix (e.g., "Early Access", "Beta", "v1.0") */
  VERSION_LABEL: 'Early Access',
} as const;

/**
 * Get formatted version string for display
 * @returns Formatted version string (e.g., "Early Access • v0.12.0")
 */
export function getVersionString(): string {
  return `${APP_INFO.VERSION_LABEL} • v${APP_INFO.VERSION}`;
}

