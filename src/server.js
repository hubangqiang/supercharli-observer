const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 4100);
const DB_PATH = process.env.SUPERCHARLI_DB_PATH || path.join(os.homedir(), 'supercharli-runtime', 'data', 'supercharli.db');
const LEARNING_SCOPE = process.env.SUPERCHARLI_LEARNING_SCOPE || 'daemon-main';
const SELF_SCOPE = process.env.SUPERCHARLI_SELF_SCOPE || 'daemon-main';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function openDb() {
  if (!fs.existsSync(DB_PATH)) return null;
  return new DatabaseSync(DB_PATH, { readonly: true });
}

function tableExists(db, tableName) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName);
  return Boolean(row && row.name === tableName);
}

function safeAll(db, sql, params = []) {
  try {
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

function safeGet(db, sql, params = []) {
  try {
    return db.prepare(sql).get(...params);
  } catch {
    return null;
  }
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readMemory(db) {
  const l1 = tableExists(db, 'l1_events')
    ? safeAll(
        db,
        `SELECT session_id AS sessionId, text, severity, trace_id AS traceId, created_at AS createdAt
         FROM l1_events
         ORDER BY id DESC
         LIMIT 20`,
      )
    : [];

  const l2 = tableExists(db, 'l2_patterns')
    ? safeAll(
        db,
        `SELECT key, summary, strategy, updated_at AS updatedAt,
                strength, confidence, recall_count AS recallCount,
                last_recalled_at AS lastRecalledAt, source
         FROM l2_patterns
         ORDER BY updated_at DESC
         LIMIT 20`,
      )
    : [];

  const l3 = tableExists(db, 'l3_timeline')
    ? safeAll(
        db,
        `SELECT phase, event_summary AS eventSummary, lesson, confidence, created_at AS createdAt
         FROM l3_timeline
         ORDER BY created_at DESC
         LIMIT 20`,
      )
    : [];

  const l4Rows = tableExists(db, 'l4_identity')
    ? safeAll(
        db,
        `SELECT key, value, updated_at AS updatedAt FROM l4_identity ORDER BY key ASC`,
      )
    : [];

  const l4 = l4Rows.map((row) => ({
    key: row.key,
    value: parseJson(row.value, row.value),
    updatedAt: row.updatedAt,
  }));

  return {
    l1,
    l2,
    l3,
    l4,
    counts: {
      l1: l1.length,
      l2: l2.length,
      l3: l3.length,
      l4: l4.length,
    },
  };
}

function readLearning(db) {
  const events = tableExists(db, 'learning_events')
    ? safeAll(
        db,
        `SELECT ts, severity, route, pattern_key AS patternKey, outcome,
                should_learn AS shouldLearn, fallback_used AS fallbackUsed, text
         FROM learning_events
         WHERE scope = ?
         ORDER BY id DESC
         LIMIT 60`,
        [LEARNING_SCOPE],
      ).map((row) => ({
        ...row,
        shouldLearn: Boolean(row.shouldLearn),
        fallbackUsed: Boolean(row.fallbackUsed),
      }))
    : [];

  const total = events.length;
  const success = events.filter((x) => x.outcome === 'success').length;
  const failure = events.filter((x) => x.outcome === 'failure').length;
  const repeated = events.filter((x) => x.patternKey && x.patternKey !== 'general-execution-pattern').length;

  const state = tableExists(db, 'learning_state')
    ? safeGet(
        db,
        `SELECT stage, stats_json AS statsJson, policy_json AS policyJson, updated_at AS updatedAt
         FROM learning_state
         WHERE scope = ?`,
        [LEARNING_SCOPE],
      )
    : null;

  const candidates = tableExists(db, 'learning_candidates')
    ? safeAll(
        db,
        `SELECT id, created_at AS createdAt, event_json AS eventJson, gate_json AS gateJson, proposed_policy_json AS proposedPolicyJson, status
         FROM learning_candidates
         WHERE scope = ?
         ORDER BY id DESC
         LIMIT 20`,
        [LEARNING_SCOPE],
      ).map((row) => ({
        ...row,
        event: parseJson(row.eventJson, {}),
        gate: parseJson(row.gateJson, {}),
        proposedPolicy: parseJson(row.proposedPolicyJson, {}),
      }))
    : [];

  const policyVersion = tableExists(db, 'learning_policy_versions')
    ? safeGet(
        db,
        `SELECT version, created_at AS createdAt, note
         FROM learning_policy_versions
         WHERE scope = ?
         ORDER BY version DESC
         LIMIT 1`,
        [LEARNING_SCOPE],
      )
    : null;

  const rollout = tableExists(db, 'learning_rollout_state')
    ? safeGet(
        db,
        `SELECT enabled, ratio, version, updated_at AS updatedAt, note
         FROM learning_rollout_state
         WHERE scope = ?`,
        [LEARNING_SCOPE],
      )
    : null;

  return {
    events,
    metrics: {
      total,
      success,
      failure,
      repeated,
      successRate: total ? Number((success / total).toFixed(3)) : 0,
      recurrenceRate: total ? Number((repeated / total).toFixed(3)) : 0,
      failureRate: total ? Number((failure / total).toFixed(3)) : 0,
    },
    stage: state
      ? {
          stage: state.stage,
          stats: parseJson(state.statsJson, {}),
          policy: parseJson(state.policyJson, {}),
          updatedAt: state.updatedAt,
        }
      : null,
    candidates,
    policyVersion,
    rollout: rollout
      ? {
          enabled: Boolean(rollout.enabled),
          ratio: Number(rollout.ratio || 0),
          version: rollout.version,
          updatedAt: rollout.updatedAt,
          note: rollout.note || '',
        }
      : { enabled: false, ratio: 0, version: null, updatedAt: null, note: '' },
  };
}

function readRuntime(db) {
  const sessionTop = tableExists(db, 'l1_events')
    ? safeAll(
        db,
        `SELECT session_id AS sessionId, COUNT(*) AS turnCount, MAX(created_at) AS lastAt
         FROM l1_events
         GROUP BY session_id
         ORDER BY lastAt DESC
         LIMIT 20`,
      )
    : [];

  const routeStats = tableExists(db, 'learning_events')
    ? safeAll(
        db,
        `SELECT route, COUNT(*) AS count
         FROM learning_events
         WHERE scope = ?
         GROUP BY route
         ORDER BY count DESC`,
        [LEARNING_SCOPE],
      )
    : [];

  const selfModel = tableExists(db, 'self_model_state')
    ? safeGet(
        db,
        `SELECT model_json AS modelJson, updated_at AS updatedAt
         FROM self_model_state
         WHERE scope = ?`,
        [SELF_SCOPE],
      )
    : null;

  const parsedSelfModel = selfModel ? parseJson(selfModel.modelJson, {}) : null;

  return {
    sessions: sessionTop,
    routeStats,
    selfModel: parsedSelfModel
      ? {
          ...parsedSelfModel,
          updatedAt: selfModel.updatedAt,
        }
      : null,
  };
}

function readSkills(db) {
  const catalog = tableExists(db, 'prompt_skill_catalog')
    ? safeAll(
        db,
        `SELECT skill_id AS skillId, latest_hash AS latestHash, latest_preview AS latestPreview,
                first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt, seen_count AS seenCount
         FROM prompt_skill_catalog
         ORDER BY last_seen_at DESC
         LIMIT 80`,
      )
    : [];

  const history = tableExists(db, 'prompt_skill_history')
    ? safeAll(
        db,
        `SELECT id, created_at AS createdAt, session_id AS sessionId, trace_id AS traceId, route,
                model_provider AS modelProvider, model_name AS modelName,
                prompt_tokens_used AS promptTokensUsed, dropped_packs AS droppedPacks,
                loaded_skill_ids_json AS loadedSkillIdsJson, loaded_skills_json AS loadedSkillsJson
         FROM prompt_skill_history
         ORDER BY id DESC
         LIMIT 120`,
      ).map((row) => ({
        ...row,
        loadedSkillIds: parseJson(row.loadedSkillIdsJson, []),
        loadedSkills: parseJson(row.loadedSkillsJson, []),
      }))
    : [];

  return {
    catalog,
    history,
    counts: {
      current: catalog.length,
      history: history.length,
    },
  };
}

function buildSummary(memory, learning, runtime, skills) {
  return {
    dbPath: DB_PATH,
    scope: LEARNING_SCOPE,
    generatedAt: new Date().toISOString(),
    memoryCounts: memory.counts,
    learningMetrics: learning.metrics,
    learningStage: learning.stage?.stage || 'unknown',
    policyVersion: learning.policyVersion?.version || null,
    rollout: learning.rollout,
    sessionCount: runtime.sessions.length,
    topSession: runtime.sessions[0] || null,
    selfAudit: runtime.selfModel?.lastAuditStatus || null,
    skillCount: skills?.counts?.current || 0,
    skillHistoryCount: skills?.counts?.history || 0,
  };
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function serveStatic(req, res, pathname) {
  const file = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(file).replace(/^\.\.(\/|\\|$)/, '');
  const absPath = path.join(PUBLIC_DIR, normalized);

  if (!absPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }

  const ext = path.extname(absPath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(absPath).pipe(res);
}

function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/observer')) {
    let db;
    try {
      db = openDb();
      if (!db) {
        return json(res, 200, {
          ok: true,
          empty: true,
          message: `Database not found at ${DB_PATH}`,
        });
      }

      const memory = readMemory(db);
      const learning = readLearning(db);
      const runtime = readRuntime(db);
      const skills = readSkills(db);
      const summary = buildSummary(memory, learning, runtime, skills);

      if (pathname === '/api/observer/summary') return json(res, 200, { ok: true, data: summary });
      if (pathname === '/api/observer/memory') return json(res, 200, { ok: true, data: memory });
      if (pathname === '/api/observer/learning') return json(res, 200, { ok: true, data: learning });
      if (pathname === '/api/observer/runtime') return json(res, 200, { ok: true, data: runtime });
      if (pathname === '/api/observer/skills') return json(res, 200, { ok: true, data: skills });
      if (pathname === '/api/observer/sessions') return json(res, 200, { ok: true, data: runtime.sessions });

      return json(res, 404, { ok: false, error: 'unknown endpoint' });
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message });
    } finally {
      if (db) db.close();
    }
  }

  return serveStatic(req, res, pathname);
}

const server = http.createServer(handler);
server.listen(PORT, () => {
  process.stdout.write(`supercharli-observer listening on http://localhost:${PORT}\n`);
  process.stdout.write(`db: ${DB_PATH}\n`);
});
