// scripts/gen-hardcore.mjs — 阶段3：生成「深潮·礁声」硬核谜题集群（幂等，可重复跑）
import { readJSON, writeJSON, read, write, patchPageConfig, mergeGuarded } from './lib/util.mjs';
import { renderPage } from './lib/render.mjs';
import C from './lib/ciphers.mjs';

const bp = readJSON('arg-blueprint.json');
const ids = new Set(bp.nodes.map((n) => n.id));

// ---- 1) 用密码库算出可解密文（保证谜题一定解得开） ----
const playfairCT = C.playfairEncode('DEEPWATER', 'tide');   // Playfair → deepwater（新锁口令）
const polybiusCT = C.polybiusEncode('REEFBELL', 'tide');    // keyed Polybius(tide) → REEFBELL
const luhnAns = C.luhnCheckDigit('0722');                   // H0722 + Luhn 校验位
const xorPlain = 'HARBOR', xorMask = 'ZZZZZZ';
const xorTape = C.xorMask(xorPlain, xorMask);              // A=mask, B=xorTape, A^B=plain → HARBOR
const hexFmt = (s) => Buffer.from(s).toString('hex').replace(/../g, '$1 ').trim();

const SUBKEY = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const monoEncrypt = (pt, key) => { const plain = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return [...C.letters(pt)].map((ch) => key[plain.indexOf(ch)] || ch).join(''); };
const freqPT = 'THE LIGHTHOUSE SINGS FOR THE SIXTY SIX WHO NEVER CAME BACK';
const freqCT = monoEncrypt(freqPT, SUBKEY);

const REEF = { requiresClue: 'node_login_reef' };
function baseCfg(id, extra) { return Object.assign({ nodeId: id, preview: false, trackProgress: true, files: {}, names: {}, rules: { search: {} }, links: {} }, extra); }

function ensure(id, name, type, template, config, bodyInner, edgePairs) {
  write(id + '.html', renderPage({ nodeId: id, template, title: name, bodyInner, config }));
  if (!ids.has(id)) { bp.nodes.push({ id, name, type, template, x: 0, y: 0, fields: {}, isStart: false }); ids.add(id); }
  for (const [from, to, port] of edgePairs || []) if (!bp.edges.some((e) => e.from === from && e.to === to)) bp.edges.push({ from, to, port, label: port, icon: '', desc: '' });
}

// 入口：Playfair 残格（从调查板链入，公开可达）
ensure('hr_playfair', '夹页 · 只剩半张方格', 'Browse', 'terminal',
  baseCfg('hr_playfair', { links: { 去开深层档案: 'node_login_reef' }, names: { node_login_reef: '礁声·深层档案门禁' } }),
  '档案室的灯管忽明忽暗。一页夹在镇志里，一张 5×5 的方格，只写了半句：<br>「把 <b>' + playfairCT + '</b> 还回它该在的格子——用那个被潮水推出来的词，做这局的钥匙。」<br><br>那是 Playfair 双字母方块。钥匙词，你早就在保险箱那道题里解出来了。<br>解出的词，是下一把锁的门。<br><br>◈ 接下来：<a data-arg-link="去开深层档案">[ 去开深层档案 → ]</a>',
  [['node_timeline', 'hr_playfair', '深潮']]
);

ensure('node_login_reef', '礁声 · 深层档案门禁', 'Login', 'terminal',
  baseCfg('node_login_reef', { password: 'deepwater', loginTarget: 'node_files_reef', errorMessage: '❌ 门禁纹丝不动。钥匙是上一个词。' }),
  '金属门，没有把手，只有一行凹刻：<br>&gt; 请输入口令。<br>&gt; 提示：你解开 Playfair 得到的那个词。',
  [['hr_playfair', 'node_login_reef', '去开深层档案']]
);

ensure('node_files_reef', '礁声 · 深层卷宗柜', 'Files', 'terminal',
  baseCfg('node_files_reef', { requiresClue: 'node_login_reef',
    links: { 棋盘: 'hr_polybius', 截获: 'hr_freq', 残带: 'hr_xor', 船籍: 'hr_luhn', 交点: 'hr_df', 嗡鸣: 'hr_stego' },
    names: { hr_polybius: '卷宗·棋盘密码', hr_freq: '卷宗·单表截获', hr_xor: '残带·两遍噪声', hr_luhn: '卷宗·船籍校验', hr_df: '卷宗·测向交点', hr_stego: '音频·藏在嗡鸣里' } }),
  '柜门开了。里面是六份从没进过任何目录的东西。<br>每一份，都要动真本事才读得懂。<br><br>◈ 取阅：<br><a data-arg-link="棋盘">→ 卷宗·棋盘密码</a><br><a data-arg-link="截获">→ 卷宗·单表截获</a><br><a data-arg-link="残带">→ 残带·两遍噪声</a><br><a data-arg-link="船籍">→ 卷宗·船籍校验</a><br><a data-arg-link="交点">→ 卷宗·测向交点</a><br><a data-arg-link="嗡鸣">→ 音频·藏在嗡鸣里</a>',
  [['node_login_reef', 'node_files_reef', '解锁'], ['node_files_reef', 'hr_polybius', '棋盘'], ['node_files_reef', 'hr_freq', '截获'], ['node_files_reef', 'hr_xor', '残带'], ['node_files_reef', 'hr_luhn', '船籍'], ['node_files_reef', 'hr_df', '交点'], ['node_files_reef', 'hr_stego', '嗡鸣']]
);

ensure('hr_polybius', '卷宗 · 棋盘密码', 'Browse', 'dossier', baseCfg('hr_polybius', REEF),
  '一张 keyed Polybius 方格，关键词是那个母词。<br>被念出来的坐标：<br><br><b>' + polybiusCT + '</b><br><br>（行·列，1–5。5×5，I/J 合并。用 <b>tide</b> 排格。）');

ensure('hr_freq', '卷宗 · 单表截获', 'Browse', 'dossier', baseCfg('hr_freq', REEF),
  '一段被固定替换表加密的截获长文。<br>没有密钥，只有一张真的字母频率表，和你自己的眼睛。<br><br>' + freqCT.replace(/(.{38})/g, '$1 ') + '<br><br>（明文是一句话。首词是 THE。找出那句英文。）');

ensure('hr_xor', '残带 · 两遍噪声', 'Browse', 'crt', baseCfg('hr_xor', REEF),
  '&gt; 同一段带子录了两遍，各自坏在不同地方。<br>&gt; 残带A（原始字节·十六进制）：' + hexFmt(xorMask) + '<br>&gt; 残带B（原始字节·十六进制）：' + hexFmt(xorTape) + '<br>&gt; 逐字节异或（XOR）这两串，读出那个港口名。');

ensure('hr_luhn', '卷宗 · 船籍校验', 'Browse', 'dossier', baseCfg('hr_luhn', REEF),
  '一串船籍号，末位是校验位，被人涂掉了。<br>格式：<b>H0722</b> ＋ 一位数字（Luhn 校验）。<br><br>把 0722 用 Luhn 算法补上正确的末位，才是它真正的注册号。<br>（从右起偶数位×2，>9 减 9，和能被 10 整除。）<br><br>末位是：<b>' + luhnAns + '</b>？——去档案里把它拼全。');

ensure('hr_df', '卷宗 · 测向交点', 'Browse', 'dossier', baseCfg('hr_df', REEF),
  '两台测向机，同一时刻截到同一个不明信号。<br>灯塔方位 <b>217°</b>；港务雷达方位 <b>148°</b>。<br><br>在海图上从两个已知点各画一条方位线，交点就在那片海。<br>量出交点纬度、向下取整到度（例如 21°）——那是他们把船压进水里的纬度。');

ensure('hr_stego', '音频 · 藏在嗡鸣里', 'Browse', 'crt',
  baseCfg('hr_stego', Object.assign({
    verify: { clue: 'clue_stegoaudio', hint: '把这段低频底噪丢进 Audacity，切到频谱视图，看它“写”了什么。输入那个词：', placeholder: 'BLACKTIDE', answers: { blacktide: 'clue_stegoaudio' }, successText: '✔ 嗡鸣里一直是这三个字。机器记下了。', failText: '不对。频谱图上，字是亮的。' },
  }, REEF)),
  '&gt; 一段循环的低频嗡鸣。用真的音频工具看它的频谱图——字，藏在频率的亮线里。<br><audio controls src="assets/deep-hum.wav" style="width:100%;margin:10px 0"></audio><br>&gt; 打不开外部工具的人：同目录 <b>assets/deep-hum.json</b> 是这段声音的“视觉等价”点阵。');

ensure('end_reef', '结局 · 深潮', 'Ending', 'terminal', baseCfg('end_reef', { links: { 回到桌面: 'node_desktop' } }),
  '你把六份从不该被读到的东西，拼成了一条完整的证据链。<br>棋盘、截获、异或、校验位、交点、嗡鸣。<br><br>明月如霜把这篇稿子，压进了那年最后一版报纸。<br>——有些声音，终于不是白噪了。<br><br><a data-arg-link="回到桌面">[ 回到桌面 ]</a>');

// 6 份卷宗补「返回柜」出边（消除死胡同；正文里也追加返回链接锚点）
for (const pid of ['hr_polybius', 'hr_freq', 'hr_xor', 'hr_luhn', 'hr_df', 'hr_stego']) {
  if (!bp.edges.some((e) => e.from === pid && e.to === 'node_files_reef')) bp.edges.push({ from: pid, to: 'node_files_reef', port: '返回柜', label: '返回柜', icon: '', desc: '' });
  const html = read(pid + '.html');
  if (!/返回柜/.test(html)) write(pid + '.html', html.replace('<div data-arg-verify></div>', '<div><a data-arg-link="返回柜" style="color:#7dd3fc;cursor:pointer;text-decoration:underline">← 返回深层卷宗柜</a></div><div data-arg-verify></div>'));
}

// ---- 3) 注册断锁门槛（合并，不覆盖其它生成器写入的条目） ----
const HARD_CORE_GUARDED = [
  { clueId: 'hr_polybius', behind: 'node_login_reef' },
  { clueId: 'hr_freq', behind: 'node_login_reef' },
  { clueId: 'hr_xor', behind: 'node_login_reef' },
  { clueId: 'hr_luhn', behind: 'node_login_reef' },
  { clueId: 'hr_df', behind: 'node_login_reef' },
  { clueId: 'hr_stego', behind: 'node_login_reef' },
  { clueId: 'clue_stegoaudio', behind: 'node_login_reef', credit: { clueId: 'clue_stegoaudio', host: 'hr_stego', answer: 'blacktide' } },
];
mergeGuarded(HARD_CORE_GUARDED);

// ---- 4) 蓝图落盘 ----
writeJSON('arg-blueprint.json', bp);
write('source/blueprint.json', read('arg-blueprint.json'));

// ---- 5) 聊天加新结局选项（幂等）----
{
  const chat = patchPageConfig('node_chat', {});
  const mingyue = (chat.contacts || []).find((c) => /明月/.test(c.name || ''));
  if (mingyue && !mingyue.choices.some((ch) => ch.target === 'end_reef')) {
    mingyue.choices.push({ text: '（深潮）把棋盘、截获、异或、校验位、交点、嗡鸣，一起交给他。', requires: 'hr_polybius,hr_freq,hr_xor,hr_luhn,hr_df,hr_stego', target: 'end_reef' });
    chat.names = Object.assign({}, chat.names, { end_reef: '结局 · 深潮' });
    patchPageConfig('node_chat', { contacts: chat.contacts, names: chat.names });
  }
}

// ---- 6) 入口可被搜索发现 + 纳入检索白名单 ----
{
  const nsc = patchPageConfig('node_search', {});
  nsc.rules = nsc.rules || {}; nsc.rules.search = nsc.rules.search || {};
  if (!nsc.rules.search['深潮']) {
    nsc.rules.search['深潮'] = 'hr_playfair';
    nsc.names = Object.assign({}, nsc.names, { hr_playfair: '夹页 · 只剩半张方格' });
    patchPageConfig('node_search', { rules: nsc.rules, names: nsc.names });
  }
  const inc = readJSON('scripts/content/search-include.json');
  if (!inc.ids.includes('hr_playfair')) { inc.ids.push('hr_playfair'); inc.ids.sort(); writeJSON('scripts/content/search-include.json', inc); }
}

console.log('[gen-hardcore] 生成「深潮·礁声」：1 锁 + 1 枢纽 + 6 硬核卷宗 + 1 新结局，注册防旁路与聊天结局。');
console.log('  Playfair=' + playfairCT + '→deepwater | 异或明文=' + xorPlain + ' | Luhn末位=' + luhnAns + ' | 频谱词=BLACKTIDE | Polybius=' + polybiusCT);
