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

function zhStage(v) {
  const map = {
    apprentice: '学徒',
    pattern: '模式',
    transfer: '迁移',
    autonomous: '自治',
    unknown: '未知',
  };
  return map[String(v || '').toLowerCase()] || String(v || '-');
}

function zhRoute(v) {
  const map = { fast: '快速', deep: '深度' };
  return map[String(v || '').toLowerCase()] || String(v || '-');
}

function zhOutcome(v) {
  const map = { success: '成功', failure: '失败', neutral: '中性' };
  return map[String(v || '').toLowerCase()] || String(v || '-');
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
  byId('metaLine').textContent = `数据库: ${summary.dbPath} | 作用域: ${summary.scope} | 更新时间: ${fmtTime(summary.generatedAt)}`;

  const stage = summary.learningStage || 'unknown';
  const failureRate = Number(summary.learningMetrics?.failureRate || 0);
  const stageClass = stage === 'autonomous' ? 'good' : stage === 'apprentice' ? 'warn' : '';
  const failClass = failureRate >= 0.4 ? 'bad' : failureRate >= 0.2 ? 'warn' : 'good';

  byId('kpis').innerHTML = [
    kpi('学习阶段', zhStage(stage), '学习状态', stageClass),
    kpi('策略版本', summary.policyVersion ?? '-', '策略版本号'),
    kpi('灰度发布', summary.rollout?.enabled ? `开启 ${pct(summary.rollout.ratio)}` : '关闭', summary.rollout?.note || ''),
    kpi('会话数', summary.sessionCount ?? 0, '活跃会话'),
    kpi('成功率', pct(summary.learningMetrics?.successRate), `总计=${summary.learningMetrics?.total || 0}`),
    kpi('失败率', pct(summary.learningMetrics?.failureRate), `重复=${summary.learningMetrics?.repeated || 0}`, failClass),
    kpi('当前技能', summary.skillCount ?? 0, '注入目录'),
    kpi('技能历史', summary.skillHistoryCount ?? 0, '注入事件'),
  ].join('');

  byId('memoryLevels').innerHTML = [
    kpi('L1 会话记忆', memory.counts?.l1 ?? 0, '最近事件'),
    kpi('L2 长期记忆', memory.counts?.l2 ?? 0, '模式沉淀'),
    kpi('L3 里程碑', memory.counts?.l3 ?? 0, '成长时间线'),
    kpi('L4 身份层', memory.counts?.l4 ?? 0, '身份与价值'),
  ].join('');

  renderRows(
    'l2Rows',
    (memory.l2 || []).slice(0, 8).map((x) =>
      `<tr><td>${x.key || '-'}</td><td>${x.summary || '-'}</td><td>${Number(x.strength || 0).toFixed(2)}</td><td>${fmtTime(x.updatedAt)}</td></tr>`,
    ),
    4,
  );

  byId('learningOverview').innerHTML = [
    kpi('最近事件', learning.metrics?.total ?? 0, '窗口=60'),
    kpi('候选策略', (learning.candidates || []).length, '候选数'),
    kpi('当前路由占比', (runtime.routeStats || []).map((x) => `${zhRoute(x.route)}:${x.count}`).join(' | ') || '-', '路由混合'),
    kpi('自检状态', runtime.selfModel?.lastAuditStatus || '-', `门控通过/失败: ${runtime.selfModel?.gatePassCount || 0}/${runtime.selfModel?.gateFailCount || 0}`),
  ].join('');

  renderRows(
    'learningRows',
    (learning.events || []).slice(0, 10).map((e) =>
      `<tr><td>${fmtTime(e.ts)}</td><td>${zhOutcome(e.outcome)}</td><td>${e.patternKey}</td><td>${zhRoute(e.route)}</td></tr>`,
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
    kpi('最高活跃会话', summary.topSession?.sessionId || '-', `轮次=${summary.topSession?.turnCount || 0}`),
    kpi('最近活动', fmtTime(summary.topSession?.lastAt), '最近会话活动'),
    kpi('自我阶段', zhStage(runtime.selfModel?.stage || '-'), '自我模型阶段'),
    kpi('主身份', runtime.selfModel?.identity || '超级查理', '身份锚点'),
  ].join('');

  byId('skillOverview').innerHTML = [
    kpi('注入技能', skills.counts?.current ?? 0, '当前注入包'),
    kpi('注入历史', skills.counts?.history ?? 0, '最近注入事件'),
    kpi('管理技能', skills.counts?.managedCurrent ?? 0, '方法资产'),
    kpi('管理历史', skills.counts?.managedHistory ?? 0, '使用历史'),
  ].join('');

  renderRows(
    'skillCatalogRows',
    (skills.injectionCatalog || []).slice(0, 20).map((s) =>
      `<tr><td>${s.skillId || '-'}</td><td>${s.seenCount ?? 0}</td><td>${fmtTime(s.lastSeenAt)}</td><td>${s.latestPreview || '-'}</td></tr>`,
    ),
    4,
  );

  renderRows(
    'skillHistoryRows',
    (skills.injectionHistory || []).slice(0, 20).map((h) => {
      const ids = Array.isArray(h.loadedSkillIds) ? h.loadedSkillIds.join(', ') : '-';
      const routeModel = `${zhRoute(h.route)} / ${h.modelProvider || '-'}:${h.modelName || '-'}`;
      return `<tr><td>${fmtTime(h.createdAt)}</td><td>${h.sessionId || '-'}</td><td>${routeModel}</td><td>${ids}</td></tr>`;
    }),
    4,
  );

  renderRows(
    'managedSkillRows',
    (skills.managedCatalog || []).slice(0, 20).map((s) =>
      `<tr><td>${s.skillId || '-'}</td><td>${s.title || '-'}</td><td>${s.useCount ?? 0}</td><td>${fmtTime(s.updatedAt)}</td></tr>`,
    ),
    4,
  );

  renderRows(
    'managedSkillHistoryRows',
    (skills.managedHistory || []).slice(0, 20).map((h) => {
      const ids = Array.isArray(h.skillIds) ? h.skillIds.join(', ') : '-';
      const routeModel = `${zhRoute(h.route)} / ${h.modelProvider || '-'}:${h.modelName || '-'}`;
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
    (runtime.routeStats || []).map((r) => `<tr><td>${zhRoute(r.route)}</td><td>${r.count}</td></tr>`),
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
