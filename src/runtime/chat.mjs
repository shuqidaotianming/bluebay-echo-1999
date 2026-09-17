// src/runtime/chat.mjs — 加密聊天：联系人/动态对话/存档/答案校验/行动条
import { config, hasClue, triggerClue, escapeHtml } from './core.mjs';
import { go } from './router.mjs';
import { playSynthSound } from './audio.mjs';
import { gameClockText } from './desktop.mjs';

export function isImg(src) {
  if (typeof src !== 'string') return false;
  const s = src.split('?')[0].toLowerCase();
  return s.startsWith('data:image/') || s.startsWith('blob:') || s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.gif') || s.endsWith('.webp') || s.endsWith('.svg') || s.endsWith('.ico');
}
export function renderAvatar(src, fallback) {
  if (!src) return fallback || '👤';
  if (isImg(src)) return '<img src="' + escapeHtml(src) + '" class="avatar-img" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="avatar">';
  return escapeHtml(src);
}

export function bindChat(container) {
  const contacts = config.contacts || [];
  let currentIdx = 0;
  const contactsList = container.querySelector('#contactsList');
  const nameEl = container.querySelector('#currentContactName');
  const bioEl = container.querySelector('#currentContactBio');
  const messagesEl = container.querySelector('#chatMessages');
  const choicesEl = container.querySelector('#chatChoicesArea');
  const form = container.querySelector('#chatForm');
  const input = container.querySelector('#chatInput');

  const CHAT_LOG_KEY = 'arg_chat_log_v1';
  function readChatLog() { try { return JSON.parse(localStorage.getItem(CHAT_LOG_KEY) || '{}'); } catch (e) { return {}; } }
  function logMsg(cid, sender, text) {
    if (!cid) return;
    try {
      const l = readChatLog(); l[cid] = l[cid] || [];
      l[cid].push({ s: sender, t: text });
      if (l[cid].length > 300) l[cid] = l[cid].slice(-300);
      localStorage.setItem(CHAT_LOG_KEY, JSON.stringify(l));
    } catch (e) {}
  }
  function ensureChatStyle() {
    if (document.getElementById('arg-chat-style')) return;
    const st = document.createElement('style'); st.id = 'arg-chat-style';
    st.textContent = [
      '.msg-action{text-align:center;font-size:11px;color:#94a3b8;font-style:italic;margin:8px 0;opacity:.85}',
      '.msg-lost{display:flex;gap:8px;align-items:center;margin:8px 0;font-size:12px}',
      '.msg-lost .lost-tag{color:#f87171;border:1px dashed rgba(248,113,113,.6);border-radius:4px;padding:2px 8px;letter-spacing:1px;flex:0 0 auto}',
      '.msg-lost .lost-txt{color:#6b7280;text-decoration:line-through;opacity:.75;word-break:break-all}',
      '.msg-auto .msg-bubble{opacity:.82;border-style:dashed!important}',
      '.msg-auto .auto-tag{display:block;font-size:10px;letter-spacing:1px;color:#a1a1aa;margin-bottom:2px}',
      '.msg-waiting{text-align:center;font-size:11.5px;color:#94a3b8;margin:10px 0;letter-spacing:.6px}',
      '.msg-call{text-align:center;font-size:11.5px;color:#fbbf24;margin:10px 0;opacity:.9}',
      '.arg-typing{display:inline-flex;gap:4px;align-items:center;padding:10px 14px;border-radius:14px;background:rgba(127,127,127,.16)}',
      '.arg-typing i{width:6px;height:6px;border-radius:50%;background:#9ca3af;display:inline-block;animation:arg-dot 1.05s infinite}',
      '.arg-typing i:nth-child(2){animation-delay:.16s}.arg-typing i:nth-child(3){animation-delay:.32s}',
      '@keyframes arg-dot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}',
      '.msg-ts{font-size:9.5px;opacity:.45;margin:0 46px 6px;letter-spacing:.5px}',
      '.arg-send-armed{animation:arg-armed 1.1s ease-in-out infinite!important}',
      '@keyframes arg-armed{0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,.5)}50%{box-shadow:0 0 0 6px rgba(250,204,21,0)}}',
      '.arg-scripted-hint{font-size:10.5px;color:#94a3b8;text-align:center;width:100%;margin-top:-2px}'
    ].join(String.fromCharCode(10));
    document.head.appendChild(st);
  }
  ensureChatStyle();

  function stampRow() {
    if (!messagesEl) return null;
    const d = document.createElement('div');
    d.className = 'msg-ts';
    try { d.textContent = '  ' + gameClockText(); } catch (e) { d.textContent = '  '; }
    d.style.textAlign = 'right';
    messagesEl.appendChild(d);
    return d;
  }
  function npcSay(text, contact, cb) {
    if (!messagesEl) { if (cb) cb(); return; }
    const row = document.createElement('div');
    row.className = 'msg-row msg-npc received';
    const av = document.createElement('div'); av.className = 'msg-avatar'; av.innerHTML = renderAvatar(contact && contact.avatar, '🤖');
    const bub = document.createElement('div'); bub.className = 'arg-typing';
    bub.innerHTML = '<i></i><i></i><i></i>';
    row.appendChild(av); row.appendChild(bub);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    const wait = 620 + Math.min(1500, String(text || '').length * 26);
    setTimeout(function () {
      row.remove();
      appendMessage('npc', text, contact && contact.avatar);
      stampRow();
      if (contact && contact.id) logMsg(contact.id, 'npc', text);
      if (cb) cb();
    }, wait);
  }
  function renderMessage(m, contact) {
    const type = m.type || '';
    if (!messagesEl) return;
    if (type === 'lost') {
      const row = document.createElement('div'); row.className = 'msg-lost';
      const tag = document.createElement('span'); tag.className = 'lost-tag'; tag.textContent = '[数据丢失]';
      const txt = document.createElement('span'); txt.className = 'lost-txt'; txt.textContent = m.text || '▇▇▇▇▇▇▇▇▇';
      row.appendChild(tag); row.appendChild(txt); messagesEl.appendChild(row);
    } else if (type === 'auto') {
      const row = document.createElement('div'); row.className = 'msg-row msg-npc received msg-auto';
      const av = document.createElement('div'); av.className = 'msg-avatar'; av.innerHTML = renderAvatar(contact && contact.avatar, '🤖');
      const bub = document.createElement('div'); bub.className = 'msg-bubble';
      const lab = document.createElement('span'); lab.className = 'auto-tag'; lab.textContent = '[自动回复]';
      bub.appendChild(lab); bub.appendChild(document.createTextNode(m.text || ''));
      row.appendChild(av); row.appendChild(bub); messagesEl.appendChild(row);
    } else if (type === 'waiting' || type === 'noreply') {
      const d = document.createElement('div'); d.className = 'msg-waiting';
      d.textContent = type === 'waiting' ? '（等待回复…）' : '（无回复）';
      messagesEl.appendChild(d);
    } else if (type === 'call') {
      const d = document.createElement('div'); d.className = 'msg-call';
      d.textContent = '📞 ' + (m.text || '语音通话 · 未接通');
      messagesEl.appendChild(d);
    } else if (type === 'divider') {
      const d = document.createElement('div'); d.className = 'msg-time-divider';
      d.textContent = '—— ' + (m.text || '·') + ' ——';
      messagesEl.appendChild(d);
    } else if (type === 'action') {
      appendAction(m.text, true);
    } else {
      appendMessage(m.sender, m.text, contact && contact.avatar);
    }
  }
  function appendAction(text) {
    if (!messagesEl) return;
    const d = document.createElement('div');
    d.className = 'msg-action';
    d.textContent = '—— ' + text + ' ——';
    messagesEl.appendChild(d);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  if (!contacts.length) {
    if (contactsList) contactsList.innerHTML = '<div style="padding:16px 10px;text-align:center;color:var(--text-muted, #888);font-size:12px;">暂无联系人</div>';
    if (messagesEl) messagesEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted, #888);font-size:13px;">暂无对话内容</div>';
    return;
  }

  function renderContacts() {
    if (!contactsList) return;
    contactsList.innerHTML = '';
    contacts.forEach((c, idx) => {
      const item = document.createElement('div');
      item.className = 'contact-item' + (idx === currentIdx ? ' active' : '');
      item.innerHTML = '<div class="contact-avatar">' + renderAvatar(c.avatar, '👤') + '</div>' +
        '<div class="contact-meta"><div class="contact-name">' + escapeHtml(c.name || '联系人') + '</div>' +
        '<div class="contact-bio">' + escapeHtml(c.bio || '') + '</div></div>';
      item.addEventListener('click', () => {
        playSynthSound('click');
        currentIdx = idx;
        renderContacts();
        loadChat(contacts[idx]);
      });
      contactsList.appendChild(item);
    });
  }

  function appendMessage(sender, text, avatar) {
    if (!messagesEl) return;
    const isUser = sender === 'user' || sender === 'player';
    const row = document.createElement('div');
    row.className = 'msg-row ' + (isUser ? 'msg-user sent' : 'msg-npc received');
    const avDiv = document.createElement('div');
    avDiv.className = 'msg-avatar';
    avDiv.innerHTML = isUser ? '👤' : renderAvatar(avatar, '🤖');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    if (!isUser) playSynthSound('notify');
    if (isUser) { row.appendChild(bubble); row.appendChild(avDiv); }
    else { row.appendChild(avDiv); row.appendChild(bubble); }
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderChoices(choices, contact) {
    if (!choicesEl) return;
    choicesEl.innerHTML = '';
    if (!choices || !choices.length) return;
    const unlockedChoices = choices.filter(choice => hasClue(choice.requires || choice.req));
    if (unlockedChoices.length === 0) {
      const hint = document.createElement('div');
      hint.style.cssText = 'padding: 8px 14px; font-size: 11.5px; color: #94a3b8; font-style: italic; text-align: center; width: 100%;';
      hint.textContent = '（暂无可提交的调查物证。请先在电脑桌面、灵异论坛与全网搜索引擎中搜集线索...）';
      choicesEl.appendChild(hint);
      return;
    }
    unlockedChoices.forEach(choice => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'choice-btn'; btn.textContent = choice.text;
      btn.addEventListener('click', () => { playSynthSound('click'); armChoice(choice, contact); });
      choicesEl.appendChild(btn);
    });
  }

  var pendingChoice = null;
  function disarmSend() {
    pendingChoice = null;
    if (form) {
      const send = form.querySelector('button[type="submit"],.chat-send-btn,button');
      if (send) send.classList.remove('arg-send-armed');
    }
    if (choicesEl) { const hint = choicesEl.querySelector('.arg-scripted-hint'); if (hint) hint.remove(); }
  }
  function armChoice(choice, contact) {
    if (!input || !form || choice.say === false) { fireChoice(choice, contact); return; }
    pendingChoice = { choice: choice, contact: contact };
    input.value = choice.text;
    try { input.focus(); } catch (e) {}
    const send = form.querySelector('button[type="submit"],.chat-send-btn,button');
    if (send) send.classList.add('arg-send-armed');
    if (choicesEl && !choicesEl.querySelector('.arg-scripted-hint')) {
      const hint = document.createElement('div');
      hint.className = 'arg-scripted-hint';
      hint.textContent = '↑ 话替你打在框里了。按不按出去，你自己决定。';
      choicesEl.appendChild(hint);
    }
  }
  function fireChoice(choice, contact) {
    disarmSend();
    appendAction(choice.text);
    logMsg(contact.id, 'action', choice.text);
    if (choice.reply) {
      npcSay(choice.reply, contact, function () { if (choice.target) setTimeout(function () { go(choice.target); }, 460); });
    } else if (choice.target) {
      setTimeout(function () { go(choice.target); }, 260);
    }
  }

  function loadChat(contact) {
    if (nameEl) nameEl.textContent = contact.name;
    if (bioEl) bioEl.textContent = contact.bio || '';
    if (messagesEl) messagesEl.innerHTML = '';
    if (choicesEl) choicesEl.innerHTML = '';
    const timeDiv = document.createElement('div');
    timeDiv.className = 'msg-time-divider';
    timeDiv.textContent = '—— 今日对话加密保护中 ——';
    messagesEl.appendChild(timeDiv);
    if (contact.messages && contact.messages.length) contact.messages.forEach(m => { renderMessage(m, contact); });
    let history = [];
    try { history = readChatLog()[contact.id] || []; } catch (e) {}
    history.forEach(m => {
      if (m.s === 'action') appendAction(m.t);
      else appendMessage(m.s === 'user' ? 'user' : 'npc', m.t, contact.avatar);
    });
    if (contact.dialogue && contact.dialogue.length) {
      contact.dialogue.forEach(item => {
        if (item.sender === 'npc' && item.text) appendMessage('npc', item.text, contact.avatar);
        else if ((item.sender === 'user' || item.sender === 'player') && item.text) appendMessage('user', item.text);
        else if (item.sender === 'choice' && item.options) renderChoices(item.options, contact);
      });
    }
    if (contact.choices && contact.choices.length) renderChoices(contact.choices, contact);
  }

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const contact = contacts[currentIdx];
      if (pendingChoice && pendingChoice.contact === contact && text === pendingChoice.choice.text) {
        const pc = pendingChoice; input.value = ''; fireChoice(pc.choice, pc.contact); return;
      }
      disarmSend();
      input.value = '';
      appendMessage('user', text);
      stampRow();
      logMsg(contact.id, 'user', text);
      const accepted = String(contact.passphrase || '').split(/[,，;|/]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const hit = accepted.length > 0 && accepted.indexOf(text.toLowerCase()) !== -1;
      let replyText;
      if (hit) {
        replyText = contact.passphraseReply || '……对。就是这个。';
        if (contact.passphraseClue) triggerClue(contact.passphraseClue);
      } else {
        const pool = (contact.fallbackReplies && contact.fallbackReplies.length) ? contact.fallbackReplies :
          ['（对方沉默了很久。）', '（对方正在输入，又停下了。）', '（对方只回了一个句号。）', '（对方没有回复。海那头的信号，断断续续。）', '（对方把话头，轻轻收了回去。）'];
        const logLen = (() => { try { return (readChatLog()[contact.id] || []).length; } catch (e) { return 0; } })();
        replyText = pool[logLen % pool.length];
      }
      npcSay(replyText, contact, function () { if (hit && contact.passphraseTarget) setTimeout(() => go(contact.passphraseTarget), 520); });
    });
  }

  renderContacts();
  if (contacts.length > 0) loadChat(contacts[0]);
}
