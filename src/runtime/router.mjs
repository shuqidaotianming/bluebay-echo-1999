// src/runtime/router.mjs — 核心路由：go / checkRule / checkLink / bindSearch / bindLogin
import { config, result, hasClue, triggerClue, isShadow, applyShadowSkin } from './core.mjs';
import { playSynthSound } from './audio.mjs';
import { pushNotify } from './notify.mjs';
import { passwordOk, normShadow } from './logic.mjs';
import { fallbackSearch } from './forum.mjs';

export const go = (target) => {
  if (!target) return;
  playSynthSound('click');
  const key = String(target).trim();
  const next = (config.files && config.files[key]) ? config.files[key] : ((config.files && config.files[target]) ? config.files[target] : key);
  if (config.preview && (window.parent !== window || window.top !== window)) {
    window.parent.postMessage({ type: 'arg-route', target: key }, '*');
  } else {
    window.location.href = next.endsWith('.html') ? next : next + '.html';
  }
};

export const checkRule = (kind, value) => {
  const key = String(value || '').trim().toLowerCase();
  if (config.isSearch && kind === 'search' && config.shadowKey && !isShadow() && normShadow(key) === normShadow(config.shadowKey)) {
    if (config.shadowClue) triggerClue(config.shadowClue);
    try { localStorage.setItem('arg_shadow_949', '1'); } catch (e) {}
    applyShadowSkin(true);
    playSynthSound('notify');
    result('✔ 权限已切换：档案员检索（94.9）。有些结果，刚才是不给你看的。');
    return;
  }
  if (config.isSearch && kind === 'search' && isShadow()) {
    const st = (config.shadowRules || {})[key];
    if (st) { playSynthSound('click'); go(st); return; }
  }
  const target = (config.rules[kind] || {})[key];
  if (target) {
    playSynthSound('click');
    go(target);
  } else if (config.isSearch && kind === 'search' && key) {
    playSynthSound('click');
    fallbackSearch(String(value || '').trim());
  } else {
    playSynthSound('error');
    result(config.notFoundText || '没有找到相关结果');
  }
};

export const checkLink = (port) => {
  if (!port) return;
  playSynthSound('click');
  const raw = String(port).trim();
  const target = (config.links || {})[raw] || (config.links || {})[port] || ((config.files && config.files[raw]) ? raw : ((config.files && config.files[port]) ? port : null)) || raw;
  go(target);
};

export function bindSearch(form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const input = form.querySelector('[data-arg-input="keyword"]') || form.querySelector('input[type="text"]') || form.querySelector('input');
    checkRule('search', input ? input.value : '');
  });
}

export function bindLogin(form) {
  const input = form.querySelector('[data-arg-input="password"]') || form.querySelector('input[type="password"]') || form.querySelector('input');
  const error = form.querySelector('[data-arg-error]') || form.querySelector('#error');
  const submitBtn = form.querySelector('[data-arg-submit], button[type="submit"], button');

  function recordUnlock() {
    try {
      const list = JSON.parse(localStorage.getItem('arg_unlocked_locks') || '[]');
      if (config.nodeId && !list.includes(config.nodeId)) { list.push(config.nodeId); localStorage.setItem('arg_unlocked_locks', JSON.stringify(list)); }
    } catch (e) {}
  }

  function doLogin() {
    const val = (input ? input.value : '').trim().toLowerCase();
    const target = config.loginTarget || Object.values(config.links || {})[0] || '';
    if (passwordOk(config.password, val)) {
      playSynthSound('unlock');
      recordUnlock();
      if (config.unlockClue) triggerClue(config.unlockClue);
      if (error) { error.style.color = '#10b981'; error.textContent = '✓ 密码验证成功，正在解密载入...'; }
      setTimeout(() => { if (target) go(target); }, 80);
    } else {
      playSynthSound('error');
      if (error) { error.style.color = '#ef4444'; error.textContent = config.errorMessage || '❌ 密码错误，请重新输入！'; }
      if (input) { input.value = ''; input.focus(); }
    }
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); e.stopPropagation(); doLogin(); return false; });
  if (submitBtn) submitBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); doLogin(); });
  if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doLogin(); } });
}
