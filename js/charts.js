const Charts = {
  _instances: {},
  destroy(id){ if (this._instances[id]) { this._instances[id].destroy(); delete this._instances[id]; } },
  trend(range='month'){
    this.destroy('trend');
    const ctx = document.getElementById('chart-trend'); if (!ctx) return;
    const now = new Date();
    const points = range==='year' ? 12 : range==='week' ? 7 : 30;
    const labels = [], income = [], expense = [];
    for (let i = points-1; i>=0; i--){
      let label, start, end;
      if (range==='year'){
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        start = d; end = new Date(d.getFullYear(), d.getMonth()+1, 0,23,59,59);
        label = d.toLocaleString(undefined,{month:'short'});
      } else {
        const d = new Date(now); d.setDate(now.getDate()-i);
        start = new Date(d.setHours(0,0,0,0)); end = new Date(d.setHours(23,59,59,999));
        label = (range==='week') ? new Date(start).toLocaleString(undefined,{weekday:'short'}) : new Date(start).getDate();
      }
      let inc=0, exp=0;
      State.transactions.forEach(t => {
        const td = new Date(t.date);
        if (td>=start && td<=end){
          if (t.type==='income') inc += Number(t.amount);
          else if (t.type==='expense') exp += Math.abs(Number(t.amount));
        }
      });
      labels.push(label); income.push(inc); expense.push(exp);
    }
    this._instances.trend = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets:[
        { label:'Income', data:income, borderColor:'#16a34a', backgroundColor:'rgba(22,163,74,.15)', tension:.3, fill:true },
        { label:'Expense', data:expense, borderColor:'#dc2626', backgroundColor:'rgba(220,38,38,.15)', tension:.3, fill:true }
      ]},
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });
  },
  pie(){
    this.destroy('pie');
    const ctx = document.getElementById('chart-pie'); if (!ctx) return;
    const [start] = thisMonthRange();
    const sums = {};
    State.transactions.forEach(t => {
      if (t.type !== 'expense') return;
      if (new Date(t.date) < start) return;
      const cat = State.categories.find(c=>c.id===t.category_id);
      const name = cat?.name || 'Uncategorized';
      sums[name] = (sums[name]||0) + Math.abs(Number(t.amount));
    });
    const labels = Object.keys(sums), data = Object.values(sums);
    this._instances.pie = new Chart(ctx, {
      type:'doughnut',
      data:{ labels, datasets:[{ data, backgroundColor:['#0ea5e9','#6366f1','#f59e0b','#10b981','#ef4444','#ec4899','#14b8a6','#8b5cf6','#f97316'] }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });
  },
  bar(){
    this.destroy('bar');
    const ctx = document.getElementById('chart-bar'); if (!ctx) return;
    const months = [], inc=[], exp=[];
    const now = new Date();
    for (let i=5;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const end = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59);
      let I=0, E=0;
      State.transactions.forEach(t=>{
        const td=new Date(t.date);
        if (td>=d && td<=end){
          if (t.type==='income') I += Number(t.amount);
          else if (t.type==='expense') E += Math.abs(Number(t.amount));
        }
      });
      months.push(d.toLocaleString(undefined,{month:'short'})); inc.push(I); exp.push(E);
    }
    this._instances.bar = new Chart(ctx,{
      type:'bar',
      data:{ labels:months, datasets:[
        { label:'Income', data:inc, backgroundColor:'#16a34a' },
        { label:'Expense', data:exp, backgroundColor:'#dc2626' }
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });
  },
  savings(){
    this.destroy('savings');
    const ctx = document.getElementById('chart-savings'); if (!ctx) return;
    const months=[], saved=[];
    const now=new Date();
    for (let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(), now.getMonth()-i, 1);
      const end=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59);
      let I=0,E=0;
      State.transactions.forEach(t=>{
        const td=new Date(t.date);
        if (td>=d && td<=end){
          if (t.type==='income') I+=Number(t.amount);
          else if (t.type==='expense') E+=Math.abs(Number(t.amount));
        }
      });
      months.push(d.toLocaleString(undefined,{month:'short'})); saved.push(I-E);
    }
    this._instances.savings = new Chart(ctx,{
      type:'line',
      data:{ labels:months, datasets:[{ label:'Savings', data:saved, borderColor:'#0ea5e9', backgroundColor:'rgba(14,165,233,.2)', tension:.3, fill:true }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });
  },
  catBar(){
    this.destroy('catbar');
    const ctx = document.getElementById('chart-catbar'); if (!ctx) return;
    const [start] = thisMonthRange();
    const sums = {};
    State.transactions.forEach(t=>{
      if (t.type!=='expense' || new Date(t.date)<start) return;
      const cat = State.categories.find(c=>c.id===t.category_id);
      const name = cat?.name || 'Uncategorized';
      sums[name]=(sums[name]||0)+Math.abs(Number(t.amount));
    });
    this._instances.catbar = new Chart(ctx,{
      type:'bar',
      data:{ labels:Object.keys(sums), datasets:[{ label:'Spent', data:Object.values(sums), backgroundColor:'#6366f1' }]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
    });
  }
};
