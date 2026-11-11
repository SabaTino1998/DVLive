/**
 * DV Live web show engine — reference runner.
 *
 * Reads ./config.json, builds a DvliveClient and dispatches one action.
 *
 * Usage:
 *   npm run help
 *   npm run getShowVote
 *   node run.js createVoter
 */

const fs = require('fs');
const path = require('path');

const {
  DvliveClient,
  DvliveAuthError,
  DvliveForbiddenError,
  DvliveNotFoundError,
  DvliveConflictError,
  DvliveValidationError,
  DvliveRateLimitError,
  DvliveError,
} = require('./dvliveClient');

const ACTION_REGISTRY = {
  getShowVoteChoice: {
    group: 'showVote',
    http: 'GET /show-vote-choice/{uuid}',
    client: 'client.showVoteChoices.get(uuid)',
    config: ['showVoteChoice.uuid'],
    optional: [],
    summary: 'Get a show vote choice (participant) by UUID',
  },
  getShowVote: {
    group: 'showVote',
    http: 'GET /show-vote/{uuid}',
    client: 'client.showVotes.get(uuid)',
    config: ['showVote.uuid'],
    optional: [],
    summary: 'Get show vote metadata and current round',
  },
  createVoter: {
    group: 'voter',
    http: 'POST /show-vote/{uuid}/voter',
    client: 'client.voters.create(showVoteUuid, body)',
    config: ['createVoter.showVoteUuid'],
    optional: ['createVoter.email', 'createVoter.phone', 'createVoter.uniqRef'],
    summary: 'Register a voter for a show vote',
  },
  getVoter: {
    group: 'voter',
    http: 'GET /show-vote/{uuid}/voter/{userRef}',
    client: 'client.voters.get(showVoteUuid, userRef)',
    config: ['getVoter.showVoteUuid', 'getVoter.userRef'],
    optional: [],
    summary: 'Get voter balance and fraud status',
  },
  castVote: {
    group: 'voter',
    http: 'POST /show-vote/{uuid}/voter/{uniqRef}/vote',
    client: 'client.voters.castVote(showVoteUuid, uniqRef, body)',
    config: ['castVote.showVoteUuid', 'castVote.userRef', 'castVote.votes'],
    optional: [
      'castVote.sessionToken',
      'castVote.phoneFingerPrint',
      'castVote.ip',
      'castVote.userAgent',
      'castVote.uniqSubscriptionId',
    ],
    summary: 'Cast votes for one or more choices in the current round',
  },
};

const VALID_ACTIONS = Object.keys(ACTION_REGISTRY);

const GROUP_LABELS = {
  showVote: 'Show vote (GET)',
  voter: 'Voter (POST/GET)',
};

function configHint(entry) {
  if (!entry.config || entry.config.length === 0) return '—';
  return entry.config.join(', ');
}

function findSimilarActions(name) {
  const lower = name.toLowerCase();
  return VALID_ACTIONS.filter(
    (a) =>
      a.toLowerCase().includes(lower) ||
      lower.includes(a.toLowerCase()) ||
      a.toLowerCase().startsWith(lower.slice(0, 3)),
  ).slice(0, 5);
}

function printHelpSummary() {
  console.log('DV Live web show engine — reference runner\n');
  console.log('Usage:');
  console.log('  npm run <action>          run one API call using config.json');
  console.log('  npm run help              this summary');
  console.log('  npm run help -- <action>  detail for one action\n');

  for (const [group, label] of Object.entries(GROUP_LABELS)) {
    console.log(`${label}:`);
    for (const name of VALID_ACTIONS) {
      const entry = ACTION_REGISTRY[name];
      if (entry.group !== group) continue;
      const http =
        entry.http.length > 44 ? entry.http.slice(0, 41) + '...' : entry.http;
      console.log(
        `  ${name.padEnd(22)} ${http.padEnd(44)} ${configHint(entry)}`,
      );
    }
    console.log('');
  }

  console.log(
    `${VALID_ACTIONS.length} actions total. See README.md for full config reference.`,
  );
}

function printHelpDetail(name) {
  const entry = ACTION_REGISTRY[name];
  console.log(`Action:  ${name}`);
  console.log(`Summary: ${entry.summary}`);
  console.log(`HTTP:    ${entry.http}`);
  console.log(`Client:  ${entry.client}`);
  console.log('\nRequired config:');
  if (entry.config.length === 0) {
    console.log('  (none beyond DVLIVE_MODE, DVLIVE_ENV and DVLIVE_API_TOKEN and optional PROD ALB token)');
  } else {
    for (const key of entry.config) console.log(`  ${key}`);
  }
  if (entry.optional.length > 0) {
    console.log('\nOptional config:');
    for (const key of entry.optional) console.log(`  ${key}`);
  }
  console.log('\nRun:');
  console.log(`  npm run ${name}`);
  console.log(`  node run.js ${name}`);
}

function isHelpArg(arg) {
  return arg === 'help' || arg === '--help' || arg === '-h';
}

function handleHelp() {
  const arg = process.argv[2];
  const topic = process.argv[3];

  if (!isHelpArg(arg) && arg !== 'help') return false;

  if (arg === 'help' && topic) {
    if (!ACTION_REGISTRY[topic]) {
      const similar = findSimilarActions(topic);
      console.error(`Unknown action "${topic}".`);
      if (similar.length) {
        console.error(`Did you mean: ${similar.join(', ')}?`);
      }
      console.error('Run "npm run help" for the full list.');
      process.exit(1);
    }
    printHelpDetail(topic);
    return true;
  }

  printHelpSummary();
  return true;
}

function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `config.json not found at ${configPath}. ` +
        `Copy config.example.json to config.json and fill it in.`,
    );
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    throw new Error(`config.json is not valid JSON: ${err.message}`);
  }
  cfg.DVLIVE_MODE = (process.env.DVLIVE_MODE ?? cfg.DVLIVE_MODE ?? 'PROD').trim();
  if (!['INT', 'PROD'].includes(cfg.DVLIVE_MODE)) {
    throw new Error('config.DVLIVE_MODE must be INT or PROD');
  }
  cfg.DVLIVE_ENV = (process.env.DVLIVE_ENV ?? cfg.DVLIVE_ENV)?.trim();
  if (!['DEV', 'STAG', 'PROD'].includes(cfg.DVLIVE_ENV)) {
    throw new Error('config.DVLIVE_ENV must be DEV, STAG or PROD');
  }
  cfg.DVLIVE_API_TOKEN = (process.env.DVLIVE_API_TOKEN ?? cfg.DVLIVE_API_TOKEN)?.trim();
  if (!cfg.DVLIVE_API_TOKEN) {
    throw new Error('config.DVLIVE_API_TOKEN is required');
  }
  return cfg;
}

function resolveAction(cfg) {
  const fromCli = process.argv[2];
  const action = fromCli || cfg.action;
  if (!action) {
    throw new Error(
      `No action specified. Set config.action or pass one as a CLI arg. ` +
        `Run "npm run help" for the list.`,
    );
  }
  if (!VALID_ACTIONS.includes(action)) {
    const similar = findSimilarActions(action);
    let msg = `Invalid action "${action}". Run "npm run help" for the list.`;
    if (similar.length) msg += ` Did you mean: ${similar.join(', ')}?`;
    throw new Error(msg);
  }
  return action;
}

function require_(obj, keys, scope) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === null || v === undefined || v === '') {
      throw new Error(`Missing required field "${scope}.${k}" in config.json`);
    }
  }
}

/** Build JSON body for POST actions: copy section minus path params. */
function voterRequestBody(section, pathKeys = ['showVoteUuid', 'userRef']) {
  if (!section || typeof section !== 'object') return {};
  const body = { ...section };
  for (const k of pathKeys) delete body[k];
  return body;
}

function printHeader(call, args) {
  const argsStr = args === undefined ? '' : JSON.stringify(args);
  console.log('────────────────────────────────────────────────────────');
  console.log(`→ client.${call}(${argsStr})`);
  console.log('────────────────────────────────────────────────────────');
}

function printPayloadTable(rows, columns) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  console.log('\nSummary:');
  for (const item of rows) {
    const row = columns
      .map((c) => `${c}=${JSON.stringify(item[c])}`)
      .join('  ');
    console.log(`  • ${row}`);
  }
}

function printNbVoteRemaining(res) {
  if (res && typeof res.nbVoteRemaining === 'number') {
    console.log(`\nVotes remaining: ${res.nbVoteRemaining}`);
  }
}

async function runGetShowVoteChoice(client, cfg) {
  require_(cfg.showVoteChoice, ['uuid'], 'showVoteChoice');
  const { uuid } = cfg.showVoteChoice;
  printHeader('showVoteChoices.get', { uuid });
  const res = await client.showVoteChoices.get(uuid);
  console.log(JSON.stringify(res, null, 2));
  printPayloadTable(
    [
      {
        uuid: res?.uuid,
        firstname: res?.firstname,
        lastname: res?.lastname,
        status: res?.status,
        order: res?.order,
      },
    ],
    ['uuid', 'firstname', 'lastname', 'status', 'order'],
  );
  return res;
}

async function runGetShowVote(client, cfg) {
  require_(cfg.showVote, ['uuid'], 'showVote');
  const { uuid } = cfg.showVote;
  printHeader('showVotes.get', { uuid });
  const res = await client.showVotes.get(uuid);
  console.log(JSON.stringify(res, null, 2));
  printPayloadTable(
    (res?.round?.choices || []).map((c) => ({
      uuid: c.uuid,
      firstname: c.firstname,
      lastname: c.lastname,
    })),
    ['uuid', 'firstname', 'lastname'],
  );
  return res;
}

async function runCreateVoter(client, cfg) {
  require_(cfg.createVoter, ['showVoteUuid'], 'createVoter');
  const { showVoteUuid } = cfg.createVoter;
  const body = voterRequestBody(cfg.createVoter, ['showVoteUuid']);
  printHeader('voters.create', { showVoteUuid, body });
  const res = await client.voters.create(showVoteUuid, body);
  console.log(JSON.stringify(res, null, 2));
  return res;
}

async function runGetVoter(client, cfg) {
  require_(cfg.getVoter, ['showVoteUuid', 'userRef'], 'getVoter');
  const { showVoteUuid, userRef } = cfg.getVoter;
  printHeader('voters.get', { showVoteUuid, userRef });
  const res = await client.voters.get(showVoteUuid, userRef);
  console.log(JSON.stringify(res, null, 2));
  if (res?.remainingPoints != null) {
    console.log(`\nRemaining points: ${res.remainingPoints}`);
  }
  return res;
}

async function runCastVote(client, cfg) {
  require_(cfg.castVote, ['showVoteUuid', 'userRef', 'votes'], 'castVote');
  const { showVoteUuid, userRef } = cfg.castVote;
  const body = voterRequestBody(cfg.castVote);
  printHeader('voters.castVote', { showVoteUuid, uniqRef: userRef, body });
  const res = await client.voters.castVote(showVoteUuid, userRef, body);
  console.log(JSON.stringify(res, null, 2));
  printNbVoteRemaining(res);
  return res;
}

function describeDvliveError(err) {
  if (err instanceof DvliveAuthError) return 'Auth error';
  if (err instanceof DvliveForbiddenError) return 'Forbidden';
  if (err instanceof DvliveNotFoundError) return 'Not found';
  if (err instanceof DvliveConflictError) return 'Conflict';
  if (err instanceof DvliveValidationError) return 'Validation error';
  if (err instanceof DvliveRateLimitError) return 'Rate limited';
  return 'Dvlive error';
}

function reportError(err) {
  if (err instanceof DvliveError) {
    const label = describeDvliveError(err);
    const status =
      err.statusCode != null
        ? `${err.statusCode}${err.statusText ? ` ${err.statusText}` : ''}`
        : '(no response)';

    console.error(`\n✖ ${label}`);
    console.error('  --- debug ---');
    console.error(`  status     : ${status}`);
    if (err.method && err.url) {
      console.error(`  request    : ${err.method} ${err.url}`);
    }
    console.error(`  message    : ${err.message}`);
    if (err.errorCode !== undefined && err.errorCode !== null) {
      console.error(`  errorCode  : ${err.errorCode}`);
    }
    if (err instanceof DvliveRateLimitError && err.retryAfter) {
      console.error(`  retryAfter : ${err.retryAfter}`);
    }
    if (err.body !== undefined && err.body !== null) {
      const bodyStr =
        typeof err.body === 'string'
          ? err.body
          : JSON.stringify(err.body, null, 2);
      console.error(`  body       : ${bodyStr}`);
    }
    if (err instanceof DvliveAuthError) {
      console.error('  → Check DVLIVE_API_TOKEN, DVLIVE_MODE and, in PROD mode, DVLIVE_ALB_TOKEN_<environment> in config.json or the environment.');
    }
    if (
      err instanceof DvliveConflictError &&
      err.body &&
      typeof err.body.nbVoteRemaining === 'number'
    ) {
      console.error(`  nbVoteRemaining: ${err.body.nbVoteRemaining}`);
    }
    return;
  }

  if (err && err.message && err.message.startsWith('Missing required field')) {
    console.error(`\n✖ Config error: ${err.message}`);
    return;
  }

  console.error(`\n✖ Unexpected error: ${err.message}`);
  if (err.stack) console.error(err.stack);
}

async function main() {
  if (handleHelp()) return;

  const cfg = loadConfig();
  const action = resolveAction(cfg);

  const tokenKey = `DVLIVE_ALB_TOKEN_${cfg.DVLIVE_ENV}`;
  const albToken = cfg.DVLIVE_MODE === 'INT'
    ? undefined
    : (process.env[tokenKey] ?? cfg[tokenKey])?.trim() || undefined;
  const client = new DvliveClient({ environment: cfg.DVLIVE_ENV, mode: cfg.DVLIVE_MODE, apiToken: cfg.DVLIVE_API_TOKEN, albToken });

  console.log('DV Live web show engine — reference runner');
  console.log(`  mode    : ${cfg.DVLIVE_MODE}`);
  console.log(`  baseUrl : ${client.baseUrl}`);
  console.log(
    `  auth    : Bearer (token set)${albToken ? ' + X-Internal-Auth (token set)' : ''}`,
  );
  console.log(`  action  : ${action}`);
  console.log('');

  switch (action) {
    case 'getShowVoteChoice':
      await runGetShowVoteChoice(client, cfg);
      break;
    case 'getShowVote':
      await runGetShowVote(client, cfg);
      break;
    case 'createVoter':
      await runCreateVoter(client, cfg);
      break;
    case 'getVoter':
      await runGetVoter(client, cfg);
      break;
    case 'castVote':
      await runCastVote(client, cfg);
      break;
  }
}

main().catch((err) => {
  reportError(err);
  process.exit(1);
});
