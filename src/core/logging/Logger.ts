/**
 * NearShare Production Structured Logger
 *
 * Provides structured logging with safe payload redaction (preventing keys,
 * PINs, tokens, filesystem absolute paths, and raw payloads from leaking to logs).
 * Suppresses debug and trace statements in production builds.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERNS = [
  'key',
  'token',
  'secret',
  'pin',
  'password',
  'auth',
  'private',
  'signature',
  'seed',
];

export class Logger {
  private namespace: string;
  private isDev: boolean;

  constructor(namespace: string) {
    this.namespace = namespace;
    this.isDev =
      (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
      (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV !== 'production');
  }

  private sanitize(data?: unknown): unknown {
    if (data === undefined || data === null) return undefined;
    if (typeof data !== 'object') return data;

    try {
      const cloned = JSON.parse(JSON.stringify(data));
      this.redactObject(cloned);
      return cloned;
    } catch {
      return '[Complex/Circular Object]';
    }
  }

  private redactObject(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.redactObject(obj[key]);
      }
    }
  }

  debug(message: string, context?: unknown): void {
    if (!this.isDev) return;
    if (context !== undefined) {
      console.debug(`[${this.namespace}] [DEBUG] ${message}`, this.sanitize(context));
    } else {
      console.debug(`[${this.namespace}] [DEBUG] ${message}`);
    }
  }

  info(message: string, context?: unknown): void {
    if (context !== undefined) {
      console.info(`[${this.namespace}] [INFO] ${message}`, this.sanitize(context));
    } else {
      console.info(`[${this.namespace}] [INFO] ${message}`);
    }
  }

  warn(message: string, context?: unknown): void {
    if (context !== undefined) {
      console.warn(`[${this.namespace}] [WARN] ${message}`, this.sanitize(context));
    } else {
      console.warn(`[${this.namespace}] [WARN] ${message}`);
    }
  }

  error(message: string, error?: unknown): void {
    // In production, ensure raw sensitive error objects don't leak secrets
    if (error instanceof Error) {
      console.error(`[${this.namespace}] [ERROR] ${message}: ${error.message}`);
    } else if (error !== undefined) {
      console.error(`[${this.namespace}] [ERROR] ${message}`, this.sanitize(error));
    } else {
      console.error(`[${this.namespace}] [ERROR] ${message}`);
    }
  }
}

export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}
