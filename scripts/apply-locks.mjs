// scripts/apply-locks.mjs — 用「完整运行时可达图」推导每把锁的私有子树，补 requiresClue（直接-URL 防旁路）
// 关键：必须与 validate 同一张图（含 edges + 各页 search/links/loginTarget/chat 目标），否则会把
// 靠搜索/聊天就能到的公开页误判为锁私有。幂等：仅给「当前无 requiresClue 且确为该锁私有」的内容页加锁。
import { loadBlueprint, buildGraph, pageConfig } from './lib/blueprint.mjs';
import { patchPageConfig, exists } from './lib/util.mjs';

export function applyLocks({ dry = false } = {}) {
  const bp = loadBlueprint();
  const { adj } = buildGraph(bp, {}); // 完整图（含运行时边）
  const start = bp.startId || 'node_prologue';
  const logins = bp.nodes.filter((n) => n.type === 'Login').map((n) => n.id);
  const skipTypes = new Set(['Login', 'Ending', 'Chat', 'Search']);
  const typeOf = (id) => { const n = bp.nodes.find((x) => x.id === id); return n && n.type; };

  function reach(skipLogin) {
    const seen = new Set([start]); const q = [start];
    while (q.length) { const n = q.shift(); if (n === skipLogin) continue; for (const t of (adj.get(n) || [])) if (!seen.has(t)) { seen.add(t); q.push(t); } }
    return seen;
  }
  const full = reach(null);
  const guardian = new Map();
  for (const L of logins) {
    const withoutL = reach(L);
    for (const id of full) {
      if (id === L || withoutL.has(id)) continue;            // 断这把锁后不再可达 → 私有
      if (skipTypes.has(typeOf(id))) continue;
      if (!guardian.has(id)) guardian.set(id, L);
    }
  }
  let added = 0, normalized = 0; const addedList = [];
  for (const [id, L] of guardian) {
    if (!(exists(id + '.html') || id === 'node_prologue')) continue;
    const cfg = pageConfig(id); if (!cfg || cfg.__parseError) continue;
    const want = 'lock:' + L;
    const cur = cfg.requiresClue;
    if (cur === want) continue;                       // 已正确加锁
    if (cur && !/^lock:/.test(cur)) {                  // 旧的裸登录 id → 规范化为 lock:
      addedList.push(id + '≈' + want); normalized++;
      if (!dry) patchPageConfig(id, { requiresClue: want });
      continue;
    }
    addedList.push(id + '←' + want);
    if (!dry) patchPageConfig(id, { requiresClue: want });
    added++;
  }
  return { private: guardian.size, added, normalized, addedList };
}

if (process.argv[1] && process.argv[1].endsWith('apply-locks.mjs')) {
  const r = applyLocks();
  console.log(`[apply-locks] 锁私有节点 ${r.private} · 新增加锁 ${r.added} · 规范化 ${r.normalized}`);
}
