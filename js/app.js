// ===== Theme =====
(function initTheme(){
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme','dark');
})();
document.addEventListener('click', e => {
  if (e.target.id === 'theme-toggle'){
    const cur = document.documentElement.getAttribute('data-theme')==='dark' ? '' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('theme', cur);
  }
});

// ===== Auth UI =====
$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x=>x.classList.toggle('active', x===t));
  ['login','register','forgot'].forEach(k => $(`#${k}-form`).classList.toggle('hidden', k!==t.dataset.tab));
  $('#auth-msg').textContent = '';
}));

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); showLoader();
  const fd = new FormData(e.target);
  const { error } = await Auth.signIn(fd.get('email').trim(), fd.get('password'));
  showLoader(false);
  if (error) $('#auth-msg').textContent = error.message;
});
$('#register-form').addEventListener('submit', async e => {
  e.preventDefault(); showLoader();
  const fd = new FormData(e.target);
  const { error } = await Auth.signUp(fd.get('email').trim(), fd.get('password'), fd.get('name').trim());
  showLoader(false);
  $('#auth-msg').style.color = error ? 'var(--neg)' : 'var(--pos)';
  $('#auth-msg').textContent = error ? error.message : 'Check your email to confirm your account.';
});
$('#forgot-form').addEventListener('submit', async e => {
  e.preventDefault(); showLoader();
  const fd = new FormData(e.target);
  const { error } = await Auth.forgot(fd.get('email').trim());
  showLoader(false);
  $('#auth-msg').style.color = error ? 'var(--neg)' : 'var(--pos)';
  $('#auth-msg').textContent = error ? error.message : 'Password reset email sent.';
});

// ===== Bottom Nav =====
$$('.bottom-nav button').forEach(b => b.addEventListener('click', () => UI.go(b.dataset.go)));

// ===== View user selector =====
$('#view-user').addEventListener('change', async e => {
  State.viewUserId = e.target.value;
  showLoader();
  await Data.loadAll();
  UI.renderAll();
  showLoader(false);
  if (Data.isReadOnly()) toast('Read-only view');
});

// ===== Range =====
$('#range-select').addEventListener('change', () => UI.renderDashboard() || Charts.trend($('#range-select').value));

// ===== Modal =====
$('#modal-close').addEventListener('click', UI.closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id==='modal') UI.closeModal(); });

// ===== Account modal =====
$('#add-acct-btn').addEventListener('click', () => openAccountModal());
function openAccountModal(acc=null){
  UI.openModal(acc?'Edit account':'New account', `
    <form id="acct-form" class="grid-form">
      <input name="name" required placeholder="Account name" value="${sanitize(acc?.name||'')}" />
      <select name="type">
        ${['cash','bank','wallet','upi','credit_card'].map(t=>`<option ${acc?.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <input name="initial_balance" type="number" step="0.01" placeholder="Initial balance" value="${acc?.initial_balance ?? 0}" />
      <button class="btn primary" type="submit">${acc?'Save':'Create'}</button>
    </form>
  `);
  $('#acct-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { name: fd.get('name').trim(), type: fd.get('type'), initial_balance: Number(fd.get('initial_balance')||0) };
    showLoader();
    const res = acc ? await Data.updateAccount(acc.id, payload) : await Data.addAccount(payload);
    showLoader(false);
    if (res.error) return toast(res.error.message);
    UI.closeModal(); await refresh(); toast('Saved');
  });
}

// ===== Transaction modal =====
$('#add-tx-btn').addEventListener('click', () => openTxModal());
function openTxModal(tx=null){
  const accOpts = State.accounts.map(a=>`<option value="${a.id}" ${tx?.account_id===a.id?'selected':''}>${sanitize(a.name)}</option>`).join('');
  const catOpts = (kind) => State.categories.filter(c=>c.kind===kind)
    .map(c=>`<option value="${c.id}" ${tx?.category_id===c.id?'selected':''}>${c.icon||''} ${sanitize(c.name)}</option>`).join('');
  UI.openModal(tx?'Edit transaction':'New transaction', `
    <form id="tx-form" class="grid-form">
      <select name="type">
        <option value="expense" ${tx?.type==='expense'?'selected':''}>Expense</option>
        <option value="income" ${tx?.type==='income'?'selected':''}>Income</option>
      </select>
      <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount" value="${tx?Math.abs(tx.amount):''}" />
      <select name="account_id" required>${accOpts}</select>
      <select name="category_id" required id="tx-cat-sel"></select>
      <input name="date" type="date" required value="${tx? ymd(tx.date) : ymd(new Date())}" />
      <input name="note" placeholder="Note" value="${sanitize(tx?.note||'')}" />
      <input name="attachment" type="file" accept="image/*" />
      <button class="btn primary" type="submit">${tx?'Save':'Add'}</button>
    </form>
  `);
  const refreshCats = () => { $('#tx-cat-sel').innerHTML = catOpts($('#tx-form [name=type]').value); };
  $('#tx-form [name=type]').addEventListener('change', refreshCats); refreshCats();

  $('#tx-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = fd.get('type');
    const amount = type==='expense' ? -Math.abs(Number(fd.get('amount'))) : Math.abs(Number(fd.get('amount')));
    const payload = {
      type, amount, account_id: fd.get('account_id'), category_id: fd.get('category_id'),
      date: fd.get('date'), note: fd.get('note') || null
    };
    showLoader();
    // Upload attachment if present
    const file = fd.get('attachment');
    if (file && file.size) {
      const path = `${State.user.id}/${Date.now()}_${file.name}`;
      const up = await sb.storage.from('receipts').upload(path, file, { upsert:false });
      if (!up.error) payload.attachment_url = path;
    }
    const res = tx ? await Data.updateTransaction(tx.id, payload) : await Data.addTransaction(payload);
    showLoader(false);
    if (res.error) return toast(res.error.message);
    UI.closeModal(); await refresh(); toast('Saved'); checkBudgetAlerts();
  });
}

// ===== Category modal =====
$('#add-cat-btn').addEventListener('click', () => {
  UI.openModal('New category', `
    <form id="cat-form" class="grid-form">
      <input name="name" required placeholder="Name" />
      <input name="icon" placeholder="Icon (emoji) e.g. 🍔" />
      <select name="kind"><option value="expense">Expense</option><option value="income">Income</option></select>
      <button class="btn primary" type="submit">Create</button>
    </form>
  `);
  $('#cat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    showLoader();
    const res = await Data.addCategory({ name: fd.get('name').trim(), icon: fd.get('icon'), kind: fd.get('kind') });
    showLoader(false);
    if (res.error) return toast(res.error.message);
    UI.closeModal(); await refresh(); toast('Category added');
  });
});

// ===== Budget modal =====
$('#add-budget-btn').addEventListener('click', () => {
  const catOpts = State.categories.filter(c=>c.kind==='expense').map(c=>`<option value="${c.id}">${c.icon||''} ${sanitize(c.name)}</option>`).join('');
  const [start] = thisMonthRange();
  UI.openModal('Set budget', `
    <form id="budget-form" class="grid-form">
      <select name="category_id" required>${catOpts}</select>
      <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Monthly amount" />
      <button class="btn primary" type="submit">Save</button>
    </form>
  `);
  $('#budget-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    showLoader();
    const res = await Data.addBudget({
      category_id: fd.get('category_id'),
      amount: Number(fd.get('amount')),
      period_start: ymd(start)
    });
    showLoader(false);
    if (res.error) return toast(res.error.message);
    UI.closeModal(); await refresh(); toast('Budget saved');
  });
});

// ===== List actions delegation =====
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.dataset.editAcct){ openAccountModal(State.accounts.find(a=>a.id===t.dataset.editAcct)); }
  else if (t.dataset.delAcct){ if (confirm('Delete account? Related transactions remain.')){ showLoader(); await Data.deleteAccount(t.dataset.delAcct); showLoader(false); await refresh(); }}
  else if (t.dataset.editTx){ openTxModal(State.transactions.find(x=>x.id===t.dataset.editTx)); }
  else if (t.dataset.delTx){ if (confirm('Delete transaction?')){ showLoader(); await Data.deleteTransaction(t.dataset.delTx); showLoader(false); await refresh(); }}
  else if (t.dataset.delBudget){ showLoader(); await Data.deleteBudget(t.dataset.delBudget); showLoader(false); await refresh(); }
  else if (t.dataset.delCat){ if (confirm('Delete category?')){ showLoader(); await Data.deleteCategory(t.dataset.delCat); showLoader(false); await refresh(); }}
  else if (t.dataset.unshare){ showLoader(); await Data.unshare(t.dataset.unshare); await Data.loadShares(); UI.renderSettings(); showLoader(false); toast('Removed'); }
});

// Filters
['tx-search','tx-month','tx-cat-filter'].forEach(id => $('#'+id).addEventListener('input', UI.renderTransactions));

// Transfer
$('#transfer-form').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  if (fd.get('from')===fd.get('to')) return toast('Choose two different accounts');
  showLoader();
  const res = await Data.transfer({ from: fd.get('from'), to: fd.get('to'), amount: Number(fd.get('amount')), date: new Date().toISOString() });
  showLoader(false);
  if (res.error) return toast(res.error.message);
  e.target.reset(); await refresh(); toast('Transferred');
});

// Profile / Share / Logout
$('#profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  showLoader();
  const { error } = await sb.from('profiles').update({ display_name: fd.get('display_name'), currency: fd.get('currency') }).eq('id', State.user.id);
  showLoader(false);
  if (error) return toast(error.message);
  await Data.loadProfile(); UI.renderTopbar(); UI.renderDashboard(); toast('Profile saved');
});
$('#share-form').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try { showLoader(); await Data.shareWith(fd.get('email').trim()); await Data.loadShares(); UI.renderSettings(); UI.renderTopbar(); toast('Shared'); }
  catch(err){ toast(err.message); } finally { showLoader(false); }
});
$('#logout-btn').addEventListener('click', async () => { await Auth.signOut(); location.reload(); });

// Exports
$('#export-json').addEventListener('click', () => downloadFile('fintrack.json','application/json', JSON.stringify({ accounts:State.accounts, transactions:State.transactions, categories:State.categories, budgets:State.budgets }, null, 2)));
$('#export-csv').addEventListener('click', () => {
  const rows = [['date','type','amount','account','category','note']];
  State.transactions.forEach(t => rows.push([t.date, t.type, t.amount, State.accounts.find(a=>a.id===t.account_id)?.name||'', State.categories.find(c=>c.id===t.category_id)?.name||'', (t.note||'').replace(/[\n,]/g,' ')]));
  downloadFile('transactions.csv','text/csv', rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'));
});
$('#export-pdf').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text('FinTrack — Transactions', 14, 16);
  doc.setFontSize(10);
  let y = 26;
  State.transactions.slice(0,40).forEach(t => {
    const a = State.accounts.find(x=>x.id===t.account_id)?.name||'';
    const c = State.categories.find(x=>x.id===t.category_id)?.name||'';
    doc.text(`${fmtDate(t.date)}  ${t.type.padEnd(8)}  ${String(t.amount).padStart(10)}  ${c}  ${a}  ${t.note||''}`.slice(0,110), 14, y);
    y += 6; if (y>280){ doc.addPage(); y = 16; }
  });
  doc.save('transactions.pdf');
});
function downloadFile(name, type, content){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

// PWA install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#install-btn').classList.remove('hidden'); });
$('#install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt = null; $('#install-btn').classList.add('hidden');
});

// Budget alerts
function checkBudgetAlerts(){
  const [start] = thisMonthRange();
  State.budgets.forEach(b => {
    const spent = State.transactions
      .filter(t=>t.type==='expense' && t.category_id===b.category_id && new Date(t.date)>=start)
      .reduce((s,t)=>s+Math.abs(Number(t.amount)),0);
    if (spent >= Number(b.amount)) {
      const cat = State.categories.find(c=>c.id===b.category_id);
      toast(`⚠️ Over budget: ${cat?.name}`);
    }
  });
}

// Refresh wrapper
async function refresh(){ await Data.loadAll(); UI.renderAll(); }

// Realtime subscriptions
function subscribeRealtime(){
  ['accounts','transactions','categories','budgets'].forEach(table => {
    sb.channel(`rt-${table}`).on('postgres_changes', { event:'*', schema:'public', table }, () => {
      if (document.visibilityState==='visible') refresh();
    }).subscribe();
  });
}

// Boot
(async function boot(){
  // Guard against placeholder config
  if (window.FINTRACK_CONFIG.SUPABASE_URL.includes('YOUR-PROJECT')){
    $('#auth-msg').textContent = '⚠️ Set your Supabase URL & anon key in js/config.js';
  }
  showLoader();
  const session = await Auth.getSession();
  if (session?.user){
    State.user = session.user;
    State.viewUserId = session.user.id;
    await Data.loadProfile();
    await Data.loadShares();
    await Data.loadAll();
    UI.showApp(); UI.renderAll();
    subscribeRealtime();
  } else {
    UI.showAuth();
  }
  showLoader(false);

  sb.auth.onAuthStateChange((_evt, sess) => {
    if (sess?.user && !State.user){ location.reload(); }
    if (!sess && State.user){ location.reload(); }
  });
})();
