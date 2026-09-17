// scripts/validate.mjs — 完整性 + 防旁路硬门槛校验（可被测试 import，也可 CLI 运行）
import { loadBlueprint, reachability, endingRequirements, pageConfig, buildGraph } from './lib/blueprint.mjs';
import { exists } from './lib/util.mjs';
import { CORE_CLUES, HIDDEN_EXTRA, ARG_EXTRA, PROTECTED_ENDINGS, WALL_CLUES, REEF_CLUES, GOLD_CLUES, LIVEWAVE_CLUES, EXTRA_GUARDED, KNOWLEDGE_GATED, HASH_GATED, SOLVER_CREDITED } from './content/guard.mjs';

export function runValidation() {
  const errors = [];
  const warnings = [];
  const bp = loadBlueprint();
  const ids = new Set(bp.nodes.map((n) => n.id));
  const loginSet = new Set(bp.nodes.filter((n) => n.type === 'Login').map((n) => n.id));
  const endingSet = new Set(bp.nodes.filter((n) => n.type === 'Ending').map((n) => n.id));

  // --- 结构完整性 ---
  const dup = bp.nodes.length - ids.size;
  if (dup > 0) errors.push(`重复节点 id ${dup} 个`);

  const { adj } = buildGraph(bp, {});
  for (const e of bp.edges) {
    if (!ids.has(e.from)) errors.push(`边源不存在: ${e.from} -> ${e.to}`);
    if (!ids.has(e.to)) errors.push(`边目标不存在: ${e.from} -> ${e.to}`);
  }

  // 每个非结局节点都要有出边（防死胡同；结局节点是合法汇点）
  for (const n of bp.nodes) {
    if (endingSet.has(n.id)) continue;
    if (!(adj.get(n.id) && adj.get(n.id).size)) {
      // 例外：Files 文件柜由其所依附线索访问，Login 由口令；此处以图邻接为准
      warnings.push(`节点无出边(疑似孤岛/死胡同): ${n.id} (${n.name})`);
    }
  }

  // config 里引用的目标节点必须存在
  for (const n of bp.nodes) {
    const cfg = pageConfig(n.id);
    if (!cfg) continue;
    if (cfg.__parseError) { errors.push(`${n.id} arg-config JSON 解析失败: ${cfg.__parseError}`); continue; }
    const checkT = (t, from) => { if (t && !ids.has(t) && !t.endsWith('.html')) warnings.push(`${n.id}: ${from} 目标不在节点表: ${t}`); };
    for (const k of Object.keys(cfg.rules && cfg.rules.search || {})) checkT(cfg.rules.search[k], 'search');
    for (const k of Object.keys(cfg.links || {})) checkT(cfg.links[k], 'link');
  }

  // --- 断锁可达性 ---
  const full = reachability(bp, {});
  const cut = reachability(bp, { cutLocks: true });
  const stats = { nodes: bp.nodes.length, edges: bp.edges.length, reachFull: full.size, reachCut: cut.size };

  // --- 三型门控校验 ---
  // 1) 锁门控：断锁后必须图不可达（仅统计真实节点；带 credit 的 solve-credit 线索走下面 3b 校验）
  const lockGated = [...CORE_CLUES, ...EXTRA_GUARDED.filter((g) => !g.credit).map((g) => g.clueId)];
  for (const id of lockGated) {
    if (!ids.has(id)) { errors.push(`锁门控线索未在蓝图中找到: ${id}`); continue; }
    if (cut.has(id)) errors.push(`⚠ 旁路! 断锁后锁门控线索仍可达: ${id}`);
  }
  // 2) 知识门控：作为线索页应存在（其难度来自“先解出进入词”），并仍受高阶结局必需 CORE 9 条间接守住
  for (const id of [...HIDDEN_EXTRA, ...ARG_EXTRA].filter((x) => KNOWLEDGE_GATED.has(x))) {
    if (!ids.has(id)) errors.push(`知识门控线索页不存在: ${id}`);
  }
  // 3) 动作门控 hash：承载页必须声明匹配的 hashClue
  for (const [clue, meta] of Object.entries(HASH_GATED)) {
    const cfg = pageConfig(meta.host);
    if (!cfg || cfg.__parseError) { errors.push(`hash 线索 ${clue} 承载页配置缺失: ${meta.host}`); continue; }
    if (cfg.hashClue !== clue || String(cfg.hashValue).toLowerCase() !== meta.value.toLowerCase()) {
      errors.push(`hash 线索 ${clue} 未在 ${meta.host} 正确声明(hashClue=${cfg.hashClue},hashValue=${cfg.hashValue})`);
    }
  }
  // 3b) 校验门控 solve-credit：承载页存在；若尚未接答案校验，记 warning（Stage2 会补齐）
  const allSolveCredit = { ...SOLVER_CREDITED, ...Object.fromEntries(EXTRA_GUARDED.filter((g) => g.credit).map((g) => [g.credit.clueId, g.credit])) };
  for (const [clue, meta] of Object.entries(allSolveCredit)) {
    if (!ids.has(meta.host)) { errors.push(`solve-credit 线索 ${clue} 承载页不存在: ${meta.host}`); continue; }
    const cfg = pageConfig(meta.host) || {};
    const wired = cfg.solveClue === clue || cfg.answer === meta.answer
      || (cfg.verifyAnswers && cfg.verifyAnswers[meta.answer] === clue)
      || (cfg.verify && cfg.verify.clue === clue && cfg.verify.answers && cfg.verify.answers[meta.answer] === clue)
      || (cfg.minigame && cfg.minigame.clue === clue);
    if (!wired) warnings.push(`solve-credit 线索 ${clue} 承载页 ${meta.host} 暂未接答案校验/小游戏`);
  }

  // 可满足性：受保护结局的每条所需 token 都必须可被记为线索
  // 除节点/ hash / solve-credit 外，再扫描各页声明的机制型线索（时间锁/答案校验/小游戏/口令）
  const mechanicClues = new Set();
  for (const n of bp.nodes) {
    const cfg = pageConfig(n.id); if (!cfg || cfg.__parseError) continue;
    if (cfg.timeLock && cfg.timeLock.clue) mechanicClues.add(cfg.timeLock.clue);
    if (cfg.dualTab && cfg.dualTab.clue) mechanicClues.add(cfg.dualTab.clue);
    if (cfg.verify && cfg.verify.clue) mechanicClues.add(cfg.verify.clue);
    if (cfg.minigame && cfg.minigame.clue) mechanicClues.add(cfg.minigame.clue);
    if (cfg.hashClue) mechanicClues.add(cfg.hashClue);
    for (const c of cfg.contacts || []) if (c.passphraseClue) mechanicClues.add(c.passphraseClue);
  }
  const creditable = new Set([...ids, ...Object.keys(HASH_GATED), ...Object.keys(allSolveCredit), ...mechanicClues]);
  const reqs = endingRequirements(pageConfig('node_chat')) || {};
  for (const [endId, need] of Object.entries(reqs)) {
    for (const tok of need) if (!creditable.has(tok)) errors.push(`结局 ${endId} 所需线索永不可记(悬空): ${tok}`);
  }

  // 受保护结局：按门控类型断言
  for (const [endId, meta] of Object.entries(PROTECTED_ENDINGS)) {
    if (!ids.has(endId)) { errors.push(`受保护结局不存在: ${endId}`); continue; }
    let need = reqs[endId];
    if (!need) need = meta.coreFrom === 'victims' ? WALL_CLUES : meta.coreFrom === 'reef' ? REEF_CLUES : meta.coreFrom === 'gold' ? GOLD_CLUES : meta.coreFrom === 'live' ? LIVEWAVE_CLUES : [...CORE_CLUES, ...(meta.extra || [])];
    if (meta.gate === 'collection') {
      // 收集型：每个所需 token 都必须可被记（节点 或 solve/hash 门控）
      for (const c of need) if (!creditable.has(c)) errors.push(`收集型结局 ${endId} 所需线索不可记: ${c}`);
    } else {
      const hasLockedGap = need.some((c) => lockGated.includes(c) && !cut.has(c));
      if (!hasLockedGap) errors.push(`⚠ 旁路! 断锁后结局仍可直接点亮(无锁门控缺口): ${endId}`);
    }
  }

  // 阶段3 追加：硬核线索必须挂到有效锁
  for (const g of EXTRA_GUARDED) {
    if (!g.behind || !loginSet.has(g.behind)) errors.push(`硬核线索 ${g.clueId} 未挂到有效锁(behind=${g.behind})`);
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings, stats, full, cut };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate.mjs')) {
  const r = runValidation();
  console.log(`\n[validate] 节点 ${r.stats.nodes} · 边 ${r.stats.edges} · 可达(正常) ${r.stats.reachFull} · 可达(断锁) ${r.stats.reachCut}`);
  for (const w of r.warnings) console.log('  ⚠ ' + w);
  for (const e of r.errors) console.log('  ✖ ' + e);
  console.log(r.ok ? '\n✔ 防旁路硬门槛与完整性校验通过。\n' : `\n✘ 校验失败：${r.errors.length} 个错误。\n`);
  process.exit(r.ok ? 0 : 1);
}
