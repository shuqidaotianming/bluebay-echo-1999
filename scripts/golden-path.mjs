// scripts/golden-path.mjs — 13 结局可达性模拟（无浏览器）：以 node_chat 的真实门槛为准
import { loadBlueprint, reachability, pageConfig, buildGraph } from './lib/blueprint.mjs';

// 取所有聊天里指向结局的选项：target -> { requires[], text }
function endingChoices() {
  const chat = pageConfig('node_chat');
  const map = {};
  for (const c of chat.contacts || []) {
    for (const ch of c.choices || []) {
      if (ch.target && /^end_/.test(ch.target)) {
        const req = String(ch.requires || ch.req || '').split(',').map((s) => s.trim()).filter(Boolean);
        if (!map[ch.target] || req.length > map[ch.target].requires.length) map[ch.target] = { requires: req, text: ch.text };
      }
    }
  }
  return map;
}

export function analyze() {
  const bp = loadBlueprint();
  const endingIds = bp.nodes.filter((n) => n.type === 'Ending').map((n) => n.id);
  const full = reachability(bp, {});
  const cut = reachability(bp, { cutLocks: true });
  const choices = endingChoices();
  // 机制型线索集合（访问页 / hash / 时间锁 / 双端 / 答案校验 / 小游戏 / 口令），可达即“能被记”
  const mechanic = new Set();
  for (const n of bp.nodes) {
    const cfg = pageConfig(n.id); if (!cfg || cfg.__parseError) continue;
    if (cfg.timeLock?.clue) mechanic.add(cfg.timeLock.clue);
    if (cfg.dualTab?.clue) mechanic.add(cfg.dualTab.clue);
    if (cfg.verify?.clue) mechanic.add(cfg.verify.clue);
    if (cfg.minigame?.clue) mechanic.add(cfg.minigame.clue);
    if (cfg.hashClue) mechanic.add(cfg.hashClue);
    for (const c of cfg.contacts || []) if (c.passphraseClue) mechanic.add(c.passphraseClue);
  }
  const creditableFull = (tok) => full.has(tok) || mechanic.has(tok);
  const creditableCut = (tok) => cut.has(tok) || mechanic.has(tok);

  const rows = endingIds.map((id) => {
    const req = (choices[id] || {}).requires || [];
    const reachableFull = req.every(creditableFull);
    const strollableCut = req.every(creditableCut); // 断锁后是否仍能“随手集齐”（true=太易）
    return { id, name: bp.nodes.find((n) => n.id === id).name, need: req.length, reachableFull, gatedBySolve: req.length > 0 && !strollableCut };
  });
  return { rows, endings: endingIds.length };
}

if (process.argv[1] && process.argv[1].endsWith('golden-path.mjs')) {
  const r = analyze();
  console.log(`\n[golden-path] ${r.endings} 个结局可达性模拟：`);
  for (const x of r.rows) {
    console.log(`  ${x.reachableFull ? '✔' : '✘'} ${x.id.padEnd(14)} 需 ${String(x.need).padStart(2)} 线索 · ${x.gatedBySolve ? '须解题(断锁不可集齐)' : '公开/易达'}`);
  }
  const bad = r.rows.filter((x) => !x.reachableFull);
  console.log(bad.length ? `\n✘ 有 ${bad.length} 个结局不可达：${bad.map((x) => x.id).join(', ')}` : '\n✔ 全部结局在其门槛下可达。');
  process.exit(bad.length ? 1 : 0);
}
