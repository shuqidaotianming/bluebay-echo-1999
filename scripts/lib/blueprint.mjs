// scripts/lib/blueprint.mjs — 加载蓝图 + 全部页面内嵌 config，构建「真实可达图」
import { read, readJSON, parsePageConfig, abs, exists } from './util.mjs';

export function loadBlueprint() {
  return readJSON('arg-blueprint.json');
}

// nodeId -> 文件名（以蓝图 files 为准，兜底 .html）
export function fileMap(bp) {
  const m = {};
  for (const n of bp.nodes) m[n.id] = (n.fields && n.fields.__file) || (n.id + '.html');
  // 蓝图未直接存文件名映射时，节点 id 即文件名（本工程约定）
  return m;
}

// 解析指定节点页的内嵌 config（真实运行时用它路由）
export function pageConfig(nodeId) {
  const file = nodeId + '.html';
  if (!exists(file)) return null;
  return parsePageConfig(read(file));
}

// 构建完整邻接表：蓝图 edges + 每页 config 的 rules.search / links / loginTarget / chat passphrase/choice target
// cutLocks=true 时，剔除所有 Login 节点的出边（模拟「锁未破」）
export function buildGraph(bp, { cutLocks = false, includeRuntimeEdges = true, verbose = false } = {}) {
  const adj = new Map();
  const add = (a, b, why) => {
    if (!a || !b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
    if (verbose) (adj.get(a).__why ||= []).push(`${b}:${why}`);
  };
  const loginSet = new Set(bp.nodes.filter((n) => n.type === 'Login').map((n) => n.id));

  for (const e of bp.edges) {
    if (cutLocks && loginSet.has(e.from)) continue;
    add(e.from, e.to, 'edge');
  }

  if (includeRuntimeEdges) {
    for (const n of bp.nodes) {
      if (cutLocks && loginSet.has(n.id)) continue; // 锁未破：其页内一切跳转（含搜索命中/链）一律不可用
      const cfg = pageConfig(n.id);
      if (!cfg || cfg.__parseError) continue;
      const files = cfg.files || {};
      const resolve = (t) => (files[t] ? t : t); // 目标本身即 key
      for (const key of Object.keys(cfg.rules && cfg.rules.search || {})) {
        add(n.id, resolve(cfg.rules.search[key]), 'search');
      }
      for (const key of Object.keys(cfg.links || {})) {
        add(n.id, resolve(cfg.links[key]), 'link');
      }
      if (cfg.loginTarget) add(n.id, resolve(cfg.loginTarget), 'loginTarget');
      // 聊天里的跳转（选项 / passphrase 目标）——仅从聊天节点可达时纳入
      for (const c of cfg.contacts || []) {
        if (c.passphraseTarget) add(n.id, resolve(c.passphraseTarget), 'chatPass');
        for (const ch of c.choices || []) if (ch.target) add(n.id, resolve(ch.target), 'chatChoice');
      }
    }
  }
  return { adj, loginSet };
}

export function reachability(bp, opts = {}) {
  const start = bp.startId || 'node_prologue';
  const { adj } = buildGraph(bp, opts);
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const n = q.shift();
    for (const t of adj.get(n) || []) if (!seen.has(t)) { seen.add(t); q.push(t); }
  }
  return seen;
}

// 从 node_chat.html 抽出「每个结局需要哪些线索」的门槛（真实玩法数据源）
export function endingRequirements(chatCfg) {
  const reqs = {};
  const mingyue = (chatCfg.contacts || []).find((c) => /明月/.test(c.name || '')) || (chatCfg.contacts || [])[0];
  if (!mingyue) return reqs;
  for (const ch of mingyue.choices || []) {
    if (!ch.target) continue;
    const req = String(ch.requires || ch.req || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (req.length) reqs[ch.target] = req;
  }
  return reqs;
}
