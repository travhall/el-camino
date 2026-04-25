// Tiny logger that silences debug/info chatter in production but keeps
// warnings and errors. Replaces ad-hoc `console.log` calls in hot paths
// so prod logs aren't flooded with per-request debug output (which costs
// money on Netlify and makes real errors harder to find).

const isDev = !import.meta.env.PROD;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
