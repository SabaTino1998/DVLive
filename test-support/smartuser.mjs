import { createHmac, randomFillSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { formatWithOptions } from 'node:util';

// SmartUser setup and login, with process-local storage for CLI tests.
export async function getSmartUserToken(config, loadSdk = () => import('@digitalvirgo/su-bolt-react')) {
  for (const key of ['applicationId', 'applicationSecret', 'username', 'password']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) {
      throw new Error(`Missing SmartUser configuration: ${key}`);
    }
  }
  if (!['STAG', 'PROD'].includes(config.env)) throw new Error('SmartUser env must be STAG or PROD');

  if (config.signup && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.username)) {
    throw new Error('SmartUser signup username must be an email address');
  }

  const { SmartUserRN } = await loadSdk();
  const values = new Map();
  const storage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
    async clear() { values.clear(); },
    async getAllKeys() { return [...values.keys()]; },
    async multiGet(keys) { return keys.map(key => [key, values.get(key) ?? null]); },
    async multiSet(entries) { for (const [key, value] of entries) values.set(key, value); },
    async multiRemove(keys) { for (const key of keys) values.delete(key); },
  };
  const instance = SmartUserRN.getInstance({
    applicationId: config.applicationId,
    AsyncStorage: storage,
    Platform: { OS: 'web' },
    Dimensions: { get: () => ({ width: 1280, height: 720 }) },
    getHmac: async (message, secret) => createHmac('sha1', secret).update(message).digest('hex'),
    getRandomValues: length => randomFillSync(new Uint16Array(length)),
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }),
    debug: config.debug === true,
  });
  try {
    if (config.debug) console.info('[smoke] setup', { applicationId: config.applicationId, env: config.env, secretLength: config.applicationSecret.length });
    await instance.setup(config.applicationSecret, {
      env: config.env,
    });
    if (config.signup) {
      if (config.debug) console.info('[smoke] signupWithEmail');
      await instance.signupWithEmail(config.username, config.password);
    }
    if (config.debug) console.info('[smoke] loginWithEmail');
    await instance.loginWithEmail(config.username, config.password);
    const token = instance.getUserToken();
    if (typeof token !== 'string' || !/^N_\S+$/.test(token)) {
      throw new Error('SmartUser did not return an N_ session token');
    }
    return token;
  } finally {
    instance.deps.event.clearTimers();
    instance._stopContextBearerRefreshTimer();
    SmartUserRN.resetInstance();
    values.clear();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // SDK logs go to stderr, so shell command substitution captures only N_ token.
  const output = process.stdout.write.bind(process.stdout);
  let config;
  for (const method of ['log', 'debug', 'info', 'warn', 'error']) {
    console[method] = (...args) => {
      if (config?.debug) process.stderr.write(formatWithOptions({ depth: 6, colors: false }, ...args) + '\n');
    };
  }
  try {
    const input = readFileSync(0, 'utf8');
    const keys = ['applicationId', 'applicationSecret', 'env', 'username', 'password'];
    config = process.argv.includes('--stdin-fields')
      ? Object.fromEntries(keys.map((key, index) => [key, input.split('\0')[index]]))
      : JSON.parse(input);
    config.debug = process.argv.includes('--debug');
    const token = await getSmartUserToken({ ...config, signup: process.argv.includes('--signup') });
    await new Promise(resolve => output(`${token}\n`, resolve));
    process.exit(0);
  } catch (error) {
    process.stderr.write(formatWithOptions({ depth: 6, colors: false }, 'FAIL: SmartUser:', error) + '\n');
    process.exit(1);
  }
}
