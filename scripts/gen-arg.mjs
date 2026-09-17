// scripts/gen-arg.mjs — 阶段5：ARG 强化集群（真实时钟/周年日期/持续收听时间锁、双标签页、源码·robots·DevTools）+ 新结局「现场直播」
import { readJSON, write, writeJSON, read, patchPageConfig } from './lib/util.mjs';
import { renderPage } from './lib/render.mjs';

const bp = readJSON('arg-blueprint.json');
const ids = new Set(bp.nodes.map((n) => n.id));
function baseCfg(id, extra) { return Object.assign({ nodeId: id, preview: false, trackProgress: true, files: {}, names: {}, rules: { search: {} }, links: {} }, extra); }
function ensure(id, name, type, template, config, bodyInner, edgePairs) {
  write(id + '.html', renderPage({ nodeId: id, template, title: name, bodyInner, config }));
  if (!ids.has(id)) { bp.nodes.push({ id, name, type, template, x: 0, y: 0, fields: {}, isStart: false }); ids.add(id); }
  for (const [from, to, port] of edgePairs || []) if (!bp.edges.some((e) => e.from === from && e.to === to)) bp.edges.push({ from, to, port, label: port, icon: '', desc: '' });
}
const SRC = 'node_nightship'; // 夜航船·序章：公开可达的接入点

// 1) 真实时钟时间锁：游戏钟走到 03:14 才“通上电”
ensure('node_nightwatch', '夜航 · 03:14 值守', 'Browse', 'crt',
  baseCfg('node_nightwatch', { timeLock: { mode: 'gameclock', start: '03:14', end: '03:20', clue: 'clue_nightwatch', okText: '塔灯亮了。这一分钟，你替他把班值完了。', waitText: '塔还黑着——时间在走，去别处逛，回头再来。' }, names: { clue_nightwatch: '夜航·03:14 值守记录' } }),
  '&gt; 延盛灯塔，满潮夜必须人工值守。&lt;br&gt;&gt; 时钟还差一点走到 03:14。&lt;br&gt;&gt; 这台机器的钟，是你打开它的那一刻起，在替那个缺席的人继续走。&lt;br&gt;&gt; 等它到点。');

// 2) 周年日期锁：现实日期到 2026-03-14 才解密
ensure('node_anniv', '滴漏 · 周年未寄', 'Browse', 'dossier',
  baseCfg('node_anniv', { timeLock: { mode: 'afterDate', date: '2026-03-14', clue: 'clue_anniv', okText: '信，可以拆了。', waitText: '这封信标注了开启日期，还没到。' }, names: { clue_anniv: '周年·到点拆封的信' } }),
  '一封寄给「满潮那天」的信。&lt;br&gt;邮戳：2026-03-14。&lt;br&gt;在那天到来之前，它只是一张封口的纸。');

// 3) 持续收听：守满 1 分钟真实时间
ensure('node_sitwith', '守夜 · 陪一段', 'Browse', 'crt',
  baseCfg('node_sitwith', { timeLock: { mode: 'holdMinutes', minutes: 1, clue: 'clue_sitwith', okText: '你陪他坐满了一分钟。够了。', waitText: '别走。守着这段带子，直到放完。' }, drone: true, names: { clue_sitwith: '守夜·陪坐一分钟' } }),
  '&gt; 带上耳机，别切走。&lt;br&gt;&gt; 这段底噪循环里有一句很短的话。守够一分钟，它就出来了。');

// 4) 双标签页联动：电台端 + 手机端同时开，互相 echo 到才发线索
ensure('node_dial_radio', '夜航电台 · 发信端', 'Browse', 'terminal',
  baseCfg('node_dial_radio', { dualTab: { role: 'radio', partners: ['phone'], clue: 'clue_twotabs' }, links: { 打开手机端: 'node_dial_phone' }, names: { clue_twotabs: '双端·对上的信号' } }),
  '&gt; 这是电台端。另开一个标签页，把「手机端」也打开，&lt;br&gt;&gt; 让两台机器在同一个浏览器里彼此听见（它们会隔空对暗号）。&lt;br&gt;&lt;br&gt;&lt;a data-arg-link="打开手机端"&gt;→ 手机端&lt;/a&gt;');
ensure('node_dial_phone', '夜航电台 · 手机端', 'Browse', 'terminal',
  baseCfg('node_dial_phone', { dualTab: { role: 'phone', partners: ['radio'], clue: 'clue_twotabs' }, links: { 回到发信端: 'node_dial_radio' } }),
  '&gt; 手机端已就位。&lt;br&gt;&gt; 现在把发信端也开着，两个标签页别关。&lt;br&gt;&lt;br&gt;&lt;a data-arg-link="回到发信端"&gt;→ 发信端&lt;/a&gt;');
// 双标签页线索登记门槛：非锁门控，但需两处都能被记；仅确保 host 存在即可（validator 通用扫描已覆盖）

// 5) 源码 / robots.txt / DevTools：答案只写在页面源码注释里
ensure('node_hidden_recs', '调阅 · 没有旁注的那页', 'Browse', 'dossier',
  baseCfg('node_hidden_recs', { verify: { clue: 'clue_hidden_recs', hint: '这页在目录里搜不到。答案也藏在你眼看不见的地方——按 F12 看源码，或看它的注释。', placeholder: '输入藏在源码里的词', answers: { deadairo: 'clue_hidden_recs' }, successText: '✔ 你果然翻了源码。', failText: '源码里那行注释，再找找。' }, names: { clue_hidden_recs: '源码·没旁注的调阅号' } }),
  '这是一页从不进任何目录的调阅记录。&lt;br&gt;正文什么都不写。&lt;br&gt;&lt;br&gt;（想知道它记了什么？打开开发者工具，看这一页的 &lt;b&gt;源码&lt;/b&gt;。）&lt;br&gt;&lt;!-- 调阅暗号：DEAD-AIRO —— 沈砚用旧式呼号记下了那晚真正开机的呼号 —— -->');

// 新结局：现场直播（真实时钟 + 双端 + 源码三条 ARG 线索）
ensure('end_livewave', '结局 · 现场直播', 'Ending', 'terminal',
  baseCfg('end_livewave', { links: { 回到桌面: 'node_desktop' } }),
  '你在凌晨 03:14 守到了塔灯，让两个标签页对上了暗号，又从源码里翻出了那个没人念出的呼号。&lt;br&gt;&lt;br&gt;这一次，你不是在玩一个游戏。&lt;br&gt;你是真的，在那个时间点，替他们把话说完了。&lt;br&gt;&lt;br&gt;&lt;a data-arg-link="回到桌面"&gt;[ 回到桌面 ]&lt;/a>');

// 从夜航船接入（公开可达）
for (const p of ['node_nightwatch', 'node_anniv', 'node_sitwith', 'node_dial_radio', 'node_hidden_recs', 'end_livewave']) {
  if (!bp.edges.some((e) => e.from === SRC && e.to === p)) bp.edges.push({ from: SRC, to: p, port: p, label: p, icon: '', desc: '' });
}
// 补「返回夜航船」出边，消除死胡同
for (const p of ['node_nightwatch', 'node_anniv', 'node_sitwith', 'node_hidden_recs', 'node_dial_radio']) {
  if (!bp.edges.some((e) => e.from === p && e.to === SRC)) bp.edges.push({ from: p, to: SRC, port: '返回夜航船', label: '返回夜航船', icon: '', desc: '' });
}

// robots.txt：把隐藏调阅页“藏”在对爬虫不友好的角落（真·ARG 入口）
write('robots.txt', '# 蓝湾广播站 · 档案机 robots\nUser-agent: *\nDisallow: /node_hidden_recs.html\nDisallow: /assets/deep-hum.json\n# 给肯翻源码的人：那页的答案，写在那页自己身上。\n');

// 蓝图落盘
writeJSON('arg-blueprint.json', bp);
write('source/blueprint.json', read('arg-blueprint.json'));

// 聊天加「现场直播」结局
{
  const chat = patchPageConfig('node_chat', {});
  const my = (chat.contacts || []).find((c) => /明月/.test(c.name || ''));
  const need = 'clue_nightwatch,clue_twotabs,clue_hidden_recs';
  if (my && !my.choices.some((ch) => ch.target === 'end_livewave')) {
    my.choices.push({ text: '（现场直播）把守到的塔灯、对上的两端、翻出的呼号，一起告诉他。', requires: need, target: 'end_livewave' });
    chat.names = Object.assign({}, chat.names, { end_livewave: '结局 · 现场直播' });
    patchPageConfig('node_chat', { contacts: chat.contacts, names: chat.names });
  }
}

console.log('[gen-arg] 生成 ARG 集群：3 时间锁页 + 双标签页 + 源码/robots/DevTools 页 + 新结局现场直播。');
