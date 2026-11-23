// dsh-mind-sea 数据层（多域版）
// L1 识海 + L2 日记，支持「识海领域(sea)」与「人设(profile)」按会话绑定。
//
//   $DSH_HOME/mind/
//     config.json            全局参数
//     bindings.json          { "<sessionId>": { profile, sea } }
//     profiles/global.md     全局人设（默认）
//     profiles/<id>.md       其他人设
//     seas/global/           全局识海
//       mind_graph.json
//       diary/riji.jsonl
//       state.json
//     seas/<id>/             其他识海
//
// 未绑定的会话一律走 global 域。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const MIND_DIR = path.join(HOME, 'mind');
const SEAS_DIR = path.join(MIND_DIR, 'seas');
const PROFILES_DIR = path.join(MIND_DIR, 'profiles');
const CONFIG_FILE = path.join(MIND_DIR, 'config.json');
const BINDINGS_FILE = path.join(MIND_DIR, 'bindings.json');

export const GLOBAL_SEA = 'global';
export const GLOBAL_PROFILE = 'global';

const LIMITS = {
  maxNodes: 5000,
  dailySelfMax: 8,
  recallTopN: 5,
  recallMaxChars: 400,
  recallThreshold: 0.25,
  edgeWeight: 0.6,
  consolidateSimilar: 0.78,
  evictWeight: 0.06,
};

const CONFIG_DEFAULTS = {
  injectionLimit: 12,
  recallTopN: 5,
  recallThreshold: 0.25,
  dailySelfMax: 8,
  autoDiaryHint: true,
  consolidateEnabled: true,
  consolidateTime: '23:50',
  abstractOnConsolidate: false,
  injectPersona: true,   // 是否把绑定的人设注入到会话提示
};

// 虚词（字符级）
const STOP_CHARS = new Set('的了是和与在有我你他她它这那也就都而及或如果因为所以但还又才很太更最不没要会能可以一个什么怎样吗呢吧啊呀哦嗯把被给对从到说做'.split(''));
// 通用口语词（词级）：命中它们不代表相关
const STOP_WORDS = new Set([
  '东西', '什么', '怎么', '可以', '我们', '你们', '他们', '这个', '那个', '这些', '那些',
  '时候', '地方', '事情', '问题', '现在', '知道', '觉得', '应该', '可能', '真的', '好像',
  '有点', '比较', '非常', '多少', '多久', '提过', '说过', '一下', '一点', '还是', '就是',
  '但是', '因为', '所以', '如果', '或者', '而且', '然后', '只是', '已经', '没有', '不是',
  '自己', '别人', '大家', '一样', '这样', '那样', '这里', '那里', '起来', '出来', '回来',
  '完全', '其实', '确实', '虽然', '于是', '因此', '另外', '同时', '例如', '比如', '等等',
  '一直', '总是', '经常', '偶尔', '一些', '之后', '之前', '以后', '以前',
]);

// ── 基础 IO ──
function safeId(id) {
  const s = String(id ?? '');
  return /^[A-Za-z0-9._-]{1,40}$/.test(s) ? s : null;
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function atomicWrite(p, text) {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch { /* ignore */ }
  const tmp = p + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, p);
}

export function seaDir(sea) {
  const s = safeId(sea) || GLOBAL_SEA;
  return path.join(SEAS_DIR, s);
}
function graphPath(sea) { return path.join(seaDir(sea), 'mind_graph.json'); }
function diaryDir(sea) { return path.join(seaDir(sea), 'diary'); }
function diaryFile(sea) { return path.join(diaryDir(sea), 'riji.jsonl'); }
function statePath(sea) { return path.join(seaDir(sea), 'state.json'); }
export function profilePath(name) {
  const s = safeId(name) || GLOBAL_PROFILE;
  return path.join(PROFILES_DIR, s + '.md');
}

// ── 配置 ──
export function loadConfig() {
  const c = readJson(CONFIG_FILE, null);
  return { ...CONFIG_DEFAULTS, ...(c && typeof c === 'object' ? c : {}) };
}

export function saveConfig(patch) {
  const cur = loadConfig();
  const next = { ...cur };
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in CONFIG_DEFAULTS)) continue;
    if (typeof CONFIG_DEFAULTS[k] === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) next[k] = n;
    } else if (typeof CONFIG_DEFAULTS[k] === 'boolean') {
      next[k] = !!v;
    }
  }
  atomicWrite(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

// ── 绑定（会话 → 域） ──
export function loadBindings() {
  const b = readJson(BINDINGS_FILE, null);
  return (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
}

export function saveBindings(b) {
  atomicWrite(BINDINGS_FILE, JSON.stringify(b, null, 2));
  return b;
}

export function getBinding(sessionId) {
  const b = loadBindings();
  const v = b[String(sessionId || '')];
  if (!v || typeof v !== 'object') return { profile: GLOBAL_PROFILE, sea: GLOBAL_SEA };
  return {
    profile: safeId(v.profile) || GLOBAL_PROFILE,
    sea: safeId(v.sea) || GLOBAL_SEA,
  };
}

export function setBinding(sessionId, patch) {
  const sid = String(sessionId || '').trim();
  if (!sid) return { ok: false, error: 'sessionId 不能为空' };
  const b = loadBindings();
  const cur = b[sid] && typeof b[sid] === 'object' ? b[sid] : {};
  const next = { ...cur };
  if (patch && 'profile' in patch) {
    const p = safeId(patch.profile);
    if (!p) return { ok: false, error: 'profile 名字非法' };
    next.profile = p;
  }
  if (patch && 'sea' in patch) {
    const s = safeId(patch.sea);
    if (!s) return { ok: false, error: 'sea 名字非法' };
    next.sea = s;
  }
  b[sid] = next;
  saveBindings(b);
  return { ok: true, binding: next };
}

export function clearBinding(sessionId) {
  const b = loadBindings();
  const sid = String(sessionId || '');
  if (!(sid in b)) return { ok: true, removed: 0 };
  delete b[sid];
  saveBindings(b);
  return { ok: true, removed: 1 };
}

// ── 绑定校对：找出「绑了但会话已不存在（或已归档）」的失效绑定 ──
const AUDIT_FILE = path.join(MIND_DIR, 'audit.json');

/** 读 workspace.json，拿到当前未归档的会话 id 集合（读不到时返回 null 表示无法判断） */
export function liveSessionIds() {
  try {
    const wsFile = path.join(HOME, 'storages', 'workspace.json');
    const ws = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
    const archived = new Set(Array.isArray(ws?.global?.archivedSessionIds) ? ws.global.archivedSessionIds : []);
    const live = new Set();
    const tables = (ws && ws.tables && ws.tables.workspaces) || {};
    for (const info of Object.values(tables)) {
      for (const sid of (info && info.sessionIds) || []) {
        if (!archived.has(sid)) live.add(String(sid));
      }
    }
    return live;
  } catch {
    return null;
  }
}

/** 校对：bindings 里指向不存在/已归档会话的条目 = 失效 */
export function auditBindings() {
  const live = liveSessionIds();
  const bindings = loadBindings();
  if (live === null) {
    const prev = readJson(AUDIT_FILE, null) || {};
    return { ok: false, reason: '读不到 workspace.json，跳过校对', orphans: prev.orphans || [], checkedAt: '' };
  }
  const orphans = [];
  for (const [sid, b] of Object.entries(bindings)) {
    if (live.has(sid)) continue;
    orphans.push({
      sessionId: sid,
      profile: (b && b.profile) || GLOBAL_PROFILE,
      sea: (b && b.sea) || GLOBAL_SEA,
    });
  }
  const result = { ok: true, checkedAt: new Date().toISOString(), liveCount: live.size, orphans };
  atomicWrite(AUDIT_FILE, JSON.stringify(result, null, 2));
  return result;
}

export function readAudit() {
  const a = readJson(AUDIT_FILE, null);
  return {
    checkedAt: '',
    orphans: [],
    ...(a && typeof a === 'object' ? a : {}),
  };
}

/** 一键清掉失效绑定 */
export function pruneOrphanBindings() {
  const a = auditBindings();
  const b = loadBindings();
  let removed = 0;
  for (const o of a.orphans) {
    if (o.sessionId in b) { delete b[o.sessionId]; removed++; }
  }
  if (removed) saveBindings(b);
  const after = auditBindings();
  return { ok: true, removed, remaining: after.orphans.length };
}

// ── 识海领域 ──
export function listSeas() {
  try {
    const names = fs.readdirSync(SEAS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => safeId(n));
    if (!names.includes(GLOBAL_SEA)) names.unshift(GLOBAL_SEA);
    const b = loadBindings();
    return names.map((name) => {
      const g = loadGraph(name);
      const bound = Object.entries(b).filter(([, v]) => v && v.sea === name).length;
      return { name, nodes: g.nodes.length, edges: g.edges.length, bound, isGlobal: name === GLOBAL_SEA };
    });
  } catch {
    return [{ name: GLOBAL_SEA, nodes: 0, edges: 0, bound: 0, isGlobal: true }];
  }
}

export function createSea(name) {
  const s = safeId(name);
  if (!s) return { ok: false, error: '名字只能用字母/数字/._-，最长 40' };
  if (s === GLOBAL_SEA) return { ok: false, error: 'global 已存在' };
  const dir = seaDir(s);
  if (fs.existsSync(dir)) return { ok: false, error: '同名识海已存在' };
  fs.mkdirSync(path.join(dir, 'diary'), { recursive: true });
  atomicWrite(graphPath(s), JSON.stringify({ version: 1, nodes: [], edges: [] }, null, 2));
  return { ok: true, name: s };
}

export function deleteSea(name) {
  const s = safeId(name);
  if (!s) return { ok: false, error: '名字非法' };
  if (s === GLOBAL_SEA) return { ok: false, error: '不能删除 global' };
  const dir = seaDir(s);
  if (!fs.existsSync(dir)) return { ok: false, error: '没有这个识海' };
  fs.rmSync(dir, { recursive: true, force: true });
  const b = loadBindings();
  let changed = false;
  for (const [sid, v] of Object.entries(b)) {
    if (v && v.sea === s) { delete v.sea; changed = true; }
    if (v && Object.keys(v).length === 0) { delete b[sid]; changed = true; }
  }
  if (changed) saveBindings(b);
  return { ok: true };
}

// ── 人设 ──
export function listProfiles() {
  const b = loadBindings();
  const out = [{
    name: GLOBAL_PROFILE,
    chars: readProfile(GLOBAL_PROFILE).length,
    bound: Object.entries(b).filter(([, v]) => v && v.profile === GLOBAL_PROFILE).length,
    isGlobal: true,
  }];
  try {
    for (const f of fs.readdirSync(PROFILES_DIR)) {
      if (!f.endsWith('.md')) continue;
      const name = f.slice(0, -3);
      if (!safeId(name) || name === GLOBAL_PROFILE) continue;
      out.push({
        name,
        chars: readProfile(name).length,
        bound: Object.entries(b).filter(([, v]) => v && v.profile === name).length,
        isGlobal: false,
      });
    }
  } catch { /* ignore */ }
  return out;
}

export function readProfile(name) {
  try { return fs.readFileSync(profilePath(name), 'utf8'); } catch { return ''; }
}

export function writeProfile(name, text) {
  const s = safeId(name);
  if (!s) return { ok: false, error: '人设名字非法' };
  atomicWrite(profilePath(s), String(text || ''));
  return { ok: true, name: s, chars: String(text || '').length };
}

export function createProfile(name, text = '') {
  const s = safeId(name);
  if (!s) return { ok: false, error: '名字只能用字母/数字/._-，最长 40' };
  if (s === GLOBAL_PROFILE) return { ok: false, error: 'global 已存在' };
  if (fs.existsSync(profilePath(s))) return { ok: false, error: '同名已存在' };
  writeProfile(s, text);
  return { ok: true, name: s };
}

export function deleteProfile(name) {
  const s = safeId(name);
  if (!s) return { ok: false, error: '名字非法' };
  if (s === GLOBAL_PROFILE) return { ok: false, error: '不能删除 global' };
  try { fs.unlinkSync(profilePath(s)); } catch { return { ok: false, error: '没有这个人设' }; }
  const b = loadBindings();
  let changed = false;
  for (const [sid, v] of Object.entries(b)) {
    if (v && v.profile === s) { delete v.profile; changed = true; }
    if (v && Object.keys(v).length === 0) { delete b[sid]; changed = true; }
  }
  if (changed) saveBindings(b);
  return { ok: true };
}

// ── 识海读写（按域） ──
export function loadGraph(sea = GLOBAL_SEA) {
  const s = safeId(sea) || GLOBAL_SEA;
  const g = readJson(graphPath(s), null);
  if (!g || !Array.isArray(g.nodes)) return { version: 1, nodes: [], edges: [] };
  if (!Array.isArray(g.edges)) g.edges = [];
  return g;
}

export function saveGraph(sea, g) {
  const s = safeId(sea) || GLOBAL_SEA;
  atomicWrite(graphPath(s), JSON.stringify(g, null, 2));
}

function baseWeight(level) {
  if (level === 'core') return 10;
  if (level === 'important') return 3;
  return 1;
}
function halfLife(level) {
  if (level === 'core') return 3650;
  if (level === 'important') return 30;
  return 7;
}

export function effectiveWeight(node, nowSec = Date.now() / 1000) {
  const days = Math.max(0, (nowSec - (node.updated || node.created || nowSec)) / 86400);
  const decay = Math.exp(-days / halfLife(node.level));
  const boost = node.source === 'owner' ? 1.8 : 1;
  return (node.weight ?? baseWeight(node.level)) * boost * decay;
}

function makeId() {
  return 'n' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export function remember(sea, text, level = 'normal', tags = [], source = 'self', raw = '') {
  const s = safeId(sea) || GLOBAL_SEA;
  const t = String(text || '').trim();
  if (!t) return { ok: false, error: 'text 不能为空' };
  if (t.length > 200) return { ok: false, error: '单条事实 ≤200 字' };
  const lv = ['core', 'important', 'normal'].includes(level) ? level : 'normal';
  if (source === 'self' && lv === 'core') {
    return { ok: false, error: '她不能自己写 core，core 需要主人确认后由管理侧写入' };
  }
  const g = loadGraph(s);
  if (source === 'self') {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const n = g.nodes.filter((x) => x.source === 'self' && (x.created * 1000) >= dayStart.getTime()).length;
    const cap = loadConfig().dailySelfMax;
    if (n >= cap) return { ok: false, error: `这个识海今天已经记了 ${n} 条（上限 ${cap}），明天再说` };
  }
  const now = Date.now() / 1000;
  const node = {
    id: makeId(), text: t, level: lv,
    tags: (Array.isArray(tags) ? tags : []).filter(Boolean).slice(0, 8),
    source: ['owner', 'self', 'group', 'web'].includes(source) ? source : 'self',
    created: now, updated: now,
    weight: baseWeight(lv), hits: 0,
    raw: String(raw || '').slice(0, 80),
  };
  g.nodes.push(node);
  for (const other of g.nodes) {
    if (other.id === node.id) continue;
    const shared = node.tags.filter((x) => (other.tags || []).includes(x));
    if (shared.length) g.edges.push([node.id, other.id, LIMITS.edgeWeight, shared[0]]);
  }
  if (g.nodes.length > LIMITS.maxNodes) {
    const nowSec = Date.now() / 1000;
    g.nodes.sort((a, b) => effectiveWeight(b, nowSec) - effectiveWeight(a, nowSec));
    const keep = new Set(g.nodes.slice(0, LIMITS.maxNodes).map((x) => x.id));
    g.nodes = g.nodes.filter((x) => keep.has(x.id));
  }
  saveGraph(s, g);
  return { ok: true, node, sea: s };
}

export function tokenize(q) {
  const s = String(q || '').toLowerCase();
  const out = new Set();
  for (const m of s.matchAll(/[a-z0-9_]{2,}/g)) out.add(m[0]);
  const cn = s.replace(/[^\u4e00-\u9fa5]+/g, ' ');
  for (const chunk of cn.split(/\s+/)) {
    if (!chunk) continue;
    for (let i = 0; i + 1 < chunk.length; i++) {
      const w = chunk.slice(i, i + 2);
      if (!STOP_CHARS.has(w[0]) && !STOP_CHARS.has(w[1]) && !STOP_WORDS.has(w)) out.add(w);
    }
    // 单字不参与召回：几乎能命中任何句子，会造成"记得"的错觉
  }
  return [...out];
}

export function recall(sea, query, topN = null, opts = {}) {
  const s = safeId(sea) || GLOBAL_SEA;
  if (topN === null) topN = loadConfig().recallTopN;
  const g = loadGraph(s);
  const toks = tokenize(query);
  if (!toks.length || !g.nodes.length) return [];
  const nowSec = Date.now() / 1000;

  const score = new Map();
  const hitNodes = [];
  for (const n of g.nodes) {
    const text = (n.text + ' ' + (n.tags || []).join(' ') + ' ' + (n.raw || '')).toLowerCase();
    const hitTok = toks.filter((t) => text.includes(t));
    if (!hitTok.length) continue;
    const effective = hitTok.filter((t) => !hitTok.some((o) => o !== t && o.length > t.length && o.includes(t)));
    const hits = effective.length;
    const rel = hits / Math.min(toks.length, 4);
    score.set(n.id, { rel });
    hitNodes.push(n.id);
  }
  if (!score.size) return [];

  let frontier = hitNodes.map((id) => ({ id, s: 1 }));
  for (let hop = 1; hop <= 2; hop++) {
    const next = [];
    for (const { id, s: sc } of frontier) {
      for (const [a, b, w] of g.edges) {
        let other = null;
        if (a === id) other = b;
        else if (b === id) other = a;
        else continue;
        const cand = sc * (w ?? LIMITS.edgeWeight);
        const prev = score.get(other);
        if (!prev) {
          score.set(other, { rel: cand * 0.5 });
          next.push({ id: other, s: cand });
        } else if (prev.rel < cand * 0.5) {
          prev.rel = cand * 0.5;
          next.push({ id: other, s: cand });
        }
      }
    }
    frontier = next;
  }

  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const ranked = [];
  for (const [id, { rel }] of score) {
    const n = byId.get(id);
    if (!n) continue;
    const eff = effectiveWeight(n, nowSec);
    const final = rel * (0.5 + Math.min(eff, 12) / 24);
    if (final <= (opts.threshold ?? loadConfig().recallThreshold)) continue;
    ranked.push({ node: n, score: final });
  }
  ranked.sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, topN).map((x) => x.node);

  if (top.length && !opts.dryRun) {
    for (const n of top) {
      n.hits = (n.hits || 0) + 1;
      n.weight = (n.weight ?? baseWeight(n.level)) + 0.08;
      n.updated = nowSec;
    }
    saveGraph(s, g);
  }
  return top;
}

export function consolidate(sea, opts = {}) {
  const s = safeId(sea) || GLOBAL_SEA;
  const g = loadGraph(s);
  const nowSec = Date.now() / 1000;
  const before = g.nodes.length;
  let merged = 0;
  let evicted = 0;

  const sim = (a, b) => {
    const A = new Set(tokenize(a));
    const B = new Set(tokenize(b));
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    return inter / Math.min(A.size, B.size);
  };

  const kept = [];
  for (const n of g.nodes) {
    if (n.level === 'core') { kept.push(n); continue; }
    const dup = kept.find((k) => k.level === n.level && sim(k.text, n.text) >= LIMITS.consolidateSimilar);
    if (dup) {
      if ((n.weight || 0) > (dup.weight || 0)) { dup.text = n.text; dup.weight = n.weight; }
      dup.hits = (dup.hits || 0) + (n.hits || 0);
      dup.updated = Math.max(dup.updated || 0, n.updated || 0);
      merged++;
      continue;
    }
    if (n.level !== 'core' && effectiveWeight(n, nowSec) < LIMITS.evictWeight) { evicted++; continue; }
    kept.push(n);
  }

  g.nodes = kept;
  const alive = new Set(kept.map((n) => n.id));
  g.edges = g.edges.filter(([a, b]) => alive.has(a) && alive.has(b));

  let abstracted = 0;
  if (opts.abstract) {
    const byTag = new Map();
    for (const n of kept) {
      for (const t of n.tags || []) {
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t).push(n);
      }
    }
    for (const [tag, list] of byTag) {
      if (list.length < 3) continue;
      if (list.some((n) => n.tags?.includes('抽象:' + tag))) continue;
      const text = `关于「${tag}」：${list.slice(0, 5).map((n) => n.text).join('；')}`.slice(0, 200);
      kept.push({
        id: makeId(), text, level: 'important', tags: [tag, '抽象:' + tag],
        source: 'self', created: nowSec, updated: nowSec,
        weight: baseWeight('important'), hits: 0, raw: '夜间巩固自动抽象',
      });
      abstracted++;
    }
    g.nodes = kept;
  }

  saveGraph(s, g);
  return { sea: s, before, after: g.nodes.length, merged, evicted, abstracted };
}

export function stats(sea = GLOBAL_SEA) {
  const s = safeId(sea) || GLOBAL_SEA;
  const g = loadGraph(s);
  const nowSec = Date.now() / 1000;
  const dist = { core: 0, important: 0, normal: 0 };
  for (const n of g.nodes) dist[n.level] = (dist[n.level] || 0) + 1;
  const sorted = [...g.nodes].sort((a, b) => (a.created || 0) - (b.created || 0));
  return {
    sea: s,
    nodes: g.nodes.length,
    edges: g.edges.length,
    levels: dist,
    oldest: sorted[0]?.created ? new Date(sorted[0].created * 1000).toISOString() : null,
    newest: sorted.length ? new Date(sorted[sorted.length - 1].created * 1000).toISOString() : null,
    diaryDays: countDiaryDays(s),
    effectiveTop: g.nodes
      .map((n) => ({ text: n.text.slice(0, 40), eff: +effectiveWeight(n, nowSec).toFixed(2) }))
      .sort((a, b) => b.eff - a.eff)
      .slice(0, 5),
  };
}

export function diaryWrite(sea, mood, content, at) {
  const s = safeId(sea) || GLOBAL_SEA;
  const text = String(content || '').trim();
  if (!text) return { ok: false, error: '内容不能为空' };
  if (text.length > 300) return { ok: false, error: '单条日记 ≤300 字' };
  try { fs.mkdirSync(diaryDir(s), { recursive: true }); } catch { /* ignore */ }
  const when = at || new Date().toISOString().slice(0, 16).replace('T', ' ');
  const line = JSON.stringify({ 时间: when, 心情: String(mood || '平常'), 内容: text });
  fs.appendFileSync(diaryFile(s), line + '\n', 'utf8');
  return { ok: true, when, sea: s };
}

export function diaryRead(sea, limit = 20) {
  const s = safeId(sea) || GLOBAL_SEA;
  try {
    const lines = fs.readFileSync(diaryFile(s), 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

function countDiaryDays(sea) {
  const all = diaryRead(sea, 100000);
  return new Set(all.map((x) => String(x.时间 || '').slice(0, 10))).size;
}

// ── 巩固状态（按域） ──
export function getState(sea = GLOBAL_SEA) {
  const st = readJson(statePath(sea), null);
  return { lastConsolidateDate: '', lastConsolidateAt: '', ...(st && typeof st === 'object' ? st : {}) };
}

export function setState(sea, patch) {
  const next = { ...getState(sea), ...(patch || {}) };
  atomicWrite(statePath(sea), JSON.stringify(next, null, 2));
  return next;
}

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function runConsolidateOnce(sea = GLOBAL_SEA, opts = {}) {
  const cfg = loadConfig();
  const r = consolidate(sea, { abstract: !!cfg.abstractOnConsolidate, ...opts });
  const now = new Date();
  setState(sea, { lastConsolidateDate: todayStr(now), lastConsolidateAt: now.toISOString() });
  return r;
}

// ── 注入渲染 ──
export function renderInjection(sea = GLOBAL_SEA, limit = null) {
  if (limit === null) limit = loadConfig().injectionLimit;
  const g = loadGraph(sea);
  const nowSec = Date.now() / 1000;
  const core = g.nodes.filter((n) => n.level === 'core');
  const imp = g.nodes
    .filter((n) => n.level === 'important')
    .sort((a, b) => effectiveWeight(b, nowSec) - effectiveWeight(a, nowSec))
    .slice(0, Math.max(0, limit - core.length));
  const list = [...core, ...imp];
  if (!list.length) return '';
  let out = `## 识海·她记得的事（域：${sea}）\n` + list.map((n) => `- ${n.text}`).join('\n');
  out += '\n\n> 这只是常驻的少数几条。更细的事用 `mind_recall` 按话题检索，想起来后可用 `mind_remember` 补记。';
  return out;
}

/** 某个会话该用的完整注入文本：绑定的人设 + 该域的识海 */
export function renderSessionInjection(sessionId) {
  const { profile, sea } = getBinding(sessionId);
  const cfg = loadConfig();
  const parts = [];
  if (cfg.injectPersona) {
    const personaText = readProfile(profile);
    if (personaText.trim()) parts.push(`## 当前会话人设（${profile}）\n${personaText.trim()}`);
  }
  const seaText = renderInjection(sea);
  if (seaText) parts.push(seaText);
  return parts.join('\n\n');
}

export { LIMITS, CONFIG_DEFAULTS, MIND_DIR, SEAS_DIR, PROFILES_DIR, graphPath, diaryFile, statePath };
