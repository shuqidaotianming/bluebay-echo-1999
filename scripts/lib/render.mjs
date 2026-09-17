// scripts/lib/render.mjs — 生成自洽 ARG 页面（终端/卷宗/CRT 三种外壳），复用运行时钩子
import { read, write } from './util.mjs';

function cfgScript(cfg) {
  return '<script type="application/json" id="arg-config">' + JSON.stringify(cfg) + '</script>';
}
const RUNTIME_TAG = '<script src="arg-runtime.js"></script>'; // stamp-version 会补 ?v=

export function renderPage({ nodeId, template, title, date = '2000-03-14 03:14', siteName = 'SHEN-YAN · 蓝湾广播站 FM99.4', author = '沈砚', bodyInner, config }) {
  const body = bodyInner;
  let shell;
  if (template === 'terminal') {
    shell =
`<div class="cyber-container">
<div class="cyber-topbar"><span class="cyber-status-blink">● LIVE INTERCEPTION</span><span class="cyber-packet-id">NODE_ID: ${nodeId}</span><span class="cyber-enc-type">AES-256-GCM [DECRYPTED]</span></div>
<div class="cyber-terminal-card"><div class="cyber-meta-row">
<span>TARGET_SITE: <strong data-arg-slot="siteName">${siteName}</strong></span>
<span>RECORD_DATE: <strong data-arg-slot="date">${date}</strong></span>
<span>AUTHOR_UID: <strong data-arg-slot="author">${author}</strong></span></div>
<div class="cyber-divider">============================================================</div>
<h1 class="cyber-title" data-arg-slot="title">&gt;&gt; ${title}</h1>
<div class="cyber-body" data-arg-slot="body">${body}</div>
<div data-arg-verify></div>
<div class="cyber-divider">============================================================</div>
<div class="cyber-links" data-arg-links></div></div></div>`;
  } else if (template === 'crt') {
    shell =
`<div class="crt" style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#05080a;padding:24px">
<div style="max-width:820px;width:100%;background:#0a1410;border:1px solid rgba(120,255,180,.3);border-radius:8px;padding:26px;font-family:'Courier New',monospace;color:#8ff0c0;box-shadow:0 0 30px rgba(0,255,120,.12)">
<div class="screen-title" style="letter-spacing:2px;margin-bottom:16px">&gt; ${title}</div>
<div class="log" data-arg-slot="body" style="white-space:pre-wrap;line-height:1.9;font-size:14px">${body}</div>
<div data-arg-verify></div></div></div>`;
  } else { // dossier (SCP 卷宗)
    shell =
`<div class="scp-page" style="min-height:100vh;padding:30px 16px"><div class="scp-card">
<div class="scp-meta"><span>档案 · ${date}</span><span>密级 · 深潮</span><span>经手 · ${author}</span></div>
<h1 class="scp-title" data-arg-slot="title">${title}</h1>
<div class="scp-body" data-arg-slot="body">${body}</div>
<div data-arg-verify></div></div></div>`;
  }
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#05070a;color:#00ff66;font-family:"Courier New",Consolas,monospace}
:root{--arg-primary-color:#174a8b;--arg-bg-color:#f4f6f9;--arg-text-color:#222}
.arg-redacted{color:transparent!important;background:repeating-linear-gradient(45deg,#151515 0 3px,#555 3px 6px)!important}
.scp-page{background:#0e1116;color:#e2e8f0}.scp-card{max-width:820px;margin:0 auto;background:#fffef8;color:#222;padding:38px 44px;border-radius:6px}
.scp-title{font-size:22px;margin:10px 0 18px}.scp-meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;font-size:12px}
.scp-body{line-height:2;font-size:15px;color:#292524;white-space:pre-wrap}
</style></head><body>
${shell}
${cfgScript(config)}
${RUNTIME_TAG}
</body></html>
`;
}
