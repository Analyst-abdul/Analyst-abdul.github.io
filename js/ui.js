const UI = {
  showAuth(){ $('#auth-view').classList.remove('hidden'); $('#app-view').classList.add('hidden'); },
  showApp(){ $('#auth-view').classList.add('hidden'); $('#app-view').classList.remove('hidden'); },

  go(page){
    $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
    $$('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.go === page));
    window.scrollTo({top:0,behavior:'smooth'});
    if (page==='dashboard'){ Charts.trend($('#range-select').value); Charts.pie(); }
    if (page==='analytics'){ Charts.bar(); Charts.savings(); Charts.catBar(); }
  },

  renderTopbar(){
    $('#user-name').textContent = State.profile?.display_name || State.user.email;
    const sel = $('#view-user');
    const opts = [`<option value="${State.user.id}">My data</option>`];
    State.sharedWithMe.forEach(s => {
      const n = s.profiles?.display_name || 'Shared user';
      opts.push(`<option value="${s.owner_id}">${sanitize(n)} (read-only)</option>`);
    });
    sel.innerHTML = opts.join('');
    sel.value = State.viewUserId;
  },

  renderDashboard(){
    const t = Data.totals($('#range-select').value);
    $('#kpi-balance').textContent = fmtMoney(t.balance);
    $('#kpi-income').textContent  = fmtMoney(t.income);
    $('#kpi-expense').textContent = fmtMoney(t.expense);
    $('#kpi-budget').textContent  = fmtMoney(t.budgetLeft);

    // recent
    const recent = State.transactions.slice(0,8);
    $('#recent-tx').innerHTML = recent.length ? recent.map(tx => UI._txRow(tx,true)).join('') : '<li class="muted">No transactions yet.</li>';

    // accounts mini
    $('#acct-mini').innerHTML = State.accounts.map(a => `
      <div class="a">
        <small class="muted">${sanitize(a.name)}</small>
        <b>${fmtMoney(Data.accountBalance(a))}</b>
      </div>`).join('') || '<div class="muted">No accounts.</div>';
  },

  renderAccounts(){
    $('#acct-list').innerHTML = State.accounts.map(a => `
      <li>
        <div class="meta"><b>${sanitize(a.name)}</b><small>${sanitize(a.type)} • initial ${fmtMoney(a.initial_balance)}</small></div>
        <div class="meta" style="align-items:flex-end"><b>${fmtMoney(Data.accountBalance(a))}</b>
          ${Data.isReadOnly() ? '' : `<div class="actions">
            <button data-edit-acct="${a.id}">✏️</button>
            <button data-del-acct="${a.id}">🗑️</button>
          </div>`}
        </div>
      </li>`).join('') || '<li class="muted">No accounts.</li>';

    // transfer selects
    const opts = State.accounts.map(a=>`<option value="${a.id}">${sanitize(a.name)}</option>`).join('');
    $('#transfer-form [name=from]').innerHTML = opts;
    $('#transfer-form [name=to]').innerHTML = opts;
    $('#transfer-form').style.display = Data.isReadOnly() ? 'none' : '';
    $('#add-acct-btn').style.display = Data.isReadOnly() ? 'none' : '';
  },

  renderTransactions(){
    const q = $('#tx-search').value.toLowerCase();
    const month = $('#tx-month').value; // yyyy-mm
    const catId = $('#tx-cat-filter').value;
    let list = State.transactions.slice();
    if (q) list = list.filter(t => (t.note||'').toLowerCase().includes(q));
    if (month) list = list.filter(t => t.date.slice(0,7) === month);
    if (catId) list = list.filter(t => t.category_id === catId);
    $('#tx-list').innerHTML = list.map(t => UI._txRow(t)).join('') || '<li class="muted">No transactions.</li>';
    // category filter
    $('#tx-cat-filter').innerHTML = '<option value="">All categories</option>' +
      State.categories.map(c=>`<option value="${c.id}">${c.icon||''} ${sanitize(c.name)}</option>`).join('');
    $('#add-tx-btn').style.display = Data.isReadOnly() ? 'none' : '';
  },

  _txRow(t, mini=false){
    const acc = State.accounts.find(a=>a.id===t.account_id);
    const cat = State.categories.find(c=>c.id===t.category_id);
    const isExp = Number(t.amount) < 0 || t.type==='expense';
    const sign = t.type==='income' ? '+' : (t.type==='expense' ? '−' : '↔');
    const cls = t.type==='income' ? 'pos' : (t.type==='expense' ? 'neg' : '');
    return `<li>
      <div class="meta">
        <b>${cat?.icon||''} ${sanitize(cat?.name || t.note || t.type)}</b>
        <small>${fmtDate(t.date)} • ${sanitize(acc?.name||'')}${t.note ? ' • '+sanitize(t.note) : ''}</small>
      </div>
      <div class="meta" style="align-items:flex-end">
        <b class="${cls}">${sign}${fmtMoney(Math.abs(t.amount))}</b>
        ${(!mini && !Data.isReadOnly()) ? `<div class="actions"><button data-edit-tx="${t.id}">✏️</button><button data-del-tx="${t.id}">🗑️</button></div>` : ''}
      </div>
    </li>`;
  },

  renderBudgets(){
    const [start] = thisMonthRange();
    $('#budget-list').innerHTML = State.budgets.map(b => {
      const cat = State.categories.find(c=>c.id===b.category_id);
      const spent = State.transactions
        .filter(t => t.type==='expense' && t.category_id===b.category_id && new Date(t.date)>=start)
        .reduce((s,t)=>s+Math.abs(Number(t.amount)),0);
      const pct = Math.min(100, (spent / Number(b.amount||1))*100);
      const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
      return `<li style="display:block">
        <div style="display:flex;justify-content:space-between">
          <b>${cat?.icon||''} ${sanitize(cat?.name||'—')}</b>
          <span>${fmtMoney(spent)} / ${fmtMoney(b.amount)}</span>
        </div>
        <div class="progress ${cls}"><div style="width:${pct}%"></div></div>
        ${Data.isReadOnly() ? '' : `<div class="actions" style="justify-content:flex-end;margin-top:6px"><button data-del-budget="${b.id}">🗑️</button></div>`}
      </li>`;
    }).join('') || '<li class="muted">No budgets set.</li>';

    $('#cat-list').innerHTML = State.categories.map(c => `
      <li><div class="meta"><b>${c.icon||'📁'} ${sanitize(c.name)}</b><small>${c.kind}</small></div>
      ${Data.isReadOnly() ? '' : `<div class="actions"><button data-del-cat="${c.id}">🗑️</button></div>`}
      </li>`).join('') || '<li class="muted">No categories.</li>';
    $('#add-budget-btn').style.display = Data.isReadOnly() ? 'none' : '';
    $('#add-cat-btn').style.display = Data.isReadOnly() ? 'none' : '';
  },

  renderSettings(){
    $('#profile-form [name=display_name]').value = State.profile?.display_name || '';
    $('#profile-form [name=currency]').value = State.profile?.currency || 'USD';
    $('#share-list').innerHTML = State.sharedToOthers.map(s => `
      <li><div class="meta"><b>${sanitize(s.profiles?.display_name||'User')}</b><small>read access</small></div>
      <div class="actions"><button data-unshare="${s.shared_with_id}">Remove</button></div></li>
    `).join('') || '<li class="muted">Not sharing with anyone.</li>';
  },

  openModal(title, html){
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = html;
    $('#modal').classList.remove('hidden');
  },
  closeModal(){ $('#modal').classList.add('hidden'); $('#modal-body').innerHTML=''; },

  renderAll(){
    UI.renderTopbar();
    UI.renderDashboard();
    UI.renderAccounts();
    UI.renderTransactions();
    UI.renderBudgets();
    UI.renderSettings();
    Charts.trend($('#range-select').value);
    Charts.pie();
  }
};
