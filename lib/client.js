// dsh-mind-sea — 设置页（browser half，多页版）
// 挂到「插件 → 已安装 → 小鲸鱼识海」。
// 页签：概览 / 识海 / 人设 / 绑定 / 参数
window.__ModuleLoader__.load({
  id: 'dsh-mind-sea',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    var React = require('react');
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useCallback = React.useCallback;

    var API = '/dsh-mind-sea';
    function todayStr() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function post(path, body) {
      return fetch(API + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(function (r) { return r.json(); });
    }

    var css =
      '.ms-page{display:flex;flex-direction:column;gap:14px;padding:2px 2px 28px;box-sizing:border-box;max-width:780px}' +
      '.ms-page *{box-sizing:border-box}' +
      '.ms-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18));padding-bottom:8px}' +
      '.ms-tab{border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,inherit);border-radius:9px;padding:6px 14px;font-size:13px;cursor:pointer}' +
      '.ms-tab:hover{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.08))}' +
      '.ms-tab.on{background:var(--dsw-alias-brand-primary,#4a7dff);color:#fff;font-weight:600}' +
      '.ms-card{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18));border-radius:12px;padding:14px 16px;background:var(--dsw-alias-bg-layer-1,transparent)}' +
      '.ms-title{font-weight:600;font-size:13.5px;color:var(--dsw-alias-label-primary,inherit);margin:0 0 4px}' +
      '.ms-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary,inherit);line-height:1.6;margin:0}' +
      '.ms-hint{font-size:11px;color:var(--dsw-alias-label-secondary,inherit);line-height:1.55;margin-top:4px}' +
      '.ms-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.12))}' +
      '.ms-row:first-of-type{border-top:0}' +
      '.ms-label{font-size:12.5px;color:var(--dsw-alias-label-primary,inherit)}' +
      '.ms-num{width:74px;padding:5px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font-size:12.5px;text-align:right}' +
      '.ms-btn{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.06));color:inherit;border-radius:9px;padding:6px 13px;font-size:12.5px;cursor:pointer}' +
      '.ms-btn:hover{background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.12))}' +
      '.ms-btn:disabled{opacity:.5;cursor:default}' +
      '.ms-btn.primary{background:var(--dsw-alias-brand-primary,#4a7dff);border-color:transparent;color:#fff}' +
      '.ms-btn.danger{color:var(--dsw-alias-state-error-primary,#e5484d)}' +
      '.ms-btn.sm{padding:3px 9px;font-size:11.5px;border-radius:7px}' +
      '.ms-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18));border-radius:12px;overflow:hidden}' +
      '.ms-item{display:flex;gap:10px;align-items:flex-start;padding:10px 13px;border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.12))}' +
      '.ms-item:first-child{border-top:0}' +
      '.ms-item-body{flex:1;min-width:0}' +
      '.ms-item-text{font-size:12.5px;line-height:1.55;color:var(--dsw-alias-label-primary,inherit);word-break:break-word}' +
      '.ms-item-meta{font-size:10.5px;color:var(--dsw-alias-label-secondary,inherit);margin-top:3px;word-break:break-all}' +
      '.ms-pill{display:inline-block;font-size:10px;padding:1.5px 7px;border-radius:999px;margin-right:6px;border:1px solid currentColor;opacity:.85}' +
      '.ms-pill.core{color:var(--dsw-alias-brand-primary,#4a7dff)}' +
      '.ms-pill.important{color:var(--dsw-alias-state-warning-primary,#f5a524)}' +
      '.ms-pill.normal{color:var(--dsw-alias-label-secondary,inherit)}' +
      '.ms-pill.on{background:var(--dsw-alias-brand-primary,#4a7dff);color:#fff;border-color:transparent;opacity:1}' +
      '.ms-ok{font-size:11.5px;color:var(--dsw-alias-state-success-primary,#30a46c)}' +
      '.ms-err{font-size:11.5px;color:var(--dsw-alias-state-error-primary,#e5484d)}' +
      '.ms-ta{width:100%;min-height:80px;padding:8px 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font-size:12.5px;font-family:inherit;resize:vertical}' +
      '.ms-select{padding:5px 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font-size:12.5px}' +
      '.ms-diary{font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary,inherit);white-space:pre-wrap}' +
      '.ms-flex{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.ms-scroll{max-height:340px;overflow:auto}' +
      '.ms-chk{width:15px;height:15px;margin-top:2px;flex:none}' +
      '.ms-item.bad{background:rgba(229,72,77,.07)}' +
      '.ms-item.bad .ms-item-text{color:var(--dsw-alias-state-error-primary,#e5484d)}' +
      '.ms-warn{border:1px solid var(--dsw-alias-state-warning-primary,#f5a524);border-radius:12px;padding:10px 14px;background:rgba(245,165,36,.08)}' +
      '.ms-badge-bad{display:inline-block;font-size:10px;padding:1.5px 7px;border-radius:999px;margin-right:6px;background:var(--dsw-alias-state-error-primary,#e5484d);color:#fff}';

    exports.inject = ['slots'];
    exports.apply = function apply(ctx) {
      var slots = ctx.get('slots');
      if (slots === undefined) return;

      ctx.effect(function () {
        var s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
        return function () { s.remove(); };
      });

      function Page() {
        var [tab, setTab] = useState('overview');
        var [state, setState] = useState(null);
        var [cfg, setCfg] = useState(null);
        var [sea, setSea] = useState('global');
        var [sessions, setSessions] = useState([]);
        var [audit, setAudit] = useState(null);
        var [personaName, setPersonaName] = useState('global');
        var [personaText, setPersonaText] = useState('');
        var [picked, setPicked] = useState({});
        var [bindProfile, setBindProfile] = useState('global');
        var [bindSea, setBindSea] = useState('global');
        var [draft, setDraft] = useState('');
        var [draftLevel, setDraftLevel] = useState('core');
        var [newName, setNewName] = useState('');
        var [busy, setBusy] = useState(false);
        var [msg, setMsg] = useState('');
        var [err, setErr] = useState('');

        var load = useCallback(function (s) {
          var target = s || 'global';
          fetch(API + '/state?sea=' + encodeURIComponent(target))
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!d.ok) { setErr(d.error || '读取失败'); return; }
              setState(d); setCfg(d.config); setErr('');
            })
            .catch(function (e) { setErr(String(e)); });
          fetch(API + '/sessions')
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!d.ok) return;
              setSessions(d.sessions || []);
              setAudit(d.audit || null);
            })
            .catch(function () {});
        }, []);

        useEffect(function () { load(sea); }, [sea, load]);

        useEffect(function () {
          fetch(API + '/profiles?name=' + encodeURIComponent(personaName))
            .then(function (r) { return r.json(); })
            .then(function (d) { if (d.ok) setPersonaText(d.text || ''); })
            .catch(function () {});
        }, [personaName]);

        function act(promise, okText) {
          setBusy(true); setMsg(''); setErr('');
          promise.then(function (d) {
            setBusy(false);
            if (d && d.ok === false) setErr(d.error || '失败');
            else { if (okText) setMsg(okText); load(sea); }
            return d;
          }).catch(function (e) { setBusy(false); setErr(String(e)); });
        }

        if (!state) return h('div', { className: 'ms-page' }, h('div', { className: 'ms-card' }, h('p', { className: 'ms-sub' }, err || '读取识海中…')));

        var st = state.stats;
        var seas = state.seas || [{ name: 'global', nodes: 0, bound: 0, isGlobal: true }];
        var profiles = state.profiles || [{ name: 'global', chars: 0, bound: 0, isGlobal: true }];
        var runState = state.runState || {};

        var tabs = [
          ['overview', '概览'], ['sea', '识海'], ['persona', '人设'], ['bind', '绑定'], ['config', '参数'],
        ];

        var tabBar = h('div', { className: 'ms-tabs' }, tabs.map(function (t) {
          return h('button', {
            key: t[0],
            className: 'ms-tab' + (tab === t[0] ? ' on' : ''),
            onClick: function () { setTab(t[0]); setMsg(''); setErr(''); },
          }, t[1]);
        }));

        // ── 概览 ──
        var overview = h('div', { className: 'ms-card' },
          h('p', { className: 'ms-title' }, '识海概览 · 域 ' + st.sea),
          h('p', { className: 'ms-sub' },
            st.nodes + ' 条记忆（core ' + st.levels.core + ' / important ' + st.levels.important + ' / normal ' + st.levels.normal + '）· ' +
            st.edges + ' 条关联 · 日记 ' + st.diaryDays + ' 天'),
          st.oldest ? h('p', { className: 'ms-hint' }, '最早 ' + st.oldest.slice(0, 10) + ' ｜ 最新 ' + (st.newest || '').slice(0, 10)) : null,
          h('p', { className: 'ms-hint' },
            runState.lastConsolidateDate === todayStr()
              ? '上次巩固：今天 ' + String(runState.lastConsolidateAt || '').slice(11, 16) + '（今天已覆盖）'
              : '上次巩固：' + (runState.lastConsolidateDate || '从未跑过') + '（今天还没跑）'),
          h('div', { className: 'ms-flex', style: { marginTop: 12 } },
            h('button', { className: 'ms-btn', disabled: busy, onClick: function () { act(post('/consolidate?sea=' + encodeURIComponent(sea)), '巩固完成'); } }, '巩固一次'),
            h('button', { className: 'ms-btn', disabled: busy, onClick: function () { load(sea); } }, '刷新')),
          h('p', { className: 'ms-hint', style: { marginTop: 10 } },
            '共 ' + seas.length + ' 个识海域、' + profiles.length + ' 份人设；' +
            sessions.filter(function (s) { return s.bound; }).length + ' 个会话已绑定专属域。')
        );

        // ── 识海 ──
        var seaPage = h('div', null,
          h('div', { className: 'ms-card' },
            h('p', { className: 'ms-title' }, '识海域'),
            h('p', { className: 'ms-sub' }, '每个域是一套独立的记忆。多个会话可以共用一个域。'),
            h('div', { className: 'ms-list', style: { marginTop: 10 } },
              seas.map(function (s) {
                return h('div', { className: 'ms-item', key: s.name },
                  h('div', { className: 'ms-item-body' },
                    h('div', { className: 'ms-item-text' },
                      h('span', { className: 'ms-pill' + (sea === s.name ? ' on' : '') }, sea === s.name ? '当前' : '切换'),
                      s.name + (s.isGlobal ? '（全局）' : '')),
                    h('div', { className: 'ms-item-meta' }, s.nodes + ' 条 · ' + s.edges + ' 关联 · ' + s.bound + ' 个会话共用')),
                  h('div', { className: 'ms-flex' },
                    h('button', { className: 'ms-btn sm', onClick: function () { setSea(s.name); setMsg(''); } }, '查看'),
                    s.isGlobal ? null : h('button', {
                      className: 'ms-btn sm danger', disabled: busy,
                      onClick: function () { if (confirm('删除识海 ' + s.name + '？里面的记忆会一起没。')) act(post('/seas', { op: 'delete', name: s.name }), '已删除'); },
                    }, '删除')));
              })),
            h('div', { className: 'ms-flex', style: { marginTop: 10 } },
              h('input', { className: 'ms-select', style: { flex: 1 }, placeholder: '新识海名字（字母/数字/._-）', value: newName, onChange: function (e) { setNewName(e.target.value); } }),
              h('button', { className: 'ms-btn primary', disabled: busy || !newName.trim(), onClick: function () { act(post('/seas', { op: 'create', name: newName.trim() }), '已新建'); setNewName(''); } }, '新建识海'))
          ),
          h('div', { className: 'ms-card' },
            h('p', { className: 'ms-title' }, '手动记一条（写入域 ' + sea + '）'),
            h('textarea', { className: 'ms-ta', value: draft, placeholder: '一条事实，≤200 字，一条只放一件事', onChange: function (e) { setDraft(e.target.value); } }),
            h('div', { className: 'ms-flex', style: { marginTop: 8 } },
              h('select', { className: 'ms-select', value: draftLevel, onChange: function (e) { setDraftLevel(e.target.value); } },
                h('option', { value: 'core' }, 'core'), h('option', { value: 'important' }, 'important'), h('option', { value: 'normal' }, 'normal')),
              h('button', {
                className: 'ms-btn primary', disabled: busy || !draft.trim(),
                onClick: function () { act(post('/node', { op: 'add', sea: sea, text: draft, level: draftLevel, source: 'owner', tags: [] }), '已记下'); setDraft(''); },
              }, '记下'))
          ),
          h('div', { className: 'ms-card', style: { padding: 0, border: 'none', background: 'transparent' } },
            h('p', { className: 'ms-title', style: { marginBottom: 10 } }, '记忆列表（域 ' + sea + '，最近 200 条）'),
            h('div', { className: 'ms-list ms-scroll' },
              state.nodes.length === 0
                ? h('div', { className: 'ms-item' }, h('div', { className: 'ms-item-body' }, h('div', { className: 'ms-item-text' }, '这个域还是空的。')))
                : state.nodes.map(function (n) {
                  return h('div', { className: 'ms-item', key: n.id },
                    h('div', { className: 'ms-item-body' },
                      h('div', { className: 'ms-item-text' }, n.text),
                      h('div', { className: 'ms-item-meta' },
                        h('span', { className: 'ms-pill ' + n.level }, n.level),
                        (n.tags || []).map(function (t) { return h('span', { key: t, className: 'ms-pill' }, t); }),
                        '权重 ' + n.eff + ' · 命中 ' + n.hits + ' · ' + n.source)),
                    h('div', { className: 'ms-flex', style: { flexDirection: 'column', gap: 5 } },
                      n.level !== 'core' ? h('button', { className: 'ms-btn sm', disabled: busy, onClick: function () { act(post('/node', { op: 'level', sea: sea, id: n.id, level: 'core' }), '已升 core'); } }, '升 core') : null,
                      h('button', { className: 'ms-btn sm danger', disabled: busy, onClick: function () { act(post('/node', { op: 'forget', sea: sea, id: n.id }), '已删除'); } }, '删')));
                }))
          ),
          state.diary && state.diary.length ? h('div', { className: 'ms-card' },
            h('p', { className: 'ms-title' }, '最近的日记'),
            h('div', { className: 'ms-diary ms-scroll' }, state.diary.slice(-10).map(function (d, i) {
              return h('div', { key: i }, d.时间 + '｜' + d.心情 + '｜' + d.内容);
            }))) : null
        );

        // ── 人设 ──
        var personaPage = h('div', null,
          h('div', { className: 'ms-card' },
            h('p', { className: 'ms-title' }, '人设'),
            h('p', { className: 'ms-sub' }, '每份人设是一段文本，绑定到会话后注入到那个会话的提示里。global 是默认。'),
            h('div', { className: 'ms-list', style: { marginTop: 10 } },
              profiles.map(function (p) {
                return h('div', { className: 'ms-item', key: p.name },
                  h('div', { className: 'ms-item-body' },
                    h('div', { className: 'ms-item-text' },
                      h('span', { className: 'ms-pill' + (personaName === p.name ? ' on' : '') }, personaName === p.name ? '编辑中' : '选择'),
                      p.name + (p.isGlobal ? '（全局默认）' : '')),
                    h('div', { className: 'ms-item-meta' }, p.chars + ' 字 · ' + p.bound + ' 个会话使用')),
                  h('div', { className: 'ms-flex' },
                    h('button', { className: 'ms-btn sm', onClick: function () { setPersonaName(p.name); setMsg(''); } }, '编辑'),
                    p.isGlobal ? null : h('button', {
                      className: 'ms-btn sm danger', disabled: busy,
                      onClick: function () { if (confirm('删除人设 ' + p.name + '？')) act(post('/profiles', { op: 'delete', name: p.name }), '已删除'); },
                    }, '删除')));
              })),
            h('div', { className: 'ms-flex', style: { marginTop: 10 } },
              h('input', { className: 'ms-select', style: { flex: 1 }, placeholder: '新人设名字（字母/数字/._-）', value: newName, onChange: function (e) { setNewName(e.target.value); } }),
              h('button', { className: 'ms-btn primary', disabled: busy || !newName.trim(), onClick: function () { act(post('/profiles', { op: 'create', name: newName.trim(), text: '' }), '已新建'); setNewName(''); } }, '新建人设'))
          ),
          h('div', { className: 'ms-card' },
            h('p', { className: 'ms-title' }, '编辑：' + personaName),
            h('textarea', { className: 'ms-ta', style: { minHeight: 220 }, value: personaText, placeholder: '人设正文（可以放灵魂卡、说话方式、边界……）', onChange: function (e) { setPersonaText(e.target.value); } }),
            h('div', { className: 'ms-flex', style: { marginTop: 8 } },
              h('button', { className: 'ms-btn primary', disabled: busy, onClick: function () { act(post('/profiles', { op: 'save', name: personaName, text: personaText }), '已保存 ' + personaText.length + ' 字'); } }, '保存'),
              h('span', { className: 'ms-hint' }, personaText.length + ' 字')))
        );

        // ── 绑定 ──
        var boundCount = Object.keys(picked).filter(function (k) { return picked[k]; }).length;
        var orphanCount = sessions.filter(function (s) { return s.orphan; }).length;
        var bindPage = h('div', null,
          orphanCount > 0 ? h('div', { className: 'ms-warn' },
            h('p', { className: 'ms-title', style: { marginBottom: 2 } }, '有 ' + orphanCount + ' 条绑定失效'),
            h('p', { className: 'ms-sub' }, '这些会话已经被删除或归档，绑定找不到对应会话了。下面用红色标出，可以一键清理。'),
            h('div', { className: 'ms-flex', style: { marginTop: 8 } },
              h('button', {
                className: 'ms-btn danger', disabled: busy,
                onClick: function () {
                  if (confirm('清理 ' + orphanCount + ' 条失效绑定？不会动任何记忆数据。')) {
                    act(post('/bindings', { op: 'prune' }), '已清理失效绑定');
                  }
                },
              }, '清理失效绑定'),
              h('button', {
                className: 'ms-btn', disabled: busy,
                onClick: function () { act(post('/bindings', { op: 'recheck' }), '已重新校对'); },
              }, '重新检查'))) : null,
          h('div', { className: 'ms-card' },
            h('p', { className: 'ms-title' }, '会话绑定'),
            h('p', { className: 'ms-sub' }, '给会话选它用哪份人设、哪个识海。勾多个会话可以一起绑同一个（共用）。'),
            audit && audit.checkedAt ? h('p', { className: 'ms-hint' }, '上次校对：' + String(audit.checkedAt).slice(0, 19).replace('T', ' ') + '（启动时自动检查，也可点"重新检查"）') : null,
            h('div', { className: 'ms-flex', style: { marginTop: 10 } },
              h('span', { className: 'ms-label' }, '人设'),
              h('select', { className: 'ms-select', value: bindProfile, onChange: function (e) { setBindProfile(e.target.value); } },
                profiles.map(function (p) { return h('option', { key: p.name, value: p.name }, p.name); })),
              h('span', { className: 'ms-label' }, '识海'),
              h('select', { className: 'ms-select', value: bindSea, onChange: function (e) { setBindSea(e.target.value); } },
                seas.map(function (s) { return h('option', { key: s.name, value: s.name }, s.name); })),
              h('button', {
                className: 'ms-btn primary', disabled: busy || boundCount === 0,
                onClick: function () {
                  var ids = Object.keys(picked).filter(function (k) { return picked[k]; });
                  act(post('/bindings', { op: 'set', sessions: ids, profile: bindProfile, sea: bindSea }), '已绑定 ' + ids.length + ' 个会话');
                },
              }, '绑定选中（' + boundCount + '）'),
              h('button', {
                className: 'ms-btn', disabled: busy || boundCount === 0,
                onClick: function () {
                  var ids = Object.keys(picked).filter(function (k) { return picked[k]; });
                  act(post('/bindings', { op: 'clear', sessions: ids }), '已解除 ' + ids.length + ' 个');
                },
              }, '解除绑定'))
          ),
          h('div', { className: 'ms-card', style: { padding: 0, border: 'none', background: 'transparent' } },
            h('p', { className: 'ms-title', style: { marginBottom: 10 } }, '会话列表（' + sessions.length + '）'),
            h('div', { className: 'ms-list ms-scroll' },
              sessions.length === 0
                ? h('div', { className: 'ms-item' }, h('div', { className: 'ms-item-body' }, h('div', { className: 'ms-item-text' }, '读不到会话列表。')))
                : sessions.map(function (s) {
                  return h('div', { className: 'ms-item' + (s.orphan ? ' bad' : ''), key: s.id },
                    h('input', {
                      type: 'checkbox', className: 'ms-chk', checked: !!picked[s.id],
                      onChange: function (e) {
                        var next = Object.assign({}, picked); next[s.id] = e.target.checked; setPicked(next);
                      },
                    }),
                    h('div', { className: 'ms-item-body' },
                      h('div', { className: 'ms-item-text' },
                        s.orphan ? h('span', { className: 'ms-badge-bad' }, '会话不存在') : null,
                        s.title || s.id),
                      h('div', { className: 'ms-item-meta' },
                        (s.orphan
                          ? '原绑：人设 ' + s.profile + ' / 识海 ' + s.sea + ' —— 会话已删除或归档 · '
                          : (s.workspace ? s.workspace + ' · ' : '') +
                            (s.bound ? '人设 ' + s.profile + ' / 识海 ' + s.sea : '未绑定（用 global）') + ' · ') +
                        s.id)));
                }))
          )
        );

        // ── 参数 ──
        var configPage = cfg ? h('div', null,
          h('div', { className: 'ms-card' },
            h('p', { className: 'ms-title' }, '参数'),
            h('p', { className: 'ms-sub' }, '改完点保存，下一条消息起生效。'),
            h('div', { className: 'ms-row' },
              h('div', null, h('div', { className: 'ms-label' }, '常驻注入条数'), h('div', { className: 'ms-hint' }, '每次对话固定带上的记忆条数（core 优先）')),
              h('input', { className: 'ms-num', type: 'number', min: 0, max: 40, value: cfg.injectionLimit, onChange: function (e) { setCfg(Object.assign({}, cfg, { injectionLimit: Number(e.target.value) })); } })),
            h('div', { className: 'ms-row' },
              h('div', null, h('div', { className: 'ms-label' }, '召回默认条数'), h('div', { className: 'ms-hint' }, 'mind_recall 默认返回几条')),
              h('input', { className: 'ms-num', type: 'number', min: 1, max: 20, value: cfg.recallTopN, onChange: function (e) { setCfg(Object.assign({}, cfg, { recallTopN: Number(e.target.value) })); } })),
            h('div', { className: 'ms-row' },
              h('div', null, h('div', { className: 'ms-label' }, '召回阈值'), h('div', { className: 'ms-hint' }, '低于它就不返回（0.05–1）')),
              h('input', { className: 'ms-num', type: 'number', min: 0.05, max: 1, step: 0.05, value: cfg.recallThreshold, onChange: function (e) { setCfg(Object.assign({}, cfg, { recallThreshold: Number(e.target.value) })); } })),
            h('div', { className: 'ms-row' },
              h('div', null, h('div', { className: 'ms-label' }, '每天自记上限'), h('div', { className: 'ms-hint' }, '她自己写记忆每天最多几条')),
              h('input', { className: 'ms-num', type: 'number', min: 0, max: 30, value: cfg.dailySelfMax, onChange: function (e) { setCfg(Object.assign({}, cfg, { dailySelfMax: Number(e.target.value) })); } })),
            h('div', { className: 'ms-row' },
              h('div', null, h('div', { className: 'ms-label' }, '注入人设'), h('div', { className: 'ms-hint' }, '关掉就只注入识海，不注入人设文本')),
              h('input', { type: 'checkbox', checked: !!cfg.injectPersona, onChange: function (e) { setCfg(Object.assign({}, cfg, { injectPersona: e.target.checked })); } })),
            h('div', { className: 'ms-row' },
              h('div', null, h('div', { className: 'ms-label' }, '自动巩固'), h('div', { className: 'ms-hint' }, '每天定时跑；App 重启时也会检查当天有没有跑过')),
              h('input', { type: 'checkbox', checked: !!cfg.consolidateEnabled, onChange: function (e) { setCfg(Object.assign({}, cfg, { consolidateEnabled: e.target.checked })); } })),
            h('div', { className: 'ms-row' },
              h('div', null, h('div', { className: 'ms-label' }, '执行时间'), h('div', { className: 'ms-hint' }, 'HH:MM（本地时间）')),
              h('input', { className: 'ms-num', style: { width: 84 }, value: cfg.consolidateTime || '23:50', onChange: function (e) { setCfg(Object.assign({}, cfg, { consolidateTime: e.target.value })); } })),
            h('div', { className: 'ms-row' },
              h('div', null, h('div', { className: 'ms-label' }, '按标签抽象'), h('div', { className: 'ms-hint' }, '同标签 ≥3 条时抽象出一条规律')),
              h('input', { type: 'checkbox', checked: !!cfg.abstractOnConsolidate, onChange: function (e) { setCfg(Object.assign({}, cfg, { abstractOnConsolidate: e.target.checked })); } })),
            h('div', { className: 'ms-flex', style: { marginTop: 12 } },
              h('button', { className: 'ms-btn primary', disabled: busy, onClick: function () { act(post('/config', cfg), '已保存'); } }, '保存'))
          )) : null;

        var body = tab === 'overview' ? overview : tab === 'sea' ? seaPage : tab === 'persona' ? personaPage : tab === 'bind' ? bindPage : configPage;

        return h('div', { className: 'ms-page' },
          tabBar,
          body,
          msg ? h('p', { className: 'ms-ok' }, msg) : null,
          err ? h('p', { className: 'ms-err' }, err) : null
        );
      }

      ctx.effect(function () {
        return slots.inject('settings.section', function () {
          return slots.register(
            { name: 'settings.section', id: 'mind-sea', order: 18, label: '小鲸鱼识海' },
            Page
          );
        });
      }, 'dsh-mind-sea: settings section');
    };

    return module.exports;
  },
});
