const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const showLoader = (on=true) => $('#loader').classList.toggle('hidden', !on);
function toast(msg, ms=2200){
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.add('hidden'), ms);
}
function fmtMoney(n, cur){
  const c = cur || State.profile?.currency || window.FINTRACK_CONFIG.DEFAULT_CURRENCY;
  try { return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(n||0)); }
  catch { return `${c} ${Number(n||0).toFixed(2)}`; }
}
function fmtDate(d){ return new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function sanitize(str){ return String(str||'').replace(/[<>]/g, c => ({'<':'&lt;','>':'&gt;'}[c])); }
function ymd(d){ return new Date(d).toISOString().slice(0,10); }
function thisMonthRange(d=new Date()){
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59);
  return [start, end];
}
