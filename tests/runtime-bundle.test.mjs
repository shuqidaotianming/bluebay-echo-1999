import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../arg-runtime.js', import.meta.url), 'utf8');

function makeEl() {
  const el = {
    style: { cssText: '', setProperty() {} }, dataset: {}, children: [], _cls: new Set(),
    classList: { add(c){this._add(c)}, remove(c){this._del(c)}, toggle(c,f){f?this._add(c):this._del(c)}, contains(c){return (el._cls||new Set()).has(c)}, _add(c){el._cls.add(c)}, _del(c){el._cls.delete(c)} },
    setAttribute() {}, getAttribute() { return null; }, appendChild(c) { this.children.push(c); return c; }, insertBefore() {}, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, contains() { return false; }, focus() {}, select() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    textContent: '', innerHTML: '', value: '', title: '', type: '', href: '',
  };
  return el;
}

function loadBundle({ nodeId, cfg, visited }) {
  const store = new Map();
  if (visited) store.set('arg_visited_nodes', JSON.stringify(visited));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const configText = JSON.stringify(Object.assign({ nodeId, preview: false, trackProgress: true, files: {}, names: {}, rules: {} }, cfg));
  const argConfigEl = Object.assign(makeEl(), { textContent: configText });
  const document = {
    readyState: 'complete',
    getElementById: (id) => (id === 'arg-config' ? argConfigEl : null),
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => makeEl(), head: makeEl(), body: makeEl(),
    documentElement: makeEl(), addEventListener() {}, removeEventListener() {},
  };
  const window = {
    document, localStorage, location: { pathname: '/' + nodeId + '.html', hash: (cfg.hashPresent ? cfg.hashValue : '') },
    matchMedia: () => ({ matches: false }), navigator: {}, screen: {},
    addEventListener() {}, removeEventListener() {}, console,
    getComputedStyle: () => ({ position: 'static' }),
  };
  window.window = window;
  const fetchStub = () => Promise.reject(new Error('offline'));
  // 用假定时器避免测试挂起
  const fn = new Function('window', 'document', 'localStorage', 'location', 'navigator', 'fetch', 'setInterval', 'setTimeout', 'clearInterval', 'clearTimeout', 'requestAnimationFrame', 'console', '__store',
    code + '\n;globalThis.__probe = { window };');
  fn(window, document, localStorage, window.location, window.navigator, fetchStub, () => 0, (cb) => 0, () => {}, () => {}, () => 0, console, store);
  return { window, localStorage, store };
}

test('打包产物可加载并暴露对外 API（无浏览器冒烟）', () => {
  const { window } = loadBundle({ nodeId: 'node_desktop', cfg: {} , visited: [] });
  assert.ok(window.ARG, 'window.ARG 未就绪');
  assert.ok(window.ARG_RUNTIME && typeof window.ARG_RUNTIME.go === 'function', 'ARG_RUNTIME.go 缺失');
});

test('前置门控：requiresClue 未满足时，访问锁定页不记线索（防直接 URL 旁路）', () => {
  const { store } = loadBundle({ nodeId: 'doc_experiment', cfg: { requiresClue: 'node_login_station' }, visited: ['node_desktop'] });
  const visited = JSON.parse(store.get('arg_visited_nodes'));
  assert.ok(!visited.includes('doc_experiment'), '未解锁却记了锁定线索 → 旁路！');
});

test('前置门控：requiresClue 满足时正常记线索', () => {
  const { store } = loadBundle({ nodeId: 'doc_experiment', cfg: { requiresClue: 'node_login_station' }, visited: ['node_login_station'] });
  const visited = JSON.parse(store.get('arg_visited_nodes'));
  assert.ok(visited.includes('doc_experiment'), '已解锁却未记线索');
});

test('hash 线索：带正确 hash 且已解锁才记账', () => {
  const a = loadBundle({ nodeId: 'clue_frequency_note', cfg: { hashClue: 'clue_firstlight', hashValue: '#firstlight', hashPresent: true }, visited: [] });
  assert.ok(JSON.parse(a.store.get('arg_visited_nodes')).includes('clue_firstlight'), 'hash 命中未记线索');
});
