// Global state
const State = {
  user: null,             // current auth user
  profile: null,          // profile row
  viewUserId: null,       // currently viewed user (self or shared)
  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  sharedWithMe: [],       // users who shared with me
  sharedToOthers: [],     // users I shared to
};

const Data = {
  isReadOnly(){ return State.viewUserId !== State.user?.id; },

  async loadProfile(){
    const { data, error } = await sb.from('profiles').select('*').eq('id', State.user.id).maybeSingle();
    if (!error && data) State.profile = data;
    if (!data) {
      // create profile if missing
      const ins = await sb.from('profiles').insert({ id: State.user.id, display_name: State.user.email.split('@')[0], currency: window.FINTRACK_CONFIG.DEFAULT_CURRENCY }).select().single();
      State.profile = ins.data;
    }
  },

  async loadShares(){
    // people who shared with me
    const { data: incoming } = await sb.from('shared_users').select('owner_id, profiles!shared_users_owner_id_fkey(display_name, currency)').eq('shared_with_id', State.user.id);
    State.sharedWithMe = incoming || [];
    const { data: outgoing } = await sb.from('shared_users').select('shared_with_id, profiles!shared_users_shared_with_id_fkey(display_name)').eq('owner_id', State.user.id);
    State.sharedToOthers = outgoing || [];
  },

  async loadAll(){
    const uid = State.viewUserId;
    const [a,c,t,b] = await Promise.all([
      sb.from('accounts').select('*').eq('user_id', uid).order('created_at'),
      sb.from('categories').select('*').eq('user_id', uid).order('name'),
      sb.from('transactions').select('*').eq('user_id', uid).order('date',{ascending:false}).limit(500),
      sb.from('budgets').select('*').eq('user_id', uid),
    ]);
    State.accounts = a.data || [];
    State.categories = c.data || [];
    State.transactions = t.data || [];
    State.budgets = b.data || [];

    // Seed defaults for own account on first run
    if (State.viewUserId === State.user.id && State.categories.length === 0) {
      await this.seedDefaults();
      const c2 = await sb.from('categories').select('*').eq('user_id', uid).order('name');
      State.categories = c2.data || [];
    }
  },

  async seedDefaults(){
    const uid = State.user.id;
    const cats = [
      ['Salary','income','💼'],['Business','income','🏢'],['Freelance','income','💻'],['Other Income','income','💰'],
      ['Food','expense','🍔'],['Travel','expense','✈️'],['Shopping','expense','🛍️'],['Medical','expense','💊'],
      ['Bills','expense','🧾'],['EMI','expense','🏦'],['Entertainment','expense','🎬'],['Other','expense','📦']
    ];
    await sb.from('categories').insert(cats.map(([name,kind,icon])=>({user_id:uid,name,kind,icon})));
    if (State.accounts.length === 0) {
      await sb.from('accounts').insert([
        { user_id: uid, name: 'Cash', type: 'cash', initial_balance: 0 },
        { user_id: uid, name: 'Bank', type: 'bank', initial_balance: 0 },
      ]);
    }
  },

  // === Mutations (own data only) ===
  async addAccount(a){ a.user_id = State.user.id; return sb.from('accounts').insert(a).select().single(); },
  async updateAccount(id, patch){ return sb.from('accounts').update(patch).eq('id',id); },
  async deleteAccount(id){ return sb.from('accounts').delete().eq('id',id); },

  async addCategory(c){ c.user_id = State.user.id; return sb.from('categories').insert(c).select().single(); },
  async updateCategory(id, patch){ return sb.from('categories').update(patch).eq('id',id); },
  async deleteCategory(id){ return sb.from('categories').delete().eq('id',id); },

  async addTransaction(t){ t.user_id = State.user.id; return sb.from('transactions').insert(t).select().single(); },
  async updateTransaction(id, patch){ return sb.from('transactions').update(patch).eq('id',id); },
  async deleteTransaction(id){ return sb.from('transactions').delete().eq('id',id); },

  async addBudget(b){ b.user_id = State.user.id; return sb.from('budgets').upsert(b, { onConflict: 'user_id,category_id,period_start' }).select().single(); },
  async deleteBudget(id){ return sb.from('budgets').delete().eq('id',id); },

  async transfer({ from, to, amount, date, note }){
    const uid = State.user.id;
    const dt = date || new Date().toISOString();
    // record as two transactions of type 'transfer'
    return sb.from('transactions').insert([
      { user_id: uid, account_id: from, amount: -Math.abs(amount), type: 'transfer', date: dt, note: note || 'Transfer out', transfer_peer: to },
      { user_id: uid, account_id: to,   amount:  Math.abs(amount), type: 'transfer', date: dt, note: note || 'Transfer in',  transfer_peer: from }
    ]);
  },

  async shareWith(email){
    // find user id by email via profiles (assumes profile shares email or RPC)
    const { data: prof } = await sb.from('profiles').select('id, display_name').eq('email', email).maybeSingle();
    if (!prof) throw new Error('User not found. Ask them to register first.');
    if (prof.id === State.user.id) throw new Error('You cannot share with yourself.');
    const { error } = await sb.from('shared_users').insert({ owner_id: State.user.id, shared_with_id: prof.id });
    if (error) throw error;
  },

  async unshare(sharedWithId){
    return sb.from('shared_users').delete().eq('owner_id', State.user.id).eq('shared_with_id', sharedWithId);
  },

  // Derived
  accountBalance(acc){
    const txSum = State.transactions
      .filter(t => t.account_id === acc.id)
      .reduce((s,t) => s + Number(t.amount), 0);
    return Number(acc.initial_balance || 0) + txSum;
  },
  totals(range='month'){
    const now = new Date(); let start;
    if (range==='week'){ start = new Date(now); start.setDate(now.getDate()-7); }
    else if (range==='year'){ start = new Date(now.getFullYear(),0,1); }
    else { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    const inRange = State.transactions.filter(t => new Date(t.date) >= start);
    let income=0, expense=0;
    inRange.forEach(t => {
      if (t.type==='income') income += Number(t.amount);
      else if (t.type==='expense') expense += Math.abs(Number(t.amount));
    });
    const balance = State.accounts.reduce((s,a)=> s + Data.accountBalance(a), 0);
    const budgetTotal = State.budgets.reduce((s,b)=> s + Number(b.amount||0), 0);
    const budgetLeft = Math.max(budgetTotal - expense, 0);
    return { income, expense, balance, budgetLeft, range, start };
  }
};
