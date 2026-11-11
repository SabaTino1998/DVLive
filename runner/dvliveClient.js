/**
 * Minimal DV Live web show engine API client.
 *
 * OpenAPI: openapi.json (DVLive web show engine — votes, participants).
 * Authentication: Bearer apiToken in both modes; PROD optional X-Internal-Auth.
 */

class DvliveError extends Error {
  constructor(
    message,
    { statusCode, statusText, errorCode, body, method, url } = {},
  ) {
    super(message);
    this.name = 'DvliveError';
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.errorCode = errorCode;
    this.body = body;
    this.method = method;
    this.url = url;
  }
}

class DvliveForbiddenError extends DvliveError {
  constructor(message, opts) {
    super(message, opts);
    this.name = 'DvliveForbiddenError';
  }
}

class DvliveRateLimitError extends DvliveError {
  constructor(message, opts) {
    super(message, opts);
    this.name = 'DvliveRateLimitError';
    this.retryAfter = opts?.retryAfter;
  }
}

class DvliveAuthError extends DvliveError {
  constructor(message, opts) {
    super(message, opts);
    this.name = 'DvliveAuthError';
  }
}

class DvliveNotFoundError extends DvliveError {
  constructor(message, opts) {
    super(message, opts);
    this.name = 'DvliveNotFoundError';
  }
}

class DvliveConflictError extends DvliveError {
  constructor(message, opts) {
    super(message, opts);
    this.name = 'DvliveConflictError';
  }
}

class DvliveValidationError extends DvliveError {
  constructor(message, opts) {
    super(message, opts);
    this.name = 'DvliveValidationError';
  }
}

const BASE_URLS = Object.freeze({
  DEV: 'https://dev-webshow-engine.dv-live.com',
  STAG: 'https://stag-webshow-engine.dv-live.com',
  PROD: 'https://webshow-engine.dv-live.com',
});

const INTERNAL_BASE_URLS = Object.freeze({
  DEV: 'https://int-dev-webshow-engine.dv-live.com',
  STAG: 'https://int-stag-webshow-engine.dv-live.com',
  PROD: 'https://int-webshow-engine.dv-live.com',
});

class DvliveClient {
  constructor({ environment, mode = 'PROD', apiToken, albToken } = {}) {
    if (mode !== 'INT' && mode !== 'PROD') {
      throw new Error('DvliveClient: mode must be INT or PROD');
    }
    if (!Object.hasOwn(BASE_URLS, environment)) {
      throw new Error('DvliveClient: environment must be DEV, STAG or PROD');
    }
    if (typeof apiToken !== 'string' || !apiToken.trim()) {
      throw new Error('DvliveClient: DVLIVE_API_TOKEN is required');
    }
    this.apiToken = apiToken.trim();
    this.mode = mode;
    this.baseUrl = (mode === 'INT' ? INTERNAL_BASE_URLS : BASE_URLS)[environment];
    this.albToken = mode === 'INT' ? undefined : albToken?.trim() || undefined;

    this.showVoteChoices = {
      get: (uuid) => {
        if (!uuid) throw new Error('showVoteChoices.get: uuid is required');
        return this.request('GET', `/show-vote-choice/${encodeURIComponent(uuid)}`);
      },
    };

    this.showVotes = {
      get: (uuid) => {
        if (!uuid) throw new Error('showVotes.get: uuid is required');
        return this.request('GET', `/show-vote/${encodeURIComponent(uuid)}`);
      },
    };

    this.voters = {
      create: (showVoteUuid, body) => {
        if (!showVoteUuid) throw new Error('voters.create: showVoteUuid is required');
        return this.request(
          'POST',
          `/show-vote/${encodeURIComponent(showVoteUuid)}/voter`,
          { body: body ?? {} },
        );
      },

      get: (showVoteUuid, userRef) => {
        if (!showVoteUuid) throw new Error('voters.get: showVoteUuid is required');
        if (!userRef) throw new Error('voters.get: userRef is required');
        return this.request(
          'GET',
          `/show-vote/${encodeURIComponent(showVoteUuid)}/voter/${encodeURIComponent(userRef)}`,
        );
      },

      castVote: (showVoteUuid, uniqRef, body) => {
        if (!showVoteUuid) throw new Error('voters.castVote: showVoteUuid is required');
        if (!uniqRef) throw new Error('voters.castVote: uniqRef is required');
        return this.request(
          'POST',
          `/show-vote/${encodeURIComponent(showVoteUuid)}/voter/${encodeURIComponent(uniqRef)}/vote`,
          { body: body ?? {} },
        );
      },
    };
  }

  async request(method, path, { query, body, headers } = {}) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const extraHeaders = Object.fromEntries(
      Object.entries(headers ?? {}).filter(([name]) =>
        !['authorization', 'x-internal-auth'].includes(name.toLowerCase())),
    );
    const reqHeaders = {
      ...extraHeaders,
      Accept: 'application/json',
      Authorization: `Bearer ${this.apiToken}`,
      ...(this.albToken ? { 'X-Internal-Auth': this.albToken } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    };

    const urlStr = url.toString();
    const requestBody = body !== undefined ? JSON.stringify(body) : undefined;
    const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
    const curl = ['curl', '-X', shellQuote(method), shellQuote(urlStr)];
    for (const [name, value] of Object.entries(reqHeaders)) {
      curl.push('-H', shellQuote(`${name}: ${value}`));
    }
    if (requestBody !== undefined) {
      curl.push('--data-raw', shellQuote(requestBody));
    }
    console.log(`  ${method} ${urlStr}`);
    console.log(curl.join(' '));
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: requestBody,
      });
    } catch (err) {
      throw new DvliveError(`Network error: ${err.message}`, {
        method,
        url: urlStr,
      });
    }

    const text = await res.text();
    let parsed = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        /* keep raw text */
      }
    } else {
      parsed = null;
    }

    if (!res.ok) {
      const apiMsg =
        parsed && typeof parsed === 'object' && parsed.message
          ? parsed.message
          : null;
      const apiCode =
        parsed && typeof parsed === 'object' && parsed.code != null
          ? parsed.code
          : undefined;
      const errMsg = apiMsg
        ? `HTTP ${res.status} ${res.statusText}: ${apiMsg}`
        : `HTTP ${res.status} ${res.statusText}`;
      const opts = {
        statusCode: res.status,
        statusText: res.statusText,
        errorCode: apiCode,
        body: parsed,
        method,
        url: urlStr,
      };

      if (res.status === 401) throw new DvliveAuthError(errMsg, opts);
      if (res.status === 403) throw new DvliveForbiddenError(errMsg, opts);
      if (res.status === 404) throw new DvliveNotFoundError(errMsg, opts);
      if (res.status === 409) throw new DvliveConflictError(errMsg, opts);
      if (res.status === 422) throw new DvliveValidationError(errMsg, opts);
      if (res.status === 429) {
        throw new DvliveRateLimitError(errMsg, {
          ...opts,
          retryAfter: res.headers.get('retry-after'),
        });
      }
      throw new DvliveError(errMsg, opts);
    }

    return parsed;
  }
}

module.exports = {
  DvliveClient,
  DvliveError,
  DvliveAuthError,
  DvliveForbiddenError,
  DvliveNotFoundError,
  DvliveConflictError,
  DvliveValidationError,
  DvliveRateLimitError,
};
