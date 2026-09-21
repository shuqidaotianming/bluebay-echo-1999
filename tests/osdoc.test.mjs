import { test } from 'node:test';
import assert from 'node:assert/strict';
function el(){const e={style:{setProperty(){},cssText:''},dataset:{},children:[],_cls:new Set(),classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(c){this.children.push(c);return c},remove(){},setAttribute(){},getAttribute(){return null},addEventListener(){},removeEventListener(){},querySelector(){return null},querySelectorAll(){return[]},closest(){return null},getBoundingClientRect(){return{left:0,top:0,width:0,height:0}},setPointerCapture(){},focus(){},textContent:'',innerHTML:''};return e;}
global.document={getElementById:()=>null,createElement:()=>el(),querySelector:()=>null,querySelectorAll:()=>[],head:el(),body:el(),documentElement:el(),addEventListener(){},removeEventListener(){},readyState:'complete'};
global.window=global; global.localStorage={getItem:()=>null,setItem(){},removeItem(){}}; global.matchMedia=()=>({matches:false}); global.AudioContext=undefined; global.screen={orientation:{}}; global.getComputedStyle=()=>({position:'static'});
const { extractBody, extractTitle } = await import('../src/runtime/osdoc.mjs');

test('extractTitle 去掉 [..] 前缀标签', () => { assert.equal(extractTitle('<title>[INTERCEPTED] 开机自检 / BOOT</title>'), '开机自检 / BOOT'); });
test('extractBody 取 data-arg-slot=body 并转义', () => { const b = extractBody('<div data-arg-slot="body">第一行<br>第二&amp;行</div>'); assert.ok(b.includes('第一行') && b.includes('第二&行')); });
test('extractBody 兜底正文 class 容器', () => { assert.match(extractBody('<section class="scp-body">正文ABC</section>'), /正文ABC/); });
