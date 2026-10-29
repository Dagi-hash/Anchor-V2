(function () {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plug = n => { try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null; } catch (e) { return null; } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const KEY = 'anchor.v1', MAX = 5;
const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const I = {
  gear: '<circle cx="12" cy="12" r="2.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>'
};
const ic = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

/* ---------- state ---------- */
function fresh() { return { day: dayKey(), tasks: [], settings: { autoReset: true, anim: true, haptics: true, remind: false, remindTime: '08:00', theme: 'dark' } }; }
let S;
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY)); const d = fresh();
    if (!r || typeof r !== 'object') return d;
    d.day = typeof r.day === 'string' ? r.day : d.day;
    d.settings = Object.assign(d.settings, r.settings || {});
    d.tasks = (Array.isArray(r.tasks) ? r.tasks : []).slice(0, MAX).map(t => ({ id: String(t.id || uid()), text: String(t.text || '').slice(0, 80), done: !!t.done })).filter(t => t.text);
    return d;
  } catch (e) { return fresh(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
function rollover() {
  const k = dayKey();
  if (S.day === k) return false;
  S.day = k;
  if (S.settings.autoReset) { S.tasks = []; save(); return true; }
  save(); return false;
}

function applyTheme() {
  const light = S.settings.theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? '#ffffff' : '#000000';
  const SB = plug('StatusBar'); if (SB) { try { SB.setBackgroundColor({ color: light ? '#FFFFFF' : '#000000' }); SB.setStyle({ style: light ? 'LIGHT' : 'DARK' }); } catch (e) { } }
}

/* ---------- feel ---------- */
function buzz(strong) {
  if (!S.settings.haptics) return;
  try { const H = plug('Haptics'); if (H && H.impact) H.impact({ style: strong ? 'MEDIUM' : 'LIGHT' }); else if (navigator.vibrate) navigator.vibrate(strong ? 14 : 8); } catch (e) { }
}
function wave(x, y) {
  if (!S.settings.anim) return;
  const w = $('#waves');
  [0, 140, 300].forEach((d, i) => {
    const r = document.createElement('i'); r.className = 'ring';
    r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.animationDelay = d + 'ms';
    if (i) r.style.borderColor = 'rgba(var(--ring),' + (0.22 - i * 0.07) + ')';
    w.appendChild(r); setTimeout(() => r.remove(), 1500 + d);
  });
}
let tT;
function toast(msg, label, fn) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button>${esc(label)}</button>` : ''}`;
  t.classList.toggle('act', !!label); t.classList.add('show');
  if (label) t.querySelector('button').onclick = () => { t.classList.remove('show', 'act'); clearTimeout(tT); fn && fn(); };
  clearTimeout(tT); tT = setTimeout(() => t.classList.remove('show', 'act'), label ? 4200 : 2400);
}

/* ---------- render ---------- */
let first = true;
function render(opts) {
  opts = opts || {};
  const m = $('#main');
  if (!S.tasks.length) {
    m.innerHTML = `<div class="empty"><i class="alogo"></i><h1>What matters today?</h1><p>Up to five priorities.</p><button class="go" id="start">Begin</button></div>`;
    $('#start').onclick = () => { buzz(); openInput({ chain: true }); };
    $('#plus').classList.add('hide');
  } else {
    $('#plus').classList.remove('hide');
    const all = S.tasks.every(t => t.done) && S.tasks.length === MAX;
    m.innerHTML = `<div class="list">${S.tasks.map((t, i) => `<div class="task ${t.done ? 'done' : ''} ${first || opts.noanim ? 'noanim' : ''}" data-id="${esc(t.id)}" style="--i:${first ? i : 0}"><span class="t">${esc(t.text)}</span></div>`).join('')}</div>${all ? '<div class="fin"><b>Everything done.</b><span>Enjoy the rest of your day.</span></div>' : ''}`;
    if (opts.enter) { const el = m.querySelector('[data-id="' + opts.enter + '"]'); if (el) { el.classList.remove('noanim'); el.classList.add('enter'); } }
  }
  first = false;
}
$('#gear').innerHTML = ic('gear', 22);
$('#plus').innerHTML = ic('plus', 22);

/* ---------- tasks: tap = complete, hold = edit ---------- */
let press = null, held = false;
const main = $('#main');
main.addEventListener('pointerdown', e => {
  const el = e.target.closest('.task'); if (!el) return;
  held = false; const x = e.clientX, y = e.clientY;
  press = { el, x, y, t: setTimeout(() => { held = true; press = null; buzz(true); openInput({ id: el.dataset.id }); }, 480) };
});
main.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.t); press = null; held = true; } });
['pointerup', 'pointercancel'].forEach(ev => main.addEventListener(ev, e => {
  if (!press) return; clearTimeout(press.t);
  const { el, x, y } = press; press = null; held = false;
  toggle(el.dataset.id, x, y);
}));
main.addEventListener('contextmenu', e => e.preventDefault());
function dropFin() { const f = document.querySelector('.fin'); if (f) { f.classList.add('out'); setTimeout(() => f.remove(), 360); } }
function toggle(id, x, y) {
  const t = S.tasks.find(t => t.id === id); if (!t) return;
  const el = $('.task[data-id="' + id + '"]');
  wave(x, y);
  t.done = !t.done; save();
  const finished = S.tasks.length === MAX && S.tasks.every(a => a.done);
  if (S.settings.anim) setTimeout(apply, 120); else apply();
  function apply() {
    if (!el || !el.isConnected) return render({ noanim: true });
    el.classList.remove('noanim'); el.classList.toggle('done', t.done);
    if (!t.done) dropFin();
    if (finished) setTimeout(() => render({ noanim: true }), 700);
  }
  if (t.done) {
    buzz();
    toast('Task completed', 'Undo', () => { t.done = false; save(); const e2 = $('.task[data-id="' + id + '"]'); if (e2) { e2.classList.remove('noanim'); e2.classList.remove('done'); dropFin(); } else render({ noanim: true }); });
  } else { buzz(); $('#toast').classList.remove('show'); }
}

/* ---------- add / edit ---------- */
function openInput(o) {
  const sh = $('#sheet'); const t = o.id ? S.tasks.find(t => t.id === o.id) : null;
  if (!t && S.tasks.length >= MAX) { toast('Five priorities are enough for today.'); return; }
  const label = t ? 'Edit' : (o.chain && S.tasks.length ? 'Next priority' : 'What matters?');
  sh.innerHTML = `<div class="box"><label>${label}</label><input id="in" maxlength="80" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" value="${t ? esc(t.text) : ''}" placeholder="${t ? '' : 'Write it here'}"><div class="row"><div class="l">${t ? '<button class="txt warn" id="del">Delete</button>' : ''}<button class="txt" id="cancel">${o.chain && S.tasks.length ? 'Done' : 'Cancel'}</button></div><button class="txt pri" id="ok">${t ? 'Save' : 'Add'}</button></div></div>`;
  sh.classList.add('open'); sheetOpen = true;
  const inp = $('#in'); setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 120);
  const close = () => { sh.classList.remove('open'); sh.innerHTML = ''; sheetOpen = false; };
  const submit = () => {
    const v = inp.value.trim();
    if (!v) { if (!t) close(); return; }
    if (t) { t.text = v; save(); close(); render({ noanim: true }); return; }
    const n = { id: uid(), text: v, done: false }; S.tasks.push(n); save(); buzz();
    if (o.chain && S.tasks.length < MAX) { render({ enter: n.id }); openInput({ chain: true }); return; }
    close(); render({ enter: n.id });
    if (S.tasks.length === MAX) setTimeout(() => toast('Five priorities are enough for today.'), 600);
  };
  $('#ok').onclick = submit; $('#cancel').onclick = close;
  const d = $('#del'); if (d) d.onclick = () => { const el = $('.task[data-id="' + t.id + '"]'); close(); if (el) el.classList.add('leave'); setTimeout(() => { S.tasks = S.tasks.filter(a => a.id !== t.id); save(); render({ noanim: true }); }, 340); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  sh.onclick = e => { if (e.target === sh) close(); };
}
let sheetOpen = false;
$('#plus').onclick = () => { buzz(); openInput({}); };

/* ---------- dialog ---------- */
function confirmBox(title, text, ok, fn) {
  const d = $('#dialog');
  d.innerHTML = `<div class="dlg"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}<div class="acts"><button class="txt" id="dn">Cancel</button><button class="txt pri" id="dy">${esc(ok)}</button></div></div>`;
  d.classList.add('open');
  const close = () => { d.classList.remove('open'); d.innerHTML = ''; };
  $('#dn').onclick = close; $('#dy').onclick = () => { close(); fn(); };
  d.onclick = e => { if (e.target === d) close(); };
}

/* ---------- settings ---------- */
function sw(k, label, sub) { return `<button class="srow" data-k="${k}"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><i class="sw ${S.settings[k] ? 'on' : ''}"></i></button>`; }
function renderSettings() {
  $('#settings').innerHTML = `<div class="sh"><button id="sback" aria-label="Back">${ic('back')}</button><h2>Settings</h2></div><div class="sl"><div class="gl">Theme</div><div class="opts"><button data-th="dark" class="${S.settings.theme !== 'light' ? 'on' : ''}">Black</button><button data-th="light" class="${S.settings.theme === 'light' ? 'on' : ''}">White</button></div>${sw('autoReset', 'Automatic daily reset', 'Start every day with a clean slate')}${sw('anim', 'Completion animation')}${sw('haptics', 'Haptic feedback')}${sw('remind', 'Daily reminder', 'A quiet nudge: What matters today?')}${S.settings.remind ? `<label class="srow"><span>Reminder time</span><input id="rt" type="time" value="${S.settings.remindTime}" style="background:none;border:0;color:var(--tx);font-size:16px;outline:0"></label>` : ''}<button class="srow" id="rs"><span>Reset today’s tasks</span></button><button class="srow d" id="ca"><span>Clear all data</span></button><div class="sf"><i class="alogo"></i><div>Stay anchored to what matters.</div><div style="margin-top:6px">Developed by Dagim Bireda</div></div></div>`;
  $('#sback').onclick = closeSettings;
  document.querySelectorAll('#settings [data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; S.settings[k] = !S.settings[k]; save(); b.querySelector('.sw').classList.toggle('on', S.settings[k]); buzz(); if (k === 'remind') { syncRemind(true).then(() => renderSettings()); } });
  document.querySelectorAll('#settings [data-th]').forEach(b => b.onclick = () => { S.settings.theme = b.dataset.th; save(); buzz(); applyTheme(); document.querySelectorAll('#settings [data-th]').forEach(x => x.classList.toggle('on', x === b)); });
  const rt = $('#rt'); if (rt) rt.onchange = () => { if (rt.value) { S.settings.remindTime = rt.value; save(); syncRemind(false); toast('Reminder set for ' + rt.value); } };
  $('#rs').onclick = () => confirmBox('Start fresh?', '', 'Reset', () => { S.tasks = []; save(); closeSettings(); render(); });
  $('#ca').onclick = () => confirmBox('Clear everything?', 'This removes your tasks and settings.', 'Clear', () => { S = fresh(); save(); first = true; applyTheme(); closeSettings(); render(); });
}
async function syncRemind(ask) {
  const LN = plug('LocalNotifications');
  if (!LN) { if (ask && S.settings.remind) toast('Reminders work in the installed app'); return; }
  try {
    await LN.cancel({ notifications: [{ id: 1 }] });
    if (!S.settings.remind) return;
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') { S.settings.remind = false; save(); toast('Allow notifications to get the reminder'); return; }
    const [h, m] = (S.settings.remindTime || '08:00').split(':').map(Number);
    await LN.schedule({ notifications: [{ id: 1, title: 'Anchor', body: 'What matters today?', schedule: { on: { hour: h, minute: m }, allowWhileIdle: true } }] });
    if (ask) toast('Daily reminder is on');
  } catch (e) { S.settings.remind = false; save(); toast('Could not set the reminder'); }
}
let setOpen = false;
function openSettings() { renderSettings(); $('#settings').classList.add('open'); setOpen = true; }
function closeSettings() { $('#settings').classList.remove('open'); setOpen = false; }
$('#gear').onclick = () => { buzz(); openSettings(); };

/* ---------- lifecycle ---------- */
function tick() { if (rollover()) { render(); } }
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
function back() {
  if ($('#dialog').classList.contains('open')) { $('#dialog').classList.remove('open'); return; }
  if (sheetOpen) { $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; sheetOpen = false; return; }
  if (setOpen) { closeSettings(); return; }
  const A = plug('App'); if (A && A.exitApp) A.exitApp();
}
const AP = plug('App'); if (AP && AP.addListener) { try { AP.addListener('backButton', back); } catch (e) { } }

S = load(); applyTheme(); rollover(); save(); render(); if (S.settings.remind) syncRemind(false);
})();
