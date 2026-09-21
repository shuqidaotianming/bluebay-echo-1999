// scripts/build-vfs.mjs — 从蓝图推导「虚拟文件系统」文件夹树 arg-vfs.js（Explorer 的数据层，可重建）
import { loadBlueprint, pageConfig } from './lib/blueprint.mjs';
import { write } from './lib/util.mjs';

// 前缀 → 文件夹（顺序即展示顺序）。未匹配的归入「其它」。
const GROUPS = [
  ['📰 新闻报道', 'news_'],
  ['💬 潮声论坛', 'post_'],
  ['📚 蓝湾异闻百科', 'wiki_'],
  ['🗂️ 卷宗档案', 'doc_'],
  ['📓 日记手记', 'diary_'],
  ['✉️ 邮件信箱', 'mail_'],
  ['📮 站内信', 'pm_'],
  ['📜 采访与举报信', 'letter_'],
  ['🔑 密码与线索', 'clue_'],
  ['🎙️ 潮声节目存档', 'prog_'],
  ['🎧 文字稿全集', 'ts_'],
  ['🏳️ 受害者遗物', 'vic_'],
  ['🕯️ 守夜人笔记', 'wn_'],
  ['⛵ 夜航船', 'ns_'],
  ['🚨 庭审记录', 'trial_'],
  ['👥 出庭证言', 'wit_'],
  ['⚖️ 法院文书', 'court_'],
  ['🗞️ 蓝湾日报头版', 'front_'],
  ['📍 地点志', 'pl_'],
  ['📖 蓝湾镇志', 'gaz_'],
  ['🕯️ 名字墙', 'full_'],
  ['🌊 听潮会外围', 'tide_'],
  ['🎛️ 电台技术史', 'th_'],
  ['📻 节目特辑', 'spec_'],
  ['📅 值班日志', 'log_'],
  ['🗃️ 深层硬核', 'hr_'],
  ['🧰 修复工作台', 'mg_'],
  ['🌙 ARG·时间锁', 'node_nightwatch'],
  ['🌙 ARG·时间锁', 'node_anniv'],
  ['🌙 ARG·时间锁', 'node_sitwith'],
  ['🌙 ARG·双端', 'node_dial_radio'],
  ['🌙 ARG·双端', 'node_dial_phone'],
  ['🖥️ 系统 · 南方纪事', 'press_'],
  ['🖥️ 系统 · 桌面应用', '@apps'],
];

export function buildVfs() {
  const bp = loadBlueprint();
  const byId = new Map(bp.nodes.map((n) => [n.id, n]));
  // 锁归属：页 config.requiresClue 优先；否则若父级是某 Login 的 Files，也算锁后（简化：requiresClue 即锁后）
  const lockedBy = {};
  for (const n of bp.nodes) {
    const cfg = pageConfig(n.id);
    if (cfg && cfg.requiresClue) lockedBy[n.id] = cfg.requiresClue;
  }
  // 「系统应用」快捷方式（桌面上那些 exe）
  const apps = [
    ['node_desktop', '桌面'], ['node_search', '千禧搜索'], ['node_chat', '潮声通讯'],
    ['node_forum', '蓝湾潮声论坛'], ['index_archive', '镇档案馆'], ['wiki_hub', '异闻百科'],
    ['node_newsroom', '南方纪事内部网'], ['node_timeline', '调查板'], ['node_memorial', '线上纪念站'],
    ['node_programs', '节目存档'], ['node_nightship', '夜航船'], ['node_workbench', '修复工作台'],
  ].filter(([id]) => byId.has(id)).map(([id]) => ({ id, name: byId.get(id).name }));

  const used = new Set(['index.html', 'node_prologue']);
  const folders = GROUPS.map(([folder, prefix]) => {
    let ids;
    if (prefix === '@apps') ids = apps.map((a) => a.id);
    else ids = bp.nodes.filter((n) => (prefix.endsWith('_') ? n.id.startsWith(prefix) : n.id === prefix)).map((n) => n.id);
    ids = ids.filter((id) => !used.has(id) && byId.has(id) && !/^index$/.test(id));
    ids.forEach((id) => used.add(id));
    return { folder, items: ids.map((id) => ({ id, name: byId.get(id).name, lockedBy: lockedBy[id] || null })) };
  }).filter((f) => f.items.length);

  // 未归类
  const other = bp.nodes.filter((n) => !used.has(n.id) && n.type !== 'Ending' && n.type !== 'Login' && n.id !== 'node_prologue').map((n) => ({ id: n.id, name: n.name, lockedBy: lockedBy[n.id] || null }));
  if (other.length) folders.push({ folder: '📁 其它', items: other });

  const data = { generatedBy: 'build-vfs.mjs', folders, lockedBy };
  write('arg-vfs.js', 'window.ARG_VFS=' + JSON.stringify(data) + ';\n');
  return { folders: folders.length, files: folders.reduce((a, f) => a + f.items.length, 0), locked: Object.keys(lockedBy).length };
}

if (process.argv[1] && process.argv[1].endsWith('build-vfs.mjs')) {
  const r = buildVfs();
  console.log(`[build:vfs] arg-vfs.js：${r.folders} 个文件夹 · ${r.files} 个文件 · ${r.locked} 个受锁`);
}
