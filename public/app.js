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

function zhLifecycle(v) {
  const map = {
    candidate: '候选',
    shadow: '灰度',
    active: '生效',
    deprecated: '弃用',
    archived: '归档',
  };
  return map[String(v || '').toLowerCase()] || String(v || '-');
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function zhCommonText(text) {
  if (!text) return '-';
  return String(text)
    .replace(/Core constraints/gi, '核心约束')
    .replace(/Identity invariants/gi, '身份约束')
    .replace(/Style runtime/gi, '风格运行时')
    .replace(/Memory focus pack/gi, '记忆注入包')
    .replace(/Maintain SuperCharli identity and safety boundaries/gi, '保持超级查理身份与安全边界')
    .replace(/External model does reasoning\/generation/gi, '外部模型负责推理与生成')
    .replace(/local memory\/learning are augmentation and governance signals/gi, '本地记忆/学习仅作增强与治理信号')
    .replace(/No fabricated certainty/gi, '禁止伪造确定性')
    .replace(/No internal labels in final ans/gi, '最终回答不输出内部标签')
    .replace(/Mode/gi, '模式')
    .replace(/tone/gi, '语气')
    .replace(/stage/gi, '阶段')
    .replace(/bias/gi, '偏置')
    .replace(/Focus mode/gi, '专注模式')
    .replace(/work execution priority/gi, '工作执行优先')
    .replace(/Use concise professional sentences/gi, '使用简洁专业表达')
    .replace(/adapt structure to user intent/gi, '根据用户意图调整结构')
    .replace(/no fixed format mandate/gi, '不强制固定格式');
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

function buildSessionSkillRows(injectionHistory = []) {
  const grouped = new Map();
  for (const h of injectionHistory) {
    const sessionId = String(h.sessionId || '').trim() || 'unknown';
    const current = grouped.get(sessionId) || {
      sessionId,
      lastAt: null,
      route: '-',
      modelProvider: '-',
      modelName: '-',
      skills: new Set(),
    };
    const ts = h.createdAt ? new Date(h.createdAt).getTime() : 0;
    const prev = current.lastAt ? new Date(current.lastAt).getTime() : 0;
    if (!current.lastAt || ts > prev) {
      current.lastAt = h.createdAt;
      current.route = h.route || '-';
      current.modelProvider = h.modelProvider || '-';
      current.modelName = h.modelName || '-';
    }
    const ids = Array.isArray(h.loadedSkillIds) ? h.loadedSkillIds : [];
    for (const id of ids) current.skills.add(String(id || '').trim());
    grouped.set(sessionId, current);
  }
  return Array.from(grouped.values())
    .sort((a, b) => {
      const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return tb - ta;
    })
    .map((x) => ({
      sessionId: x.sessionId,
      lastAt: x.lastAt,
      routeModel: `${zhRoute(x.route)} / ${x.modelProvider}:${x.modelName}`,
      skillText: Array.from(x.skills).filter(Boolean).join(', ') || '-',
    }));
}

function computeSkillOverview(managedCatalog = [], injectionHistory = [], lifecycleCounts = {}) {
  const total = managedCatalog.length;
  const active = Number(lifecycleCounts.active || 0);
  const activeRate = total ? active / total : 0;
  const avgQuality = total
    ? managedCatalog.reduce((sum, x) => sum + Number(x.qualityScore || 0), 0) / total
    : 0;
  const typeMap = new Map();
  const sourceMap = new Map();
  for (const s of managedCatalog) {
    const t = String(s.skillType || 'domain');
    const src = String(s.source || 'unknown');
    typeMap.set(t, (typeMap.get(t) || 0) + 1);
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
  }

  const risky = managedCatalog
    .map((s) => {
      const use = Number(s.useCount || 0);
      const fail = Number(s.failCount || 0);
      const failRate = use ? fail / use : 0;
      const quality = Number(s.qualityScore || 0);
      const riskScore = failRate * 0.6 + (1 - quality) * 0.3 + Math.min(use / 30, 1) * 0.1;
      let advice = '维持观察';
      if (failRate >= 0.35 && use >= 3) advice = '建议降级到灰度并补充边界';
      else if (quality < 0.5 && use >= 2) advice = '建议补充证据并修订方法';
      else if (use === 0) advice = '建议小流量试用';
      return {
        skillId: s.skillId,
        quality,
        failRate,
        use,
        advice,
        riskScore,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);

  return {
    total,
    active,
    activeRate,
    avgQuality,
    injectionSessions: buildSessionSkillRows(injectionHistory).length,
    typeDist: Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]),
    sourceDist: Array.from(sourceMap.entries()).sort((a, b) => b[1] - a[1]),
    risky,
  };
}

function renderManagedSkillCards(skills, filters = {}) {
  const box = byId('managedSkillCards');
  if (!box) return;

  const q = String(filters.query || '').trim().toLowerCase();
  const lifecycle = String(filters.lifecycle || '').trim().toLowerCase();
  const type = String(filters.type || '').trim().toLowerCase();

  const filtered = (Array.isArray(skills) ? skills : []).filter((s) => {
    if (lifecycle && String(s.lifecycle || '').toLowerCase() !== lifecycle) return false;
    if (type && String(s.skillType || '').toLowerCase() !== type) return false;
    if (!q) return true;
    const tags = Array.isArray(s.scenarioTags) ? s.scenarioTags.join(' ') : '';
    const blob = `${s.skillId || ''} ${s.title || ''} ${s.applicability || ''} ${s.method || ''} ${s.boundaries || ''} ${tags}`.toLowerCase();
    return blob.includes(q);
  });

  if (!filtered.length) {
    box.innerHTML = '<div class="skill-card"><div class="skill-card-id">暂无匹配数据</div></div>';
    return;
  }

  box.innerHTML = filtered.slice(0, 80).map((s) => {
    const tags = Array.isArray(s.scenarioTags) ? s.scenarioTags : [];
    const tagText = tags.length ? tags.map((t) => `<span class="skill-badge">${esc(t)}</span>`).join('') : '<span class="skill-badge">无标签</span>';
    const quality = Number(s.qualityScore || 0).toFixed(2);
    const confidence = Number(s.confidence || 0).toFixed(2);
    return `
      <article class="skill-card">
        <div class="skill-card-top">
          <div>
            <h4 class="skill-card-title">${esc(s.title || '未命名 Skill')}</h4>
            <div class="skill-card-id">${esc(s.skillId || '-')}</div>
          </div>
          <div class="skill-badges">
            <span class="skill-badge">${zhLifecycle(s.lifecycle)}</span>
            <span class="skill-badge">${esc(s.skillType || 'domain')}</span>
            <span class="skill-badge">v${esc(s.version ?? 1)}</span>
          </div>
        </div>
        <div class="skill-grid">
          <div class="skill-item"><span class="label">质量:</span>${quality}</div>
          <div class="skill-item"><span class="label">置信度:</span>${confidence}</div>
          <div class="skill-item"><span class="label">使用次数:</span>${esc(s.useCount ?? 0)}</div>
          <div class="skill-item"><span class="label">证据数:</span>${esc(s.evidenceCount ?? 0)}</div>
          <div class="skill-item"><span class="label">成功/失败:</span>${esc(s.successCount ?? 0)} / ${esc(s.failCount ?? 0)}</div>
          <div class="skill-item"><span class="label">注入预算:</span>${esc(s.injectionBudget ?? '-')} tokens</div>
          <div class="skill-item"><span class="label">来源:</span>${esc(s.source || '-')}</div>
          <div class="skill-item"><span class="label">状态:</span>${esc(s.status || '-')}</div>
          <div class="skill-item"><span class="label">最近更新:</span>${esc(fmtTime(s.updatedAt))}</div>
          <div class="skill-item"><span class="label">最近使用:</span>${esc(fmtTime(s.lastUsedAt))}</div>
        </div>
        <div class="skill-text"><span class="label">适用场景:</span>${esc(zhCommonText(s.applicability || '-'))}</div>
        <div class="skill-text"><span class="label">执行方法:</span>${esc(zhCommonText(s.method || '-'))}</div>
        <div class="skill-text"><span class="label">边界约束:</span>${esc(zhCommonText(s.boundaries || '-'))}</div>
        <div class="skill-text"><span class="label">场景标签:</span>${tagText}</div>
      </article>
    `;
  }).join('');
}

function computeSkillCombos(injectionHistory = []) {
  const pairMap = new Map();
  const latestMap = new Map();
  for (const h of injectionHistory) {
    const ids = Array.from(new Set((Array.isArray(h.loadedSkillIds) ? h.loadedSkillIds : []).map((x) => String(x || '').trim()).filter(Boolean))).sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = `${ids[i]} + ${ids[j]}`;
        pairMap.set(key, (pairMap.get(key) || 0) + 1);
        if (!latestMap.get(key) || new Date(h.createdAt).getTime() > new Date(latestMap.get(key)).getTime()) {
          latestMap.set(key, h.createdAt);
        }
      }
    }
  }
  return Array.from(pairMap.entries())
    .map(([pair, count]) => ({ pair, count, lastAt: latestMap.get(pair) || null }))
    .sort((a, b) => b.count - a.count || new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime())
    .slice(0, 20);
}

function computePotentialConflicts(managedCatalog = []) {
  const rows = [];
  const active = managedCatalog.filter((x) => String(x.lifecycle || '').toLowerCase() === 'active');
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      const tagsA = new Set(Array.isArray(a.scenarioTags) ? a.scenarioTags : []);
      const tagsB = new Set(Array.isArray(b.scenarioTags) ? b.scenarioTags : []);
      const overlap = Array.from(tagsA).filter((x) => tagsB.has(x));
      if (!overlap.length) continue;
      const textA = `${a.method || ''} ${a.boundaries || ''}`;
      const textB = `${b.method || ''} ${b.boundaries || ''}`;
      const hardA = /固定|必须|强制/.test(textA);
      const flexA = /自适应|按需|可选/.test(textA);
      const hardB = /固定|必须|强制/.test(textB);
      const flexB = /自适应|按需|可选/.test(textB);
      const conflictSignal = (hardA && flexB) || (hardB && flexA);
      if (!conflictSignal) continue;
      rows.push({
        pair: `${a.skillId} <> ${b.skillId}`,
        signal: `标签重叠(${overlap.join(', ')}) + 方法约束差异`,
        note: '建议在路由层做二选一或按优先级注入',
      });
    }
  }
  return rows.slice(0, 20);
}

function renderSkillAssetModule(skills) {
  const managedCatalog = Array.isArray(skills.managedCatalog) ? skills.managedCatalog : [];
  const injectionHistory = Array.isArray(skills.injectionHistory) ? skills.injectionHistory : [];
  const overview = computeSkillOverview(managedCatalog, injectionHistory, skills.lifecycleCounts || {});

  renderRows(
    'sessionSkillRows',
    buildSessionSkillRows(injectionHistory).slice(0, 30).map((x) =>
      `<tr><td>${x.sessionId}</td><td>${fmtTime(x.lastAt)}</td><td>${x.routeModel}</td><td>${x.skillText}</td></tr>`,
    ),
    4,
  );

  byId('skillAssetOverviewCards').innerHTML = [
    kpi('管理 Skill 总数', overview.total, '方法资产规模'),
    kpi('生效占比', pct(overview.activeRate), `active=${overview.active}`),
    kpi('平均质量', Number(overview.avgQuality || 0).toFixed(2), '质量均值'),
    kpi('注入会话数', overview.injectionSessions, '有注入记录会话'),
    kpi('类型分布', overview.typeDist.map((x) => `${x[0]}:${x[1]}`).join(' | ') || '-', 'skillType'),
    kpi('来源分布', overview.sourceDist.map((x) => `${x[0]}:${x[1]}`).join(' | ') || '-', 'source'),
  ].join('');

  renderRows(
    'skillRiskRows',
    overview.risky.map((x) =>
      `<tr><td>${esc(x.skillId)}</td><td>${x.quality.toFixed(2)}</td><td>${pct(x.failRate)}</td><td>${x.use}</td><td>${esc(x.advice)}</td></tr>`,
    ),
    5,
  );

  byId('skillLifecycleCards').innerHTML = [
    kpi('候选', skills.lifecycleCounts?.candidate ?? 0, 'candidate'),
    kpi('灰度', skills.lifecycleCounts?.shadow ?? 0, 'shadow'),
    kpi('生效', skills.lifecycleCounts?.active ?? 0, 'active'),
    kpi('弃用', skills.lifecycleCounts?.deprecated ?? 0, 'deprecated'),
    kpi('归档', skills.lifecycleCounts?.archived ?? 0, 'archived'),
  ].join('');

  renderRows(
    'skillLifecycleRows',
    (skills.lifecycleHistory || []).slice(0, 50).map((h) =>
      `<tr><td>${fmtTime(h.createdAt)}</td><td>${h.skillId || '-'}</td><td>${zhLifecycle(h.fromState)} -> ${zhLifecycle(h.toState)}</td><td>${h.reason || '-'}</td></tr>`,
    ),
    4,
  );

  const combos = computeSkillCombos(injectionHistory);
  renderRows(
    'skillComboRows',
    combos.map((c) => `<tr><td>${esc(c.pair)}</td><td>${c.count}</td><td>${fmtTime(c.lastAt)}</td></tr>`),
    3,
  );

  const conflicts = computePotentialConflicts(managedCatalog);
  renderRows(
    'skillConflictRows',
    conflicts.map((c) => `<tr><td>${esc(c.pair)}</td><td>${esc(c.signal)}</td><td>${esc(c.note)}</td></tr>`),
    3,
  );

  renderRows(
    'managedSkillHistoryRows',
    (skills.managedHistory || []).slice(0, 50).map((h) => {
      const ids = Array.isArray(h.skillIds) ? h.skillIds.join(', ') : '-';
      const routeModel = `${zhRoute(h.route)} / ${h.modelProvider || '-'}:${h.modelName || '-'}`;
      return `<tr><td>${fmtTime(h.createdAt)}</td><td>${h.sessionId || '-'}</td><td>${routeModel}</td><td>${ids}</td></tr>`;
    }),
    4,
  );

  const auditTimeline = [];
  for (const h of (skills.managedHistory || []).slice(0, 80)) {
    const ids = Array.isArray(h.skillIds) ? h.skillIds.join(', ') : '-';
    auditTimeline.push({
      createdAt: h.createdAt,
      type: '使用',
      skill: ids,
      detail: `${zhRoute(h.route)} / ${h.modelProvider || '-'}:${h.modelName || '-'}`,
    });
  }
  for (const h of (skills.lifecycleHistory || []).slice(0, 80)) {
    auditTimeline.push({
      createdAt: h.createdAt,
      type: '迁移',
      skill: h.skillId || '-',
      detail: `${zhLifecycle(h.fromState)} -> ${zhLifecycle(h.toState)} | ${h.reason || '-'}`,
    });
  }
  auditTimeline.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  renderRows(
    'skillAuditRows',
    auditTimeline.slice(0, 80).map((x) =>
      `<tr><td>${fmtTime(x.createdAt)}</td><td>${x.type}</td><td>${esc(x.skill)}</td><td>${esc(x.detail)}</td></tr>`,
    ),
    4,
  );

  const searchInput = byId('skillSearchInput');
  const lifecycleFilter = byId('skillLifecycleFilter');
  const typeFilter = byId('skillTypeFilter');
  renderManagedSkillCards(managedCatalog, {
    query: searchInput?.value || '',
    lifecycle: lifecycleFilter?.value || '',
    type: typeFilter?.value || '',
  });
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
    kpi('候选', skills.lifecycleCounts?.candidate ?? 0, 'candidate'),
    kpi('灰度', skills.lifecycleCounts?.shadow ?? 0, 'shadow'),
    kpi('生效', skills.lifecycleCounts?.active ?? 0, 'active'),
  ].join('');

  renderSkillAssetModule(skills);

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

function initSkillTabs() {
  const tabs = Array.from(document.querySelectorAll('.skill-tab'));
  const panels = Array.from(document.querySelectorAll('.skill-tab-panel'));
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const target = String(tab.dataset.skillTab || 'overview');
      for (const t of tabs) t.classList.toggle('active', t === tab);
      for (const p of panels) p.classList.toggle('active', p.id === `skill-tab-${target}`);
    });
  }
}

function initSkillFilters(lastDataRef) {
  const ids = ['skillSearchInput', 'skillLifecycleFilter', 'skillTypeFilter'];
  for (const id of ids) {
    const el = byId(id);
    if (!el) continue;
    el.addEventListener('input', () => {
      const skills = lastDataRef.skills || {};
      renderManagedSkillCards(skills.managedCatalog || [], {
        query: byId('skillSearchInput')?.value || '',
        lifecycle: byId('skillLifecycleFilter')?.value || '',
        type: byId('skillTypeFilter')?.value || '',
      });
    });
    el.addEventListener('change', () => {
      const skills = lastDataRef.skills || {};
      renderManagedSkillCards(skills.managedCatalog || [], {
        query: byId('skillSearchInput')?.value || '',
        lifecycle: byId('skillLifecycleFilter')?.value || '',
        type: byId('skillTypeFilter')?.value || '',
      });
    });
  }
}

const dashboardState = { skills: null };

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
    dashboardState.skills = skills;
    renderDashboard(summary, memory, learning, runtime, skills);
  } catch (err) {
    alert.textContent = `加载失败: ${err.message}`;
    alert.classList.remove('hidden');
  }
}

byId('refreshBtn')?.addEventListener('click', refresh);
initSkillTabs();
initSkillFilters(dashboardState);
refresh();
