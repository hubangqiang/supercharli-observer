async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function byId(id) { return document.getElementById(id); }

function fmtTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function pct(v) {
  return `${Math.round(Number(v || 0) * 100)}%`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function kpi(label, value, hint = '') {
  return `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>`;
}

function renderRows(id, rows, cols) {
  const el = byId(id);
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<tr><td colspan="${cols}">暂无数据</td></tr>`;
    return;
  }
  el.innerHTML = rows.join('');
}

function zhRoute(v) {
  return { fast: '快速', deep: '深度' }[String(v || '').toLowerCase()] || String(v || '-');
}

function zhOutcome(v) {
  return { success: '成功', failure: '失败', neutral: '中性' }[String(v || '').toLowerCase()] || String(v || '-');
}

function zhLifecycle(v) {
  return {
    candidate: '候选',
    shadow: '灰度',
    active: '生效',
    deprecated: '弃用',
    archived: '归档',
  }[String(v || '').toLowerCase()] || String(v || '-');
}

function zhProcessPhase(phase) {
  return {
    'session-bootstrap': '会话启动预加载',
    'user-message': '用户消息',
    'assistant-message': '助手回复',
    'user-message-legacy': '用户消息(历史)',
    'internal-skill-router-request': '隐式查询请求',
    'internal-skill-router-response': '隐式查询响应',
    'internal-skill-load': '隐式加载确认',
    'internal-skill-fallback': '本地兜底',
    'internal-skill-router-skipped': '路由跳过',
    'skill-routing': '路由决策',
    'skill-injection': '注入执行',
    'skill-usage-eval': '结果评估',
  }[String(phase || '').toLowerCase()] || String(phase || '-');
}

function clip(text, max = 160) {
  const s = String(text || '');
  return s.length <= max ? s : `${s.slice(0, max)}...(截断)`;
}

function processSummary(item) {
  const p = String(item.phase || '').toLowerCase();
  const d = item.data || {};
  if (p === 'user-message' || p === 'assistant-message' || p === 'user-message-legacy') return clip(d.text || '-');
  if (p === 'session-bootstrap') return `bootstrap: ${(Array.isArray(d.loadedSkillIds) ? d.loadedSkillIds.join(', ') : '-')}`;
  if (p === 'internal-skill-router-request') return clip(d.prompt || d.query || '-');
  if (p === 'internal-skill-router-response') return clip(d.raw || '-');
  if (p === 'internal-skill-load' || p === 'skill-routing') return `skills: ${(Array.isArray(d.selectedSkillIds) ? d.selectedSkillIds.join(', ') : '-')}`;
  if (p === 'skill-injection') return `applied=${(Array.isArray(d.appliedSkillIds) ? d.appliedSkillIds.join(', ') : '-')}; tokens=${d.promptTokensUsed ?? 0}`;
  if (p === 'skill-usage-eval') return `score=${Number(d.responseScore || 0).toFixed(2)} pass=${Boolean(d.qualityPass)}`;
  return clip(JSON.stringify(d));
}

const state = {
  summary: null,
  memory: null,
  learning: null,
  runtime: null,
  skills: null,
  selectedPage: 'overview',
  selectedSessionId: null,
  timelineCache: new Map(),
};

function initNav() {
  const navs = Array.from(document.querySelectorAll('.nav-item'));
  for (const n of navs) {
    n.addEventListener('click', () => {
      const page = String(n.dataset.page || 'overview');
      switchPage(page);
    });
  }
  byId('navToggleBtn')?.addEventListener('click', () => {
    byId('appRoot')?.classList.toggle('sidebar-collapsed');
  });
}

function switchPage(page) {
  state.selectedPage = page;
  for (const n of document.querySelectorAll('.nav-item')) {
    n.classList.toggle('active', String(n.dataset.page) === page);
  }
  for (const p of document.querySelectorAll('.page')) {
    p.classList.toggle('active', p.id === `page-${page}`);
  }
}

function renderOverview() {
  const summary = state.summary || {};
  const learning = state.learning || {};
  const runtime = state.runtime || {};
  const skills = state.skills || {};

  byId('overviewKpis').innerHTML = [
    kpi('会话数', summary.sessionCount ?? 0, '活跃会话'),
    kpi('学习事件', learning.metrics?.total ?? 0, '窗口=60'),
    kpi('成功率', pct(learning.metrics?.successRate), `失败率=${pct(learning.metrics?.failureRate)}`),
    kpi('管理技能', skills.counts?.managedCurrent ?? 0, 'Skill 资产总数'),
    kpi('过程追踪', skills.counts?.processTrace ?? 0, '隐式链路事件'),
  ].join('');

  renderRows(
    'overviewRouteRows',
    (runtime.routeStats || []).map((r) => `<tr><td>${zhRoute(r.route)}</td><td>${r.count}</td></tr>`),
    2,
  );

  renderRows(
    'overviewSessionRows',
    (runtime.sessions || []).slice(0, 20).map((s) =>
      `<tr><td>${esc(s.sessionId)}</td><td>${Number(s.turnCount || 0)}</td><td>${fmtTime(s.lastAt)}</td></tr>`),
    3,
  );
}

function renderMemory() {
  const memory = state.memory || {};
  byId('memoryKpis').innerHTML = [
    kpi('L1 会话记忆', memory.counts?.l1 ?? 0),
    kpi('L2 长期记忆', memory.counts?.l2 ?? 0),
    kpi('L3 里程碑', memory.counts?.l3 ?? 0),
    kpi('L4 身份层', memory.counts?.l4 ?? 0),
  ].join('');

  renderRows(
    'memoryL2Rows',
    (memory.l2 || []).slice(0, 40).map((x) =>
      `<tr><td>${esc(x.key || '-')}</td><td>${esc(x.summary || '-')}</td><td>${Number(x.strength || 0).toFixed(2)}</td><td>${fmtTime(x.updatedAt)}</td></tr>`),
    4,
  );
}

function renderLearning() {
  const learning = state.learning || {};
  byId('learningKpis').innerHTML = [
    kpi('总事件', learning.metrics?.total ?? 0),
    kpi('成功', learning.metrics?.success ?? 0),
    kpi('失败', learning.metrics?.failure ?? 0),
    kpi('重复模式', learning.metrics?.repeated ?? 0),
  ].join('');

  renderRows(
    'learningRows',
    (learning.events || []).slice(0, 80).map((e) =>
      `<tr><td>${fmtTime(e.ts)}</td><td>${zhOutcome(e.outcome)}</td><td>${esc(e.patternKey || '-')}</td><td>${zhRoute(e.route)}</td></tr>`),
    4,
  );
}

function renderSkills() {
  const skills = state.skills || {};
  byId('skillsKpis').innerHTML = [
    kpi('管理技能', skills.counts?.managedCurrent ?? 0),
    kpi('生效', skills.lifecycleCounts?.active ?? 0),
    kpi('灰度', skills.lifecycleCounts?.shadow ?? 0),
    kpi('候选', skills.lifecycleCounts?.candidate ?? 0),
  ].join('');

  renderRows(
    'skillsAssetRows',
    (skills.managedCatalog || []).slice(0, 200).map((s) =>
      `<tr>
        <td>${esc(s.skillId || '-')}</td>
        <td>${esc(s.title || '-')}</td>
        <td>${esc(s.skillType || '-')}</td>
        <td>${zhLifecycle(s.lifecycle)}</td>
        <td>${Number(s.qualityScore || 0).toFixed(2)}</td>
        <td>${Number(s.useCount || 0)}</td>
        <td>${Number(s.successCount || 0)} / ${Number(s.failCount || 0)}</td>
        <td>${fmtTime(s.updatedAt)}</td>
        <td>${esc(s.source || '-')}</td>
      </tr>`,
    ),
    9,
  );
}

function renderAudit() {
  const skills = state.skills || {};
  renderRows(
    'auditProcessRows',
    (skills.processTrace || []).slice(0, 300).map((p) => {
      const routeModel = `${zhRoute(p.route)} / ${p.modelProvider || '-'}:${p.modelName || '-'}`;
      return `<tr><td>${fmtTime(p.createdAt)}</td><td>${esc(`${p.sessionId || '-'} / ${p.traceId || '-'}`)}</td><td>${zhProcessPhase(p.phase)}</td><td>${esc(routeModel)}</td><td>${esc(processSummary(p))}</td></tr>`;
    }),
    5,
  );

  renderRows(
    'auditLifecycleRows',
    (skills.lifecycleHistory || []).slice(0, 120).map((h) =>
      `<tr><td>${fmtTime(h.createdAt)}</td><td>${esc(h.skillId || '-')}</td><td>${zhLifecycle(h.fromState)} -> ${zhLifecycle(h.toState)}</td><td>${esc(h.reason || '-')}</td></tr>`),
    4,
  );
}

function getOnlineSessions() {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  return (state.runtime?.sessions || []).filter((s) => {
    const ts = s.lastAt ? new Date(s.lastAt).getTime() : 0;
    return ts > 0 && (now - ts) <= windowMs;
  });
}

async function loadSessionTimeline(sessionId) {
  if (!sessionId) return [];
  if (state.timelineCache.has(sessionId)) return state.timelineCache.get(sessionId);
  const res = await getJson(`/api/observer/session-timeline?sessionId=${encodeURIComponent(sessionId)}&limit=500`);
  const rows = res.data || [];
  state.timelineCache.set(sessionId, rows);
  return rows;
}

async function renderSessionsPage() {
  const online = getOnlineSessions();
  const listEl = byId('onlineSessionsList');
  if (!online.length) {
    listEl.innerHTML = '<div class="session-item active">暂无在线会话</div>';
    byId('timelineTitle').textContent = '会话时间线';
    byId('timelineContainer').innerHTML = '<div class="timeline-empty">暂无时间线</div>';
    return;
  }

  if (!state.selectedSessionId || !online.some((x) => x.sessionId === state.selectedSessionId)) {
    state.selectedSessionId = online[0].sessionId;
  }

  listEl.innerHTML = online.map((s) => {
    const active = s.sessionId === state.selectedSessionId;
    return `<button class="session-item ${active ? 'active' : ''}" data-session-id="${esc(s.sessionId)}">${esc(s.sessionId)}<span>${fmtTime(s.lastAt)}</span></button>`;
  }).join('');

  for (const btn of listEl.querySelectorAll('.session-item')) {
    btn.addEventListener('click', async () => {
      state.selectedSessionId = btn.dataset.sessionId;
      await renderSessionsPage();
    });
  }

  const sid = state.selectedSessionId;
  byId('timelineTitle').textContent = `会话时间线：${sid}`;
  const timeline = await loadSessionTimeline(sid);
  const tEl = byId('timelineContainer');
  if (!timeline.length) {
    tEl.innerHTML = '<div class="timeline-empty">该会话暂无事件</div>';
    return;
  }

  tEl.innerHTML = timeline.map((item) => {
    const summary = processSummary(item);
    const full = item.data && typeof item.data === 'object' ? JSON.stringify(item.data, null, 2) : '-';
    return `<div class="timeline-item">
      <div class="dot"></div>
      <div class="card">
        <div class="meta">${fmtTime(item.createdAt)} | ${zhProcessPhase(item.phase)}</div>
        <div class="summary">${esc(summary)}</div>
        <details>
          <summary>展开全文</summary>
          <pre>${esc(full)}</pre>
        </details>
      </div>
    </div>`;
  }).join('');

  tEl.scrollTop = tEl.scrollHeight;
}

function renderAllStaticPages() {
  renderOverview();
  renderMemory();
  renderLearning();
  renderSkills();
  renderAudit();
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

    state.summary = summaryRes.data || {};
    state.memory = memoryRes.data || {};
    state.learning = learningRes.data || {};
    state.runtime = runtimeRes.data || {};
    state.skills = skillsRes.data || {};
    byId('metaLine').textContent = `数据库: ${state.summary.dbPath} | 作用域: ${state.summary.scope} | 更新时间: ${fmtTime(state.summary.generatedAt)}`;

    renderAllStaticPages();
    await renderSessionsPage();
  } catch (err) {
    alert.textContent = `加载失败: ${err.message}`;
    alert.classList.remove('hidden');
  }
}

byId('refreshBtn')?.addEventListener('click', refresh);
initNav();
switchPage('overview');
refresh();
