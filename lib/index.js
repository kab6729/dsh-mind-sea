// dsh-mind-sea：L1 识海 + L2 日记 的记忆插件
// 对应《小鲸鱼四层记忆框架》：她随时可调用的长期记忆（不是每轮全量注入）。
import fs from 'node:fs';
import path from 'node:path';
import {
  remember, recall, consolidate, stats, renderInjection, renderSessionInjection,
  diaryWrite, diaryRead, loadGraph, saveGraph, LIMITS,
  loadConfig, saveConfig, getState, setState, todayStr, runConsolidateOnce,
  getBinding, setBinding, clearBinding, loadBindings, saveBindings,
  listSeas, createSea, deleteSea, listProfiles, readProfile, writeProfile,
  createProfile, deleteProfile, GLOBAL_SEA, GLOBAL_PROFILE,
  auditBindings, readAudit, pruneOrphanBindings, liveSessionIds,
} from './mind.js';

const outputText = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] };

// 从工具执行上下文解析出「这个会话该用哪个识海域 / 哪份人设」
function ctxOf(exec) {
  const sid = exec && exec.agent && exec.agent.id ? String(exec.agent.id) : '';
  const b = sid ? getBinding(sid) : { profile: GLOBAL_PROFILE, sea: GLOBAL_SEA };
  return { sessionId: sid, sea: b.sea, profile: b.profile };
}

function fmtNode(n) {
  const tag = n.tags?.length ? ' #' + n.tags.join(' #') : '';
  return `· [${n.level}] ${n.text}${tag}`;
}

const toolDefs = [
  {
    name: 'mind_remember',
    description: '往识海里记一条事实（L1）。适用：主人说的长期偏好/约定/重要事件、你反思出的规律。单条 ≤200 字，一条只放一件事。你自己写时等级只能是 normal 或 important（core 只能由主人确认后写）。每天最多自记 8 条。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string', description: '一条事实，≤200 字，自包含（未来看不到当前对话）' },
        level: { type: 'string', enum: ['normal', 'important'], description: 'normal=一般细节，important=重要约定/事件' },
        tags: { type: 'array', items: { type: 'string' }, description: '可选标签，如 称呼/约定/喜好/事件' },
        source: { type: 'string', enum: ['owner', 'self', 'group', 'web'], description: '来源：owner=主人说的，self=你自己想的' },
      },
      required: ['text'],
    },
    output: outputText,
    async execute(args, exec) {
      const { sea } = ctxOf(exec);
      const r = remember(sea, args.text, args.level || 'normal', args.tags || [], args.source || 'self', '');
      if (!r.ok) return `没记成：${r.error}`;
      return `记下了（域 ${sea}）：[${r.node.level}] ${r.node.text}`;
    },
  },
  {
    name: 'mind_recall',
    description: '从识海里按话题检索相关旧事（L1）。想起来过去的事、确认主人以前说过什么、对方提到"之前/上次/那个"但你不确定时用它。返回按相关度排序的若干条。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: '要检索的话题或关键词' },
        top_n: { type: 'number', description: '最多几条，默认 5' },
      },
      required: ['query'],
    },
    output: outputText,
    async execute(args, exec) {
      const { sea } = ctxOf(exec);
      const q = String(args.query || '').trim();
      if (!q) return '要检索什么？给个关键词。';
      const top = recall(sea, q, Math.min(Math.max(Number(args.top_n) || LIMITS.recallTopN, 1), 20));
      if (!top.length) return `识海（域 ${sea}）里没有和「${q}」直接相关的事。（没有就说不知道，别编。）`;
      return `关于「${q}」，想起来的 ${top.length} 条：\n` + top.map(fmtNode).join('\n');
    },
  },
  {
    name: 'mind_diary_write',
    description: '写一条日记（L2）：今天发生的事和当时的心情。一天 1~3 条，每条 ≤300 字，写细节和感受，不是汇报。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mood: { type: 'string', description: '当时的心情，如 安静/高兴/有点累' },
        content: { type: 'string', description: '日记正文，≤300 字' },
      },
      required: ['content'],
    },
    output: outputText,
    async execute(args, exec) {
      const { sea } = ctxOf(exec);
      const r = diaryWrite(sea, args.mood, args.content);
      if (!r.ok) return `没写成：${r.error}`;
      return `写好了（${r.when}，${args.mood || '平常'}，域 ${sea}）。`;
    },
  },
  {
    name: 'mind_diary_read',
    description: '读最近的日记（L2），回忆这几天自己的心情和细节。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { limit: { type: 'number', description: '最近几条，默认 10' } },
    },
    output: outputText,
    async execute(args, exec) {
      const { sea } = ctxOf(exec);
      const rows = diaryRead(sea, Math.min(Math.max(Number(args.limit) || 10, 1), 100));
      if (!rows.length) return `域 ${sea} 还没有日记。`;
      return rows.map((r) => `· ${r.时间}｜${r.心情}｜${r.内容}`).join('\n');
    },
  },
  {
    name: 'mind_stats',
    description: '看识海规模：节点数、层分布、最老最新、有效权重最高的几条。主人问"你记得多少"时用它。',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: outputText,
    async execute(_args, exec) {
      const { sea } = ctxOf(exec);
      const s = stats(sea);
      const lines = [
        `当前识海域：${sea}`,
        `识海节点：${s.nodes} 条（core ${s.levels.core} / important ${s.levels.important} / normal ${s.levels.normal}）`,
        `关联边：${s.edges} 条`,
        `日记：${s.diaryDays} 天`,
        `最早：${s.oldest || '—'}｜最新：${s.newest || '—'}`,
      ];
      if (s.effectiveTop.length) {
        lines.push('权重最高的几条：');
        for (const t of s.effectiveTop) lines.push(`  · ${t.text}（${t.eff}）`);
      }
      return lines.join('\n');
    },
  },
  {
    name: 'mind_consolidate',
    description: '夜间巩固：合并重复、淘汰快忘光的、可选按标签抽象规律。一般每天跑一次，不用频繁调。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { abstract: { type: 'boolean', description: '是否同时做按标签抽象（默认 false）' } },
    },
    output: outputText,
    async execute(args, exec) {
      const { sea } = ctxOf(exec);
      const r = consolidate(sea, { abstract: !!args.abstract });
      return `巩固完成（域 ${sea}）：${r.before} → ${r.after} 条｜合并 ${r.merged}｜淘汰 ${r.evicted}｜抽象 ${r.abstracted}`;
    },
  },
];

// Host 插件必须显式声明要用到的服务，否则 ctx.tools / ctx.systemPrompt 取不到
export const inject = ['tools', 'systemPrompt'];

export function apply(ctx) {
  for (const def of toolDefs) ctx.tools.register(def);

  // 常驻注入（默认）：全局人设 + global 域识海
  ctx.systemPrompt.section({
    name: 'dsh-mind-sea:recall',
    order: 62,
    text: () => {
      try { return renderSessionInjection(''); } catch { return ''; }
    },
  });

  // 按会话覆盖：绑定了专属人设/识海的会话，在同一 scope 注册同名 section（scoped 会 shadow 全局）
  ctx.on('agent/created', function (payload) {
    try {
      const sid = String((payload && payload.agent && payload.agent.id) || '');
      if (!sid) return;
      const b = getBinding(sid);
      if (b.profile === GLOBAL_PROFILE && b.sea === GLOBAL_SEA) return;
      const scope = this;
      if (!scope || !scope.systemPrompt || typeof scope.systemPrompt.section !== 'function') return;
      scope.systemPrompt.section({
        name: 'dsh-mind-sea:recall',
        order: 62,
        text: () => {
          try { return renderSessionInjection(sid); } catch { return ''; }
        },
      });
      console.log(`[dsh-mind-sea] 会话 ${sid} 已绑定 profile=${b.profile} sea=${b.sea}，挂上专属注入`);
    } catch (e) {
      console.log('[dsh-mind-sea] agent/created 处理失败：' + (e && e.message));
    }
  });

  console.log('[dsh-mind-sea] 已加载：识海工具 6 个 + 常驻注入');

  // ── 夜间自动巩固（无 cron 环境下的内置定时器） ──
  const lastRunKey = { v: '' };
  ctx.effect(() => {
    const timer = setInterval(() => {
      try {
        const c = loadConfig();
        if (!c.consolidateEnabled) return;
        const now = new Date();
        const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const dayKey = now.toISOString().slice(0, 10) + ' ' + hhmm;
        if (hhmm !== c.consolidateTime) return;
        if (lastRunKey.v === dayKey) return;
        lastRunKey.v = dayKey;
        const r = runConsolidateOnce();
        console.log(`[dsh-mind-sea] 夜间巩固完成：${r.before} → ${r.after}（合并 ${r.merged}，淘汰 ${r.evicted}，抽象 ${r.abstracted}）`);
      } catch (e) {
        console.log('[dsh-mind-sea] 巩固失败：' + (e && e.message));
      }
    }, 30 * 1000);
    return () => clearInterval(timer);
  }, 'dsh-mind-sea: nightly consolidate');

  // ── 重启补跑：App 重启后检查今天有没有巩固过，没有就补一次 ──
  ctx.effect(() => {
    const t = setTimeout(() => {
      try {
        const c = loadConfig();
        if (!c.consolidateEnabled) {
          console.log('[dsh-mind-sea] 启动检查：自动巩固已关闭，跳过');
          return;
        }
        const st = getState();
        const today = todayStr();
        if (st.lastConsolidateDate === today) {
          console.log('[dsh-mind-sea] 启动检查：今天已巩固过（' + (st.lastConsolidateAt || '').slice(0, 19) + '）');
          return;
        }
        const r = runConsolidateOnce();
        console.log(`[dsh-mind-sea] 启动补跑巩固（今天还没跑过）：${r.before} → ${r.after}，合并 ${r.merged}，淘汰 ${r.evicted}，抽象 ${r.abstracted}`);
      } catch (e) {
        console.log('[dsh-mind-sea] 启动补跑失败：' + (e && e.message));
      }
    }, 8000);
    return () => clearTimeout(t);
  }, 'dsh-mind-sea: boot catch-up');

  // ── 启动校对：检查绑定指向的会话是否还存在（未归档） ──
  ctx.effect(() => {
    const t = setTimeout(() => {
      try {
        const a = auditBindings();
        if (!a.ok) {
          console.log('[dsh-mind-sea] 启动校对跳过：' + a.reason);
          return;
        }
        if (a.orphans.length === 0) {
          console.log(`[dsh-mind-sea] 启动校对：${a.liveCount} 个未归档会话，绑定全部有效`);
        } else {
          console.log(`[dsh-mind-sea] 启动校对：发现 ${a.orphans.length} 条失效绑定（会话已不存在或已归档）：` +
            a.orphans.map((o) => o.sessionId).join(', '));
        }
      } catch (e) {
        console.log('[dsh-mind-sea] 启动校对失败：' + (e && e.message));
      }
    }, 9000);
    return () => clearTimeout(t);
  }, 'dsh-mind-sea: boot binding audit');

  // ── 设置页后端 API（同源 fetch，路径 /dsh-mind-sea/*） ──
  ctx.inject(['webServer'], (c) => {
    const json = (res, code, obj) => {
      const body = JSON.stringify(obj);
      res.statusCode = code;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(body);
    };
    const readBody = (req) => new Promise((resolve) => {
      let buf = '';
      req.on('data', (d) => { buf += d; });
      req.on('end', () => resolve(buf));
    });

    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/state',
      async handler(req, res) {
        try {
          const q = new URL(req.url || '/', 'http://x');
          const sea = q.searchParams.get('sea') || GLOBAL_SEA;
          const g = loadGraph(sea);
          const now = Date.now() / 1000;
          const nodes = [...g.nodes].sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0)).slice(0, 200)
            .map((n) => ({
              id: n.id, text: n.text, level: n.level, tags: n.tags || [],
              source: n.source, created: n.created, hits: n.hits || 0,
              eff: +((n.weight ?? 1) * (n.source === 'owner' ? 1.8 : 1) * Math.exp(-Math.max(0, (now - (n.updated || n.created || now)) / 86400) / (n.level === 'core' ? 3650 : n.level === 'important' ? 30 : 7))).toFixed(2),
            }));
          json(res, 200, {
            ok: true,
            sea,
            stats: stats(sea),
            config: loadConfig(),
            runState: getState(sea),
            seas: listSeas(),
            profiles: listProfiles(),
            bindings: loadBindings(),
            nodes,
            diary: diaryRead(sea, 20),
          });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/config',
      async handler(req, res) {
        try {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
          const body = await readBody(req);
          const patch = JSON.parse(body || '{}');
          json(res, 200, { ok: true, config: saveConfig(patch) });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/node',
      async handler(req, res) {
        try {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
          const p = JSON.parse(await readBody(req) || '{}');
          const op = String(p.op || 'add');
          const sea = p.sea || GLOBAL_SEA;
          const g = loadGraph(sea);
          if (op === 'add') {
            const r = remember(sea, p.text, p.level || 'core', p.tags || [], p.source || 'owner', '设置页写入');
            return json(res, 200, r.ok ? { ok: true, node: r.node } : { ok: false, error: r.error });
          }
          if (op === 'forget') {
            const before = g.nodes.length;
            g.nodes = g.nodes.filter((n) => n.id !== p.id);
            if (g.nodes.length === before) return json(res, 404, { ok: false, error: '没找到这条' });
            const alive = new Set(g.nodes.map((n) => n.id));
            g.edges = g.edges.filter(([a, b]) => alive.has(a) && alive.has(b));
            saveGraph(sea, g);
            return json(res, 200, { ok: true, removed: before - g.nodes.length });
          }
          if (op === 'level') {
            const n = g.nodes.find((x) => x.id === p.id);
            if (!n) return json(res, 404, { ok: false, error: '没找到这条' });
            if (!['core', 'important', 'normal'].includes(p.level)) {
              return json(res, 400, { ok: false, error: 'level 非法' });
            }
            n.level = p.level;
            n.weight = p.level === 'core' ? 10 : p.level === 'important' ? 3 : 1;
            n.updated = Date.now() / 1000;
            saveGraph(sea, g);
            return json(res, 200, { ok: true, node: n });
          }
          return json(res, 400, { ok: false, error: 'op 只能是 add/forget/level' });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    // ── 会话目录（供绑定页选择）：读 workspace.json + projcache 的标题 ──
    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/sessions',
      async handler(req, res) {
        try {
          const home = process.env.DSH_HOME || '';
          const wsFile = path.join(home, 'storages', 'workspace.json');
          const pcDir = path.join(home, 'storages', 'session_projcache', 'sessions');
          const bindings = loadBindings();
          const audit = readAudit();
          const orphanSet = new Set((audit.orphans || []).map((o) => o.sessionId));
          let ws = {};
          try { ws = JSON.parse(fs.readFileSync(wsFile, 'utf8')); } catch { /* ignore */ }
          const titleOf = (sid) => {
            try {
              const c = JSON.parse(fs.readFileSync(path.join(pcDir, sid + '.json'), 'utf8'));
              const t = c && c.record && c.record.rows && c.record.rows.title;
              return (t && t.val) || '';
            } catch { return ''; }
          };
          const out = [];
          const seen = new Set();
          const tables = (ws && ws.tables && ws.tables.workspaces) || {};
          for (const [wid, info] of Object.entries(tables)) {
            for (const sid of (info && info.sessionIds) || []) {
              if (seen.has(sid)) continue;
              seen.add(sid);
              const b = bindings[sid];
              out.push({
                id: sid,
                title: titleOf(sid) || sid,
                workspace: (info && info.title) || '',
                profile: (b && b.profile) || GLOBAL_PROFILE,
                sea: (b && b.sea) || GLOBAL_SEA,
                bound: !!b,
                orphan: orphanSet.has(sid),
              });
            }
          }
          // 已绑定但不在活动列表里的会话也带上
          for (const [sid, b] of Object.entries(bindings)) {
            if (seen.has(sid)) continue;
            out.push({
              id: sid, title: titleOf(sid) || sid, workspace: '',
              profile: b.profile || GLOBAL_PROFILE, sea: b.sea || GLOBAL_SEA, bound: true,
              orphan: orphanSet.has(sid),
            });
          }
          json(res, 200, { ok: true, sessions: out, audit, orphanCount: orphanSet.size });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    // ── 识海域 / 人设 / 会话绑定 ──
    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/seas',
      async handler(req, res) {
        try {
          if (req.method !== 'POST') return json(res, 200, { ok: true, seas: listSeas() });
          const p = JSON.parse(await readBody(req) || '{}');
          const op = String(p.op || 'list');
          if (op === 'create') return json(res, 200, createSea(p.name));
          if (op === 'delete') return json(res, 200, deleteSea(p.name));
          return json(res, 200, { ok: true, seas: listSeas() });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/profiles',
      async handler(req, res) {
        try {
          if (req.method !== 'POST') {
            const q = new URL(req.url || '/', 'http://x');
            const name = q.searchParams.get('name');
            if (name) return json(res, 200, { ok: true, name, text: readProfile(name) });
            return json(res, 200, { ok: true, profiles: listProfiles() });
          }
          const p = JSON.parse(await readBody(req) || '{}');
          const op = String(p.op || 'save');
          if (op === 'create') return json(res, 200, createProfile(p.name, p.text || ''));
          if (op === 'delete') return json(res, 200, deleteProfile(p.name));
          if (op === 'save') {
            const r = writeProfile(p.name, p.text || '');
            if (!r.ok) return json(res, 400, r);
            return json(res, 200, { ...r, profiles: listProfiles() });
          }
          return json(res, 400, { ok: false, error: 'op 只能是 create/delete/save' });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/bindings',
      async handler(req, res) {
        try {
          if (req.method !== 'POST') return json(res, 200, { ok: true, bindings: loadBindings() });
          const p = JSON.parse(await readBody(req) || '{}');
          const op = String(p.op || 'set');
          // 多项自选：sessions 数组一起绑到同一个 profile/sea
          const sessions = Array.isArray(p.sessions) ? p.sessions : (p.sessionId ? [p.sessionId] : []);
          if (op === 'recheck') {
            const a = auditBindings();
            return json(res, 200, { ok: a.ok, audit: a, bindings: loadBindings() });
          }
          if (op === 'prune') {
            const r = pruneOrphanBindings();
            return json(res, 200, { ok: true, ...r, audit: readAudit(), bindings: loadBindings() });
          }
          if (op === 'clear') {
            let removed = 0;
            for (const sid of sessions) removed += clearBinding(sid).removed || 0;
            return json(res, 200, { ok: true, removed, bindings: loadBindings() });
          }
          if (op === 'set') {
            let done = 0;
            const errors = [];
            for (const sid of sessions) {
              const r = setBinding(sid, { profile: p.profile, sea: p.sea });
              if (r.ok) done++; else errors.push(String(sid) + ': ' + r.error);
            }
            return json(res, 200, { ok: errors.length === 0, applied: done, errors, bindings: loadBindings() });
          }
          return json(res, 400, { ok: false, error: 'op 只能是 set/clear' });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    // ── L0 人设卡：读/存两份源文件 + 合并 + 应用到灵魂卡 ──
    const ROLES_DIR = path.join(process.env.DSH_HOME || (process.env.HOME || '') + '/.dsh', 'roles');
    const F_PERSONA = path.join(ROLES_DIR, '小鲸鱼.人格.md');
    const F_OPS = path.join(ROLES_DIR, '小鲸鱼.操作.md');
    const F_CARD = path.join(ROLES_DIR, '小鲸鱼.md');

    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/roles',
      async handler(req, res) {
        try {
          if (req.method === 'POST') {
            const p = JSON.parse(await readBody(req) || '{}');
            if (typeof p.persona === 'string') fs.writeFileSync(F_PERSONA, p.persona, 'utf8');
            if (typeof p.ops === 'string') fs.writeFileSync(F_OPS, p.ops, 'utf8');
            // 重新合并
            const strip = (t) => String(t || '').split('\n').filter((l) => !l.trimStart().startsWith('>')).join('\n').trim();
            const body = ['# 角色卡：小鲸鱼（汐玥）', '', strip(fs.readFileSync(F_PERSONA, 'utf8')), '', '---', '', strip(fs.readFileSync(F_OPS, 'utf8')), ''].join('\n');
            if (body.length > 6000) return json(res, 400, { ok: false, error: `合并后 ${body.length} 字，超过 6000 上限` });
            fs.writeFileSync(F_CARD, body, 'utf8');
            return json(res, 200, { ok: true, card: body, cardLen: body.length });
          }
          const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
          const card = read(F_CARD);
          json(res, 200, {
            ok: true,
            persona: read(F_PERSONA),
            ops: read(F_OPS),
            card,
            cardLen: card.length,
          });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/apply',
      async handler(req, res) {
        try {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
          const p = JSON.parse(await readBody(req) || '{}');
          const profile = p.profile || 'web';
          const home = process.env.DSH_HOME || (process.env.HOME || '') + '/.dsh';
          const yml = path.join(home, 'profiles', profile, 'cordis.patch.yml');
          let src = fs.readFileSync(yml, 'utf8');

          let card = '';
          try { card = fs.readFileSync(F_CARD, 'utf8'); } catch { /* ignore */ }
          if (!card.trim()) return json(res, 400, { ok: false, error: '合并卡为空，先点"重新合并"' });

          // 缩进 8 空格，写进 dsh-qq-bot.reply.stylePrompt
          const indented = card.replace(/\s+$/, '').split('\n')
            .map((ln) => (ln.trim() ? '        ' + ln : ''))
            .join('\n');

          const re = /(- id: dsh-qq-bot[\s\S]*?\n    reply:\n      stylePrompt: \|-\n)((?:        .*\n|\n)*)/;
          if (!re.test(src)) return json(res, 400, { ok: false, error: '在 cordis.patch.yml 里没找到 dsh-qq-bot.reply.stylePrompt 块' });

          const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
          fs.writeFileSync(yml + '.bak-' + stamp, src, 'utf8');
          src = src.replace(re, (m0, head) => head + indented + '\n');
          fs.writeFileSync(yml, src, 'utf8');
          json(res, 200, { ok: true, applied: indented.length, backup: yml + '.bak-' + stamp });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));

    c.effect(() => c.webServer.register({
      kind: 'exact',
      path: '/dsh-mind-sea/consolidate',
      async handler(req, res) {
        try {
          const q = new URL(req.url || '/', 'http://x');
          const sea = q.searchParams.get('sea') || GLOBAL_SEA;
          json(res, 200, { ok: true, result: runConsolidateOnce(sea) });
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }); }
      },
    }));
  });
}
