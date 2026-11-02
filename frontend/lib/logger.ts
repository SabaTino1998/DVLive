/**
 * Centralized logger with severity levels, ring buffer, and native-compatible
 * runtime log-level override via AsyncStorage (key: "bolt_debug").
 *
 * On web, the legacy cookie mechanism is still honored as a secondary source.
 * On native (iOS/Android), only AsyncStorage is used.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

const VALID_LEVELS = new Set<string>(Object.keys(LEVEL_PRIORITY));

const GLOBAL_ENABLED =
  (process.env.EXPO_PUBLIC_LOG_ENABLED ?? 'true').toLowerCase() !== 'false';

const GLOBAL_LEVEL: LogLevel =
  (process.env.EXPO_PUBLIC_LOG_LEVEL as LogLevel) || 'info';

const ASYNC_STORAGE_KEY = 'bolt_debug';
const DIAG_COOKIE_NAME = 'bolt_debug';

// --- Ring Buffer -----------------------------------------------------------

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
}

const RING_BUFFER_MAX = 500;
let _ringBuffer: LogEntry[] = [];

export function getLogBuffer(): ReadonlyArray<LogEntry> {
  return _ringBuffer;
}

export function clearLogBuffer(): void {
  _ringBuffer = [];
}

function pushToBuffer(entry: LogEntry): void {
  if (_ringBuffer.length >= RING_BUFFER_MAX) {
    _ringBuffer.shift();
  }
  _ringBuffer.push(entry);
}

// --- Runtime Level ---------------------------------------------------------

let _runtimeLevel: LogLevel | null = null;
let _initialized = false;

/**
 * Reads the persisted runtime log level from AsyncStorage.
 * Must be called at app startup before first render completes.
 */
export async function initLogger(): Promise<void> {
  if (_initialized) return;
  try {
    const stored = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
    if (stored) {
      if (stored === '1') {
        _runtimeLevel = 'debug';
      } else if (VALID_LEVELS.has(stored)) {
        _runtimeLevel = stored as LogLevel;
      }
    }
  } catch (_) {
    // AsyncStorage unavailable — fall through to env/cookie
  }

  // On web, also check cookie as secondary source
  if (!_runtimeLevel && Platform.OS === 'web') {
    _runtimeLevel = getCookieLevel();
  }

  _initialized = true;
}

/**
 * Changes the runtime log level and persists it to AsyncStorage.
 */
export async function setRuntimeLogLevel(level: LogLevel): Promise<void> {
  _runtimeLevel = level;
  try {
    await AsyncStorage.setItem(ASYNC_STORAGE_KEY, level);
  } catch (_) {
    // best effort
  }
}

/**
 * Clears the runtime override, reverting to the env-var default.
 */
export async function clearRuntimeLogLevel(): Promise<void> {
  _runtimeLevel = null;
  try {
    await AsyncStorage.removeItem(ASYNC_STORAGE_KEY);
  } catch (_) {
    // best effort
  }
}

/**
 * Returns the currently active log level (runtime override or env default).
 */
export function getEffectiveLevel(): LogLevel {
  return _runtimeLevel ?? GLOBAL_LEVEL;
}

/**
 * Returns the env-var configured level (ignoring runtime override).
 */
export function getDefaultLevel(): LogLevel {
  return GLOBAL_LEVEL;
}

// --- Cookie (web only, legacy) ---------------------------------------------

function readCookieValue(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').find(
    (c) => c.trim().startsWith(`${DIAG_COOKIE_NAME}=`)
  );
  if (!match) return null;
  const val = match.trim().split('=')[1];
  return val || null;
}

function getCookieLevel(): LogLevel | null {
  const val = readCookieValue();
  if (!val) return null;
  if (val === '1') return 'debug';
  if (VALID_LEVELS.has(val)) return val as LogLevel;
  return null;
}

// --- shouldLog -------------------------------------------------------------

export function shouldLog(level: LogLevel): boolean {
  if (level === 'error') return true;
  const effective = getEffectiveLevel();
  if (!GLOBAL_ENABLED && !_runtimeLevel) return false;
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[effective];
}

// --- Sensitive data masking ------------------------------------------------

const SENSITIVE_PATTERNS = ['_API_KEY', '_SECRET', '_ANON_KEY', '_TOKEN', 'PASSWORD'];

export function isSensitiveKey(key: string): boolean {
  const upper = key.toUpperCase();
  return SENSITIVE_PATTERNS.some((p) => upper.includes(p));
}

export function redactIfSensitive(key: string, value: string | undefined): string {
  if (value == null || value === '') return String(value);
  if (isSensitiveKey(key)) {
    return value.length > 4 ? value.substring(0, 4) + '****' : '****';
  }
  return value;
}

// --- Logger interface ------------------------------------------------------

export interface Logger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  trace: (...args: unknown[]) => void;
}

export function createLogger(module: string): Logger {
  const prefix = `[${module}]`;

  function record(level: LogLevel, args: unknown[]): void {
    const message = args.map((a) =>
      typeof a === 'string' ? a : JSON.stringify(a)
    ).join(' ');
    pushToBuffer({ timestamp: Date.now(), level, module, message });
  }

  return {
    error: (...args: unknown[]) => {
      record('error', args);
      console.error(prefix, ...args);
    },

    warn: (...args: unknown[]) => {
      record('warn', args);
      if (shouldLog('warn')) {
        console.warn(prefix, ...args);
      }
    },

    info: (...args: unknown[]) => {
      record('info', args);
      if (shouldLog('info')) {
        console.log(prefix, ...args);
      }
    },

    debug: (...args: unknown[]) => {
      record('debug', args);
      if (shouldLog('debug')) {
        console.log(prefix, ...args);
      }
    },

    trace: (...args: unknown[]) => {
      record('trace', args);
      if (shouldLog('trace')) {
        console.log(prefix, ...args);
      }
    },
  };
}

// --- Diagnostics (web legacy, preserved) -----------------------------------

export function dumpLoggerDiagnostics(): void {
  if (typeof document === 'undefined') return;
  const cookieVal = readCookieValue();
  if (!cookieVal) return;

  const sep = '========================================';

  console.log(`\n${sep}`);
  console.log('[BOLT-LOGGER-DIAG] Logger Diagnostics');
  console.log(`${sep}\n`);

  console.log('[BOLT-LOGGER-DIAG] Core Configuration:');
  console.log(
    `  EXPO_PUBLIC_LOG_ENABLED  raw="${process.env.EXPO_PUBLIC_LOG_ENABLED}"  resolved=${GLOBAL_ENABLED}`
  );
  console.log(
    `  EXPO_PUBLIC_LOG_LEVEL    raw="${process.env.EXPO_PUBLIC_LOG_LEVEL}"  resolved="${GLOBAL_LEVEL}"`
  );
  console.log(
    `  bolt_debug cookie        value="${cookieVal}"  resolved_level="${getCookieLevel() ?? 'N/A'}"`
  );
  console.log(
    `  Effective log level      "${getEffectiveLevel()}"`
  );

  const ENV_SNAPSHOT: Record<string, { category: string; value: string | undefined }> = {
    EXPO_PUBLIC_SUPABASE_URL: { category: 'Supabase', value: process.env.EXPO_PUBLIC_SUPABASE_URL },
    EXPO_PUBLIC_SUPABASE_ANON_KEY: { category: 'Supabase', value: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY },
    EXPO_PUBLIC_SERVICE_SLUG: { category: 'Tenant', value: process.env.EXPO_PUBLIC_SERVICE_SLUG },
    EXPO_PUBLIC_SMART_USER_APP_ID: { category: 'SmartUser', value: process.env.EXPO_PUBLIC_SMART_USER_APP_ID },
    EXPO_PUBLIC_SMART_USER_APP_SECRET: { category: 'SmartUser', value: process.env.EXPO_PUBLIC_SMART_USER_APP_SECRET },
    EXPO_PUBLIC_SMART_USER_DISTRIBUTION_GROUP: { category: 'SmartUser', value: process.env.EXPO_PUBLIC_SMART_USER_DISTRIBUTION_GROUP },
    EXPO_PUBLIC_SMART_USER_COUNTRY: { category: 'SmartUser', value: process.env.EXPO_PUBLIC_SMART_USER_COUNTRY },
    EXPO_PUBLIC_SMART_USER_ENV: { category: 'SmartUser', value: process.env.EXPO_PUBLIC_SMART_USER_ENV },
    EXPO_PUBLIC_RELEVANCE_AI_API_KEY: { category: 'Relevance AI', value: process.env.EXPO_PUBLIC_RELEVANCE_AI_API_KEY },
    EXPO_PUBLIC_RELEVANCE_PROJECT_ID: { category: 'Relevance AI', value: process.env.EXPO_PUBLIC_RELEVANCE_PROJECT_ID },
    EXPO_PUBLIC_RELEVANCE_BASE_URL: { category: 'Relevance AI', value: process.env.EXPO_PUBLIC_RELEVANCE_BASE_URL },
    EXPO_PUBLIC_COMPETITION_BASE_DOMAIN: { category: 'Gamification', value: process.env.EXPO_PUBLIC_COMPETITION_BASE_DOMAIN },
    EXPO_PUBLIC_LOG_ENABLED: { category: 'Logging', value: process.env.EXPO_PUBLIC_LOG_ENABLED },
    EXPO_PUBLIC_LOG_LEVEL: { category: 'Logging', value: process.env.EXPO_PUBLIC_LOG_LEVEL },
  };

  console.log('\n[BOLT-LOGGER-DIAG] Environment Variables:');
  const envTable = Object.entries(ENV_SNAPSHOT).map(([key, { category, value }]) => {
    const status = value == null || value === '' ? 'NOT SET' : 'SET';
    return { Category: category, Variable: key, Status: status, Value: redactIfSensitive(key, value) };
  });
  console.table(envTable);

  console.log('\n[BOLT-LOGGER-DIAG] Console Output Verification:');
  console.log('[BOLT-DIAG-TEST] console.log   -- if you see this, console.log works');
  console.info('[BOLT-DIAG-TEST] console.info  -- if you see this, console.info works');
  console.warn('[BOLT-DIAG-TEST] console.warn  -- if you see this, console.warn works');
  console.error('[BOLT-DIAG-TEST] console.error -- if you see this, console.error works');
  console.log('If any of the above lines are missing, a production monitoring tool or browser extension is suppressing that console method.');

  console.log(`\n${sep}`);
  console.log('[BOLT-LOGGER-DIAG] End of Diagnostics');
  console.log(`${sep}\n`);
}
