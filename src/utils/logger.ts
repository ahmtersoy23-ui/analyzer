/**
 * Logger utility - only logs in development mode
 * Prevents console.log performance overhead in production
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors
    console.error(...args);
  },
  time: (label: string) => {
    if (isDev) console.time(label);
  },
  timeEnd: (label: string) => {
    if (isDev) console.timeEnd(label);
  },
  // Performance tracking - always enabled for metrics
  perf: (label: string, startTime: number) => {
    const duration = performance.now() - startTime;
    if (isDev || duration > 1000) {
      console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
    return duration;
  }
};

export default logger;
