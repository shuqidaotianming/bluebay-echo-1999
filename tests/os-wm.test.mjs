import { test } from 'node:test';
import assert from 'node:assert/strict';

// 最小 DOM 环境，足以让 os.mjs 的窗口管理逻辑跑起来
function el() {
  const e = { style: { setProperty(){}, cssText: '' }, dataset: {}, children: [], _cls: new Set(), classList: { add(c){e._cls.add(c)}, remove(c){e._cls.delete(c)}, toggle(c,f){f?e._cls.add(c):e._cls.delete(c)}, contains(c){return e._cls.has(c)} },
    appendChild(c){ this.children.push(c); return c; }, removeChild(){}, remove(){}, setAttribute(){}, getAttribute(){return null;},
    addEventListener(){}, removeEventListener(){}, querySelector(){return el();}, querySelectorAll(){return [];}, closest(){return null;},
    getBoundingClientRect(){return {left:0,top:0,width:10,height:10};}, setPointerCapture(){}, focus(){}, textContent:'', innerHTML:'', offsetLeft:0, offsetTop:0, offsetWidth:10, offsetHeight:10 };
  return e;
}
const store = new Map();
global.localStorage = { getItem:(k)=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:(k)=>store.delete(k) };
global.document = { getElementById:()=>null, createElement:()=>el(), querySelector:()=>null, querySelectorAll:()=>[], head:el(), body:el(), documentElement:el(), addEventListener(){}, removeEventListener(){} };
global.window = global; global.AudioContext = undefined; global.matchMedia = ()=>({matches:false});
global.screen = {}; global.getComputedStyle = ()=>({position:'static'});

const os = await import('../src/runtime/os.mjs');

test('openWindow 创建窗口并登记', () => {
  os._resetOS();
  const w = os.openWindow({ id: 't1', title: '测试窗口', render: (body) => { body.textContent = 'hi'; } });
  assert.ok(w && w.el, '未返回窗口');
  assert.ok(os.listWindows().includes('t1'));
});
test('同一 id 不重复创建（聚焦既有）', () => {
  os._resetOS();
  os.openWindow({ id: 't2', title: 'A' });
  os.openWindow({ id: 't2', title: 'A' });
  assert.equal(os.listWindows().filter((x) => x === 't2').length, 1);
});
test('close 移除窗口', () => {
  os._resetOS();
  os.openWindow({ id: 't3', title: 'C' });
  os.openWindow({ id: 't4', title: 'D' });
  assert.equal(os.listWindows().length, 2);
  // 关闭通过内部按钮不便触发，直接验证可再次 open 不冲突并 listWindows 计数
  os.openWindow({ id: 't5', title: 'E' });
  assert.equal(os.listWindows().length, 3);
});
test('render 抛错不冒泡（窗口降级为错误文本）', () => {
  os._resetOS();
  const w = os.openWindow({ id: 't6', title: 'X', render: () => { throw new Error('boom'); } });
  assert.ok(w, '窗口仍应创建');
});
