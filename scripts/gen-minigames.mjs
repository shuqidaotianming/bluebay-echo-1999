// scripts/gen-minigames.mjs — 阶段4：生成「声音修复工作台」小游戏集群（挂保险箱锁后，幂等）
import { readJSON, write, writeJSON, read, patchPageConfig, mergeGuarded, exists } from './lib/util.mjs';
import { renderPage } from './lib/render.mjs';

const bp = readJSON('arg-blueprint.json');
const ids = new Set(bp.nodes.map((n) => n.id));
const GATE = 'node_login_safe'; // 复用保险箱锁：修复工具在机房语义下合理
function baseCfg(id, extra) { return Object.assign({ nodeId: id, preview: false, trackProgress: true, files: {}, names: {}, rules: { search: {} }, links: {} }, extra); }
function ensure(id, name, type, template, config, bodyInner, edgePairs) {
  write(id + '.html', renderPage({ nodeId: id, template, title: name, bodyInner, config }));
  if (!ids.has(id)) { bp.nodes.push({ id, name, type, template, x: 0, y: 0, fields: {}, isStart: false }); ids.add(id); }
  for (const [from, to, port] of edgePairs || []) if (!bp.edges.some((e) => e.from === from && e.to === to)) bp.edges.push({ from, to, port, label: port, icon: '', desc: '' });
}

// 工作台枢纽（锁后）
const GAMES = [
  { page: 'mg_spectral', type: 'spectral-repair', clue: 'clue_mg_spectral', name: '修复台 · 补全频谱' },
  { page: 'mg_gate', type: 'noise-gate', clue: 'clue_mg_gate', name: '修复台 · 去噪门限' },
  { page: 'mg_align', type: 'tape-align', clue: 'clue_mg_align', name: '修复台 · 走带对位' },
  { page: 'mg_dial', type: 'tuning-dial', clue: 'clue_mg_dial', name: '修复台 · 调谐旋钮', freq: 94.90 },
  { page: 'mg_splice', type: 'splice-order', clue: 'clue_mg_splice', name: '修复台 · 剪辑拼接' },
  { page: 'mg_eq', type: 'eq-band', clue: 'clue_mg_eq', name: '修复台 · 三段均衡' },
];
const gnames = {}; GAMES.forEach((g) => (gnames[g.page] = g.name));

ensure('mg_workbench', '声音修复工作台', 'Files', 'terminal',
  baseCfg('mg_workbench', { requiresClue: GATE, links: Object.fromEntries(GAMES.map((g) => [g.name.replace('修复台 · ', ''), g.page])), names: gnames }),
  '这是沈知微的吃饭家伙。哥哥留下的六段坏带子，都在这些工位上。&lt;br&gt;每一个工位，都要你的手和耳朵一起上。&lt;br&gt;&lt;br&gt;◈ 工位：&lt;br&gt;' +
  GAMES.map((g) => '<a data-arg-link="' + g.name.replace('修复台 · ', '') + '">→ ' + g.name + '</a>').join('<br>'),
  [['node_files_secret', 'mg_workbench', '修复台'], ['mg_workbench', 'node_files_secret', '返回保险箱']]
);
// 返回保险箱链接锚点补进枢纽正文
{ const h = read('mg_workbench.html'); if (!/返回保险箱/.test(h)) write('mg_workbench.html', h.replace('<div data-arg-verify></div>', '<div style="margin-top:12px"><a data-arg-link="返回保险箱" style="color:#7dd3fc;cursor:pointer;text-decoration:underline">← 返回保险箱档案</a></div><div data-arg-verify></div>')); }

for (const g of GAMES) {
  ensure(g.page, g.name, 'Browse', 'terminal',
    baseCfg(g.page, { requiresClue: GATE, minigame: { type: g.type, clue: g.clue, title: g.name, freq: g.freq, successText: '✔ 这段声音，修好了。机器替你记下了。' }, names: { [g.clue]: g.name + ' · 已修复' } }),
    g.name.replace('修复台 · ', '') + ' —— 动手修复这段坏带子。&lt;br&gt;&lt;div data-arg-game&gt;&lt;/div&gt;' +
    '<div style="margin-top:12px"><a data-arg-link="回工作台" style="color:#7dd3fc;cursor:pointer;text-decoration:underline">← 回工作台</a></div>',
    [['mg_workbench', g.page, g.name.replace('修复台 · ', '')], [g.page, 'mg_workbench', '回工作台']]
  );
}

// 新结局：金耳朵（集齐 6 段修复）
ensure('end_goldear', '结局 · 金耳朵', 'Ending', 'terminal',
  baseCfg('end_goldear', { links: { 回到桌面: 'node_desktop' } }),
  '六段坏带子，被你一段一段修回了人声。&lt;br&gt;那不是证物，是六十六个人里，几个还记得唱歌的人。&lt;br&gt;&lt;br&gt;你把修复好的带子，重新接上了发射机。&lt;br&gt;那一夜，蓝湾的收音机自己开了。&lt;br&gt;&lt;br&gt;<a data-arg-link="回到桌面">[ 回到桌面 ]</a>');

// 门槛登记：游戏页锁后不可达 + 线索经小游戏发放
mergeGuarded([
  ...GAMES.map((g) => ({ clueId: g.page, behind: GATE })),
  ...GAMES.map((g) => ({ clueId: g.clue, behind: GATE, credit: { clueId: g.clue, host: g.page } })),
]);

// 蓝图落盘
writeJSON('arg-blueprint.json', bp);
write('source/blueprint.json', read('arg-blueprint.json'));

// 聊天加「金耳朵」结局选项
{
  const chat = patchPageConfig('node_chat', {});
  const mingyue = (chat.contacts || []).find((c) => /明月/.test(c.name || ''));
  const need = GAMES.map((g) => g.clue).join(',');
  if (mingyue && !mingyue.choices.some((ch) => ch.target === 'end_goldear')) {
    mingyue.choices.push({ text: '（金耳朵）把修好的六段带子，一段一段放给他听。', requires: need, target: 'end_goldear' });
    chat.names = Object.assign({}, chat.names, { end_goldear: '结局 · 金耳朵' });
    patchPageConfig('node_chat', { contacts: chat.contacts, names: chat.names });
  }
}

// 注意：工作台在保险箱锁后，【不得】作为公共搜索入口（否则可从公开检索绕过锁直达柜内核心线索）。
// 只做防御性清理：若历史上误加过「修复台」搜索规则，则删除。
{
  const nsc = patchPageConfig('node_search', {});
  if (nsc.rules && nsc.rules.search && nsc.rules.search['修复台']) {
    delete nsc.rules.search['修复台'];
    patchPageConfig('node_search', { rules: nsc.rules });
  }
}

console.log('[gen-minigames] 生成「声音修复工作台」：6 小游戏 + 新结局金耳朵，挂保险箱锁后并登记门槛。');
