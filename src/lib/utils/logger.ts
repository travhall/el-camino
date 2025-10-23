/**
 * Production-safe logger utility
 * Filters out logs in production while keeping errors visible
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
const isProd = import.meta.env.PROD || import.meta.env.MODE === 'production';

export const logger = {
  /**
   * Development-only logging
   */
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },

  /**
   * Development-only warnings
   */
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },

  /**
   * Always log errors (production + development)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Development-only debug logging
   */
  debug: (...args: any[]) => {
    if (isDev) console.debug(...args);
  },

  /**
   * Production-safe info logging (shows in both envs)
   * Use sparingly for critical user-facing info
   */
  info: (...args: any[]) => {
    console.info(...args);
  },

  /**
   * Group logging (dev only)
   */
  group: (label: string) => {
    if (isDev) console.group(label);
  },

  groupEnd: () => {
    if (isDev) console.groupEnd();
  },

  /**
   * Performance timing helper
   */
  time: (label: string) => {
    if (isDev) console.time(label);
  },

  timeEnd: (label: string) => {
    if (isDev) console.timeEnd(label);
  }
};

export default logger;
