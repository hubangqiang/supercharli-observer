async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function byId(id) {
  return document.getElementById(id);
}

function kpi(label, value, hint = '', cls = '') {
  return `<div class="kpi"><div class="label">${label}</div><div class="value ${cls}">${value}</div><div class="hint">${hint}</div></div>`;
}

function fmtTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function pct(v) {
  return `${Math.round(Number(v || 0) * 100)}%`;
}

function renderRows(id, rows, cols) {
  const body = byId(id);
  if (!body) return;
  if (!rows || !rows.length) {
    body.innerHTML = `<tr><td colspan="${cols}">暂无数据</td></tr>`;
    return;
  }
  body.innerHTML = rows.join('');
}

function renderDashboard(summary, memory, learning, runtime, skills) {
  byId('metaLine').textContent = `DB: ${summary.dbPath} | Scope: ${summary.scope} | Updated: ${fmtTime(summary.generatedAt)}`;

  const stage = summary.learningStage || 'unknown';
  const failureRate = Number(summary.learningMetrics?.failureRate || 0);
  const stageClass = stage === 'autonomous' ? 'good' : stage === 'apprentice' ? 'warn' : '';
  const failClass = failureRate >= 0.4 ? 'bad' : failureRate >= 0.2 ? 'warn' : 'good';

  byId('kpis').innerHTML = [
    kpi('学习阶段', stage, 'Learning stage', stageClass),
    kpi('策略版本', summary.policyVersion ?? '-', 'policyVersion'),
    kpi('Rollout', summary.rollout?.enabled ? `ON ${pct(summary.rollout.ratio)}` : 'OFF', summary.rollout?.note || ''),
    kpi('会话数', summary.sessionCount ?? 0, 'active sessions'),
    kpi('成功率', pct(summary.learningMetrics?.successRate), `total=${summary.learningMetrics?.total || 0}`),
    kpi('失败率', pct(summary.learningMetrics?.failureRate), `repeated=${summary.learningMetrics?.repeated || 0}`, failClass),
    kpi('当前 Skill', summary.skillCount ?? 0, 'injection catalog'),
    kpi('Skill 历史', summary.skillHistoryCount ?? 0, 'injection events'),
  ].join('');

  byId('memoryLevels').innerHTML = [
    kpi('L1 会话记忆', memory.counts?.l1 ?? 0, 'recent events'),
    kpi('L2 长期记忆', memory.counts?.l2 ?? 0, 'patterns'),
    kpi('L3 里程碑', memory.counts?.l3 ?? 0, 'timeline'),
    kpi('L4 身份层', memory.counts?.l4 ?? 0, 'identity values'),
  ].join('');

  renderRows(
    'l2Rows',
    (memory.l2 || []).slice(0, 8).map((x) =>
      `<tr><td>${x.key || '-'}</td><td>${x.summary || '-'}</td><td>${Number(x.strength || 0).toFixed(2)}</td><td>${fmtTime(x.updatedAt)}</td></tr>`,
    ),
    4,
  );

  byId('learningOverview').innerHTML = [
    kpi('最近事件', learning.metrics?.total ?? 0, 'window=60'),
    kpi('候选策略', (learning.candidates || []).length, 'candidates'),
    kpi('当前路由占比', (runtime.routeStats || []).map((x) => `${x.route}:${x.count}`).join(' | ') || '-', 'route mix'),
    kpi('自检状态', runtime.selfModel?.lastAuditStatus || '-', `gate pass/fail: ${runtime.selfModel?.gatePassCount || 0}/${runtime.selfModel?.gateFailCount || 0}`),
  ].join('');

  renderRows(
    'learningRows',
    (learning.events || []).slice(0, 10).map((e) =>
      `<tr><td>${fmtTime(e.ts)}</td><td>${e.outcome}</td><td>${e.patternKey}</td><td>${e.route}</td></tr>`,
    ),
    4,
  );

  renderRows(
    'candidateRows',
    (learning.candidates || []).slice(0, 10).map((c) => {
      const ev = c.event || {};
      return `<tr><td>${fmtTime(c.createdAt)}</td><td>${ev.patternKey || '-'}</td><td>${ev.summary || '-'}</td><td>${ev.strategy || '-'}</td></tr>`;
    }),
    4,
  );

  byId('runtimeOverview').innerHTML = [
    kpi('Top Session', summary.topSession?.sessionId || '-', `turns=${summary.topSession?.turnCount || 0}`),
    kpi('最近活动', fmtTime(summary.topSession?.lastAt), 'last session activity'),
    kpi('Self Stage', runtime.selfModel?.stage || '-', 'self model stage'),
    kpi('Identity', runtime.selfModel?.identity || 'SuperCharli', 'primary identity'),
  ].join('');

  byId('skillOverview').innerHTML = [
    kpi('Skill Catalog', skills.counts?.current ?? 0, 'current injected skill set'),
    kpi('注入历史', skills.counts?.history ?? 0, 'latest 120 events'),
    kpi(
      '最近注入',
      skills.history?.[0]?.loadedSkillIds?.length ?? 0,
      `tokens=${skills.history?.[0]?.promptTokensUsed ?? 0}`,
    ),
  ].join('');

  renderRows(
    'skillCatalogRows',
    (skills.catalog || []).slice(0, 20).map((s) =>
      `<tr><td>${s.skillId || '-'}</td><td>${s.seenCount ?? 0}</td><td>${fmtTime(s.lastSeenAt)}</td><td>${s.latestPreview || '-'}</td></tr>`,
    ),
    4,
  );

  renderRows(
    'skillHistoryRows',
    (skills.history || []).slice(0, 20).map((h) => {
      const ids = Array.isArray(h.loadedSkillIds) ? h.loadedSkillIds.join(', ') : '-';
      const routeModel = `${h.route || '-'} / ${h.modelProvider || '-'}:${h.modelName || '-'}`;
      return `<tr><td>${fmtTime(h.createdAt)}</td><td>${h.sessionId || '-'}</td><td>${routeModel}</td><td>${ids}</td></tr>`;
    }),
    4,
  );

  renderRows(
    'sessionRows',
    (runtime.sessions || []).slice(0, 10).map((s) =>
      `<tr><td>${s.sessionId}</td><td>${s.turnCount}</td><td>${fmtTime(s.lastAt)}</td></tr>`,
    ),
    3,
  );

  renderRows(
    'routeRows',
    (runtime.routeStats || []).map((r) => `<tr><td>${r.route}</td><td>${r.count}</td></tr>`),
    2,
  );

  byId('selfModelBox').textContent = JSON.stringify(runtime.selfModel || {}, null, 2);
}

async function refresh() {
  const alert = byId('alert');
  alert.classList.add('hidden');
  try {
    const [summaryRes, memoryRes, learningRes, runtimeRes, skillsRes] = await Promise.all([
      getJson('/api/observer/summary'),
      getJson('/api/observer/memory'),
      getJson('/api/observer/learning'),
      getJson('/api/observer/runtime'),
      getJson('/api/observer/skills'),
    ]);

    const summary = summaryRes.data || {};
    const memory = memoryRes.data || {};
    const learning = learningRes.data || {};
    const runtime = runtimeRes.data || {};
    const skills = skillsRes.data || {};
    renderDashboard(summary, memory, learning, runtime, skills);
  } catch (err) {
    alert.textContent = `加载失败: ${err.message}`;
    alert.classList.remove('hidden');
  }
}

byId('refreshBtn')?.addEventListener('click', refresh);
refresh();
