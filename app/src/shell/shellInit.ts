// @ts-nocheck — faithful verbatim port of the mockup interactions (DOM-imperative).
// Faithful port of the mockup's interactions — runs once after the markup mounts.
export function initShell(): void {
const REL = ()=>document.body.dataset.relationship;
const AGENTS = [
  ['Spend analyst','done','passed'],['OKR-alignment','done','passed'],['Productivity','done','passed'],
  ['Security-ev.','flag','flag'],['Misuse/policy','flag','flag'],['Marketplace','done','passed'],
  ['Provenance','run','anchor'],['Exec-comms','refuse','refuse'],
];
// EXTENDED · the four registers (the converged IA) — the 8 specialists nest under these
const REGISTERS = [
  ['Diligence','r0',['Spend analyst','Productivity','Security-ev.'],'won’t set policy'],
  ['Synthesis','r1',['OKR-alignment'],'won’t price'],
  ['Judgment','r2',['Misuse/policy','Provenance'],'won’t draft outreach'],
  ['Outreach','r3',['Marketplace','Exec-comms'],'won’t judge'],
];
const agSt = nm => (AGENTS.find(a=>a[0]===nm)||[,'done'])[1];
const agLb = nm => (AGENTS.find(a=>a[0]===nm)||[,,''])[2];
// EXTENDED · the loop spine (Capture→Read→Decide→Record→Re-enter) the beats map onto
const LOOP = [['Capture',['setup','okr','tray']],['Read',['delib','finding','agentfit']],['Decide',['ratify']],['Record',['brief']],['Re-enter',['today','mirror']]];
// EXTENDED · Tray→Slate state — diffuse candidates (tray) vs the hardened working set (slate). Drag to harden.
const SLATE = [['usage-events.csv','Claude usage'],['okr-baseline.json','OKR baseline'],['pr-evidence.csv','GitHub']];
const TRAY  = [['agent-registry','Registry'],['security-tickets','Security'],['model-access-list','Access']];
// per-surface: does agency RAIL (live) or collapse to a ribbon summary? does provenance grow?
const SURFACES = {
  setup:{eyebrow:'beat 1 · setup',title:'Onboarding swarm detects your context',agency:'summary',body:()=>`
    <p class="lede">The plugin installs the desktop app; the swarm scans for governable streams. You choose what hardens.</p>
    <div class="tiles">
      <div class="tile ing"><div class="tt">Claude usage logs</div><div class="ts">ingested</div></div>
      <div class="tile ing"><div class="tt">GitHub PRs</div><div class="ts">ingested</div></div>
      <div class="tile scan"><div class="tt">Security tickets</div><div class="ts">scanning…</div></div>
      <div class="tile scan"><div class="tt">Agent registry</div><div class="ts">scanning…</div></div>
      <div class="tile"><div class="tt">Model-access list</div><div class="ts">found</div></div>
    </div>`},
  okr:{eyebrow:'beat 2 · baseline',title:'AI spend governance baseline',agency:'summary',body:()=>`
    <p class="lede">Objectives, allocations, the approved model and cohort — the frame everything is measured against.</p>
    <div style="margin-top:18px"><div class="alloc-bar"><div class="p" style="width:60%">product 60%</div><div class="s" style="width:40%">security 40%<span class="ghost"></span></div></div></div>
    <p class="lede" style="margin-top:22px">Approved model <b style="color:var(--text)">Opus 4.8</b> · cohort 7 · budget period 2026-06. Security is the target the deliberation will test actual spend against.</p>`},
  tray:{eyebrow:'beat 3 · harden',title:'Tray → Slate · you control what hardens',agency:'summary',body:()=>`
    <p class="lede">Diffuse context on the left; the hardened working set on the right. <b style="color:var(--text-mid)">Drag a Tray tile onto the Slate to harden it</b> — the agents only read the Slate. The crossing is the governance act: selection, not surveillance.</p>
    <div class="ts-wrap">
      <div class="ts-col"><div class="ch">Tray · diffuse <span class="ct" style="color:var(--watch)">drag →</span></div>${TRAY.map(t=>`<div class="dtile tray" draggable="true" data-tile="${t[0]}"><div class="src">${t[1]}</div><div class="nm">${t[0]}</div></div>`).join('')||'<div class="lede" style="color:var(--text-mute);padding:20px 0;text-align:center">— all hardened —</div>'}</div>
      <div class="ts-col slate-zone"><div class="ch">Slate · being read <span class="ct">${SLATE.length}</span></div>${SLATE.map(t=>`<div class="dtile" data-tile="${t[0]}"><div class="src">${t[1]}</div><div class="nm">${t[0]}</div></div>`).join('')}</div>
    </div>`},
  delib:{eyebrow:'beat 4 · deliberation',title:'Eight bounded agents read the spend',agency:'rail',body:()=>`
    <p class="lede">model: opus · each agent stays in its lane and refuses out of it. Watch the agency console resolve, right.</p>
    <div class="card dlog">
      <div class="card-h">Deliberation <span class="meta">8 bounded agents · live</span></div>
      ${AGENTS.map((a,i)=>`<div class="row ${a[1]}" style="animation-delay:${.05+i*.08}s"><span class="d"></span><span class="nm">${a[0]}</span><span class="vd">${a[2]==='flag'?'flagged':a[2]==='anchor'?'anchoring…':a[2]==='refuse'?'refuse · out of lane':a[2]}</span></div>`).join('')}
      <div class="dlog-f"><span class="tick">live</span><span>· adversarial reviewer running · 1 claim contested</span></div>
    </div>`},
  finding:{eyebrow:'beat 5 · finding',title:'The model caught its own error',agency:'rail',body:()=>`
    <p class="lede">Opus spend on calendar &amp; admin can route to a verified agent — but one claim did not survive review.</p>
    <div class="card"><div class="card-h">Finding · misuse / agent-fit <span class="meta">cites usage-events · pr-evidence</span></div>
      <div class="finding">
        <div class="fhead"><span class="amt">$284<span class="u">/mo realizable</span></span><span class="tag">verified</span></div>
        <div class="recon">
          <div class="rr"><span class="l">Calendar → CalendarOps <span class="c">E12, E13</span></span><span class="v">$162</span></div>
          <div class="rr"><span class="l">Summarization → DigestBot <span class="c">E15, E16</span></span><span class="v">$122</span></div>
          <div class="rr drop"><span class="l">Calendar-sync → CalendarOps <span class="c">E14</span></span><span class="v">$162</span></div>
          <div class="dreason"><span class="x">✗</span><span class="t"><b>Refuted.</b> PR-103 (Priya, “calendar-sync feature: Google Calendar API + UI”) proves E14 is product engineering, not admin. The $162 claim is dropped.</span></div>
          <div class="rtot"><span class="l">Total recommended</span><span class="v"><span class="was">$446</span>$284</span></div>
        </div>
        <div class="amend-row"><span class="lbl">The read is the model’s until you change it — correction is the primary act.</span><button class="btn-amend" data-amend="finding">✎ Amend this read</button></div>
      </div></div>`},
  agentfit:{eyebrow:'beat 6 · agent fit',title:'Route to a registry-verified agent',agency:'rail',body:()=>`
    <p class="lede">A verifiable internal agent registry — current vs suggested, with on-chain provenance.</p>
    <div class="card"><div class="card-h">Agent fit <span class="meta">Algorand-verified registry</span></div>
      <div class="swap">
        <div class="side cur"><span class="ro">current</span><p class="ag">Claude Opus 4.8</p><span class="co">calendar mgmt · high tier</span><span class="bd">out of approved scope</span></div>
        <div class="arr">→</div>
        <div class="side sug"><span class="ro">suggested</span><p class="ag">CalendarOps Agent</p><span class="co">~10% of Opus · scoped: calendar</span><span class="bd">registry-verified</span></div>
      </div></div>`},
  ratify:{eyebrow:'beat 7 · ratify',title:'One policy proves the product',agency:'summary',prov:'rail',body:()=>{
    // real anchored hash of the ratified decision (D-RATIFY-CAL), pulled from the loaded chain;
    // honest fallback is the real hash itself (never a placeholder).
    const dec=CHAIN.find(e=>e[1].toLowerCase().includes('ratified'));
    const sha=(dec&&dec[3])?dec[3]:'5d9fad4245…d8a5';
    return `
    <p class="lede">Spend governance + routing + the registry + provenance + non-surveillance — in a single signed, anchored object.</p>
    <div class="cta"><button class="btn-r" onclick="document.getElementById('art').style.display='block';this.style.display='none'">Ratify decision ▸</button></div>
    <div id="art" style="display:none"><div class="artifact">
      <div class="ab"><span class="stamp">ratified</span><span class="wh">2026-06 · operator · effective immediately</span></div>
      <div class="abody">
        <p class="adec">Opus 4.8 cannot be used for calendar management or routine admin work.</p>
        <p class="arat">Calendar/admin usage does not map to the approved OKRs, and a registry-verified lower-cost agent (CalendarOps, ~10% of Opus cost) covers it. The calendar-sync work in E14 is product engineering (PR-103) and is explicitly NOT reclassified.</p>
        <div class="apol"><span class="pc al">allow · product_dev</span><span class="pc al">allow · security_hardening</span><span class="pc al">allow · architecture_review</span><span class="pc dn">deny · calendar_management</span><span class="pc dn">deny · routine_admin</span><span class="pc dn">deny · generic_summarization</span></div>
        <div class="arec"><span class="hl">anchored</span><span class="hs">sha256: ${sha} · local-first chain · entry 6/6</span><span class="ok">chain verified</span></div>
      </div></div></div>`;}},
  brief:{eyebrow:'beat 8 · brief',title:'AI Spend Brief — exec-ready',agency:'summary',body:()=>`
    <p class="lede">The decision trail as proof: spend by OKR, the routing change, the savings, the ratified policy.</p>
    <div class="tiles" style="margin-top:6px">
      <div class="tile"><div class="tt tnum">$4,500</div><div class="ts">opus spend · period</div></div>
      <div class="tile"><div class="tt tnum">$284/mo</div><div class="ts">verified savings</div></div>
      <div class="tile"><div class="tt tnum">24% → 40%</div><div class="ts">security realloc</div></div>
      <div class="tile"><div class="tt">1 policy</div><div class="ts">ratified · anchored</div></div>
      <div class="tile"><div class="tt tnum">6/6</div><div class="ts">chain verified</div></div>
    </div>`},
  today:{eyebrow:'re-entry · the loop returns',title:'Three things came back overnight',agency:'summary',body:()=>`
    <p class="lede">The daemon re-read your held decisions while you slept. One needs a decision today; one outcome is closing; your pattern has a note.</p>
    <div class="tiles" style="grid-template-columns:1fr;gap:9px">
      <div class="tile" style="border-color:var(--alarm-edge)"><div class="tt">⚠ Opus spend vs the next-period OKRs — needs a decision</div><div class="ts" style="color:var(--watch)">held 2 days · re-read 04:12</div></div>
      <div class="tile"><div class="tt">“Cursor seats → 12” — outcome closing well</div><div class="ts" style="color:var(--connection)">ratified 12 weeks ago · calibrated</div></div>
      <div class="tile" style="border-color:var(--diligence)"><div class="tt">◍ Mirror · you correct Synthesis most</div><div class="ts" style="color:var(--diligence)">a quiet note</div></div>
    </div>`},
  mirror:{eyebrow:'mirror · decisions calibrated · last 12 weeks',title:'How your judgment is changing',agency:'summary',body:()=>`
    <p class="lede">Not what you decided — how you decide. The correction stream is first-party data about your judgment itself; this is it, reflected back.</p>
    <div class="tiles" style="margin-top:2px;grid-template-columns:repeat(3,1fr)">
      <div class="tile"><div class="tt tnum">47</div><div class="ts">decisions ratified</div></div>
      <div class="tile"><div class="tt tnum">128</div><div class="ts">corrections made</div></div>
      <div class="tile"><div class="tt tnum">2.7×</div><div class="ts">corrections / read ↑</div></div>
    </div>
    <div class="card" style="margin-top:6px"><div class="card-h">Where your corrections land · by register</div>
      <div class="mcontent" style="padding:15px;display:flex;flex-direction:column;gap:9px">
        ${[['Synthesis · framing',54,'--depth'],['Judgment · verdict',23,'--judgment'],['Outreach · the move',15,'--connection'],['Diligence · facts',8,'--diligence']].map(([l,p,c])=>`<div style="display:grid;grid-template-columns:130px 1fr 38px;align-items:center;gap:11px;font:10px/1 var(--mono)"><span style="color:var(--text-dim)">${l}</span><span style="height:7px;background:var(--frame-bg-3);border-radius:9px;overflow:hidden;display:block"><span style="display:block;height:100%;width:${p}%;background:var(${c})"></span></span><span style="color:var(--text-faint);text-align:right">${p}%</span></div>`).join('')}
        <p class="lede" style="margin-top:8px;font-family:var(--display);font-style:italic;font-size:14px;color:var(--text-mid)">“Better models read the facts more accurately — and you correct the framing more, not less. The loop is doing what it should.”</p>
      </div></div>`},
};
// provenance chain grows as you advance the flow
const CHAIN = (typeof window!=='undefined' && window.__govChain && window.__govChain.length) ? window.__govChain : [
  ['12:01','setup · 5 streams ingested',0], ['12:02','baseline · 60/40 set',0],
  ['12:04','slate hardened · 5 tiles',0], ['12:05','deliberation · 8 agents',0],
  ['12:05','exec-comms · refused out of lane',1], ['12:05','finding · $284 verified',0],
  ['12:05','E14 refuted · PR-103',1], ['12:06','ratified · anchored 6/6',0],
];
const ORDER = ['setup','okr','tray','delib','finding','agentfit','ratify','brief','today','mirror'];

function renderAgency(mode){
  const el = document.getElementById('agency'); el.style.width='206px';
  if(mode==='rail'){ // the four registers · specialists nested · refusal-as-credibility
    el.innerHTML = `<div class="rr-h"><span>agency · registers</span><span>opus</span></div>`+
      REGISTERS.map(([name,rc,specs,refuse])=>`<div class="regblk ${rc}"><div class="rh"><span class="d"></span>${name}</div>`+
        specs.map(s=>`<div class="ag ${agSt(s)}"><span class="d"></span><span class="nm">${s}</span><span class="st">${agLb(s)}</span></div>`).join('')+
        `<div class="rf">⊘ ${refuse}</div></div>`).join('');
  } else { // collapsed to a ribbon summary tucked in the rail
    const flagged=AGENTS.filter(a=>a[1]==='flag').length, ref=AGENTS.filter(a=>a[1]==='refuse').length;
    el.innerHTML = `<div class="rr-h"><span>agency · idle</span></div>
      <div style="padding:10px 15px;font:10px/1.7 var(--mono);color:var(--text-faint);letter-spacing:.08em">
      <div style="color:var(--text-mid)">4 registers · 8 specialists</div>
      <div>· ${flagged} flagged</div><div style="color:var(--judgment)">· ${ref} refused out of lane</div>
      <div style="margin-top:8px;color:var(--text-mute)">— promotes to the live register console on the read surfaces —</div></div>`;
  }
}
// EXTENDED · loop spine
function renderLoop(key){
  const ci = LOOP.findIndex(m=>m[1].includes(key));
  document.getElementById('loop').innerHTML = LOOP.map((m,i)=>
    `<span class="m ${i<ci?'done':i===ci?'cur':''}"><span class="d"></span>${m[0]}</span>`+(i<LOOP.length-1?'<span class="sep">→</span>':'')).join('');
}
// EXTENDED · the chain promotes into the Sealed-Stack decision ledger
function ledgerKind(e){const x=e[1].toLowerCase();
  if(x.includes('ratified'))return 'dec'; if(x.includes('anchor'))return 'anc';
  if(x.includes('correction'))return 'corr'; if(x.includes('refus')||e[2])return 'ref';
  return 'find';}
const LSEAL={find:['finding','✓'],corr:['correction','✎'],dec:['ratified','◇'],ref:['refusal','⊘'],anc:['anchored','⛓']};
function renderLedger(){
  const led = document.getElementById('ledger');
  if(led.classList.contains('spine')){ // Direction A · the Spine (vertical hash-linked timeline; corrections indent)
    document.getElementById('lbody').innerHTML = `<div class="spine-wrap">` + CHAIN.map((e,i)=>{
      const k=ledgerKind(e),lab=LSEAL[k][0];
      const sha = e[3] || '—';
      const prev = (i>0 && CHAIN[i-1][3]) ? ` ← ${CHAIN[i-1][3]}` : '';
      return `<div class="snode ${k}"><div class="srow"><span class="spill">${lab}</span><span class="st">${e[0]}</span></div><div class="sbody">${e[1]}</div><div class="smeta">sha ${sha}${prev}</div></div>`;
    }).join('') + `</div>`;
    return;
  }
  const proving = led.classList.contains('proving');
  document.getElementById('lbody').innerHTML =
    `<div class="lanehd"><span>local-first vault</span><span class="a">algorand anchor</span></div>` +
    CHAIN.map((e,i)=>{const k=ledgerKind(e),[lab,seal]=LSEAL[k];
      const onchain = (k==='dec'||k==='corr'||k==='anc'); // decisions + corrections anchor on-chain; raw findings stay local-first
      const rec = proving ? (onchain
        ? `<div class="areceipt">anchored<br>txn LIM…${(0x4002+i).toString(16).toUpperCase()}</div>`
        : `<div class="areceipt none">local-first<br>not anchored</div>`) : '';
      const sha = e[3] || '—';
      return `<div class="lrow"><div class="lpage ${k}"><div class="lh"><span class="lk">${lab}</span><span class="ls">${seal}</span></div><div class="lb">${e[1]}</div><div class="lf">${e[0]} · sha ${sha}</div></div>${rec}</div>`;
    }).join('');
}
// EXTENDED · ⌘K command palette
const PALITEMS = [['setup','Setup'],['okr','OKR baseline'],['tray','Tray → Slate'],['delib','Deliberation'],['finding','Findings'],['agentfit','Agent fit'],['ratify','Ratify'],['brief','Brief'],['today','Today · re-enter'],['mirror','Mirror']];
function renderPal(q=''){const items=PALITEMS.filter(p=>p[1].toLowerCase().includes(q.toLowerCase()));
  document.getElementById('pal-list').innerHTML=items.map((p,i)=>`<div class="pal-row ${i===0?'sel':''}" data-goto="${p[0]}">${p[1]}<span class="pk">${ORDER.indexOf(p[0])+1}</span></div>`).join('')||'<div class="pal-row" style="color:var(--text-faint)">no match</div>';}
function togglePal(open){const p=document.getElementById('palette');p.classList.toggle('open',open);if(open){const inp=document.getElementById('pal-input');inp.value='';renderPal();inp.focus();}}
function openLedger(){const l=document.getElementById('ledger');l.classList.add('open');
  if(REL()==='public'){document.getElementById('lbody').innerHTML='<div class="lede" style="color:var(--text-dim);text-align:center;padding:40px 20px;font-size:13px">⊘ The ledger is behind the consent boundary — request audit-chain disclosure.</div>';return;}
  renderLedger();}
function renderChain(uptoIdx){
  const el=document.getElementById('chain');
  el.innerHTML = `<span class="lab">chain</span>` + CHAIN.slice(0, Math.min(CHAIN.length, 2+uptoIdx*1)).map((e,i)=>
    `<span class="ev ${e[2]?'ref':''} ${i===(1+uptoIdx)?'fresh':''}"><span class="t">${e[0]}</span><span class="e">${e[1]}</span></span>`).join('')
    + `<span class="ev open-l">▲ ledger</span>`;
  if(document.getElementById('ledger').classList.contains('open')) renderLedger();
}
function go(key){
  const s = SURFACES[key]; if(!s) return;
  document.querySelectorAll('.beat').forEach(b=>b.classList.toggle('cur', b.dataset.go===key));
  const w = document.getElementById('work');
  w.innerHTML = `<span class="eyebrow">${s.eyebrow}</span><h2>${s.title}</h2>${s.body()}`;
  renderAgency(s.agency);
  renderChain(ORDER.indexOf(key));
  renderLoop(key);
}
document.querySelectorAll('.beat').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
document.querySelectorAll('.rel button').forEach(btn=>btn.addEventListener('click',()=>{
  document.body.dataset.relationship = btn.dataset.rel;
  document.querySelectorAll('.rel button').forEach(x=>x.classList.toggle('on',x===btn));
  if(document.getElementById('ledger').classList.contains('open')) openLedger(); // re-evaluate ledger access on relationship change
}));
// EXTENDED · Tray → Slate drag (harden): move a tile TRAY → SLATE, log the chain, re-render
let dragId=null;
document.addEventListener('dragstart',e=>{const t=e.target.closest('.dtile[draggable]');if(t){dragId=t.dataset.tile;t.classList.add('dragging');}});
document.addEventListener('dragend',e=>{const t=e.target.closest('.dtile');if(t)t.classList.remove('dragging');});
document.addEventListener('dragover',e=>{const z=e.target.closest('.slate-zone');if(z){e.preventDefault();z.classList.add('drop');}});
document.addEventListener('dragleave',e=>{const z=e.target.closest('.slate-zone');if(z&&!z.contains(e.relatedTarget))z.classList.remove('drop');});
document.addEventListener('drop',e=>{const z=e.target.closest('.slate-zone');if(z&&dragId){e.preventDefault();
  const i=TRAY.findIndex(t=>t[0]===dragId);if(i>=0){const t=TRAY.splice(i,1)[0];SLATE.push(t);CHAIN.push(['12:03','slate · hardened '+t[0],0]);go('tray');}
  dragId=null;}});
// EXTENDED · chain→ledger, close, and correction-amend (the thesis: correction appends to the chain)
document.addEventListener('click',e=>{
  if(e.target.closest('#lview')){const l=document.getElementById('ledger');l.classList.toggle('spine');const b=document.getElementById('lview');b.classList.toggle('on');b.textContent=l.classList.contains('spine')?'▦ stack':'⟋ spine';renderLedger();return;}
  if(e.target.closest('#prove')){document.getElementById('ledger').classList.toggle('proving');document.getElementById('prove').classList.toggle('on');renderLedger();return;}
  if(e.target.closest('#lclose')){document.getElementById('ledger').classList.remove('open');return;}
  if(e.target.closest('#chain')){openLedger();return;}
  if(e.target.closest('.rl-hint')){togglePal(true);return;}
  if(e.target.id==='palette'){togglePal(false);return;}
  const pr=e.target.closest('[data-goto]');if(pr){go(pr.dataset.goto);togglePal(false);return;}
  const am=e.target.closest('[data-amend]');
  if(am){ am.disabled=true; const orig=am.textContent; am.textContent='signing…';
    const fallback=['12:07','operator correction · re-anchored',0];
    Promise.resolve((typeof window!=='undefined' && window.__govCorrect) ? window.__govCorrect() : fallback)
      .then(entry=>{CHAIN.push(entry||fallback);renderChain(99);
        am.textContent='✓ correction appended — your read now'; am.style.opacity=.65; am.style.cursor='default';})
      .catch(()=>{CHAIN.push(fallback);renderChain(99);am.textContent=orig;am.disabled=false;});}
});
// EXTENDED · keyboard — ⌘K palette · number keys 1–9/0 jump to a surface · Esc/Enter in palette
document.getElementById('pal-input').addEventListener('input',ev=>renderPal(ev.target.value));
document.addEventListener('keydown',ev=>{
  if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();togglePal(!document.getElementById('palette').classList.contains('open'));return;}
  if(document.getElementById('palette').classList.contains('open')){
    if(ev.key==='Escape')togglePal(false);
    if(ev.key==='Enter'){const sel=document.querySelector('.pal-row.sel')||document.querySelector('.pal-row[data-goto]');if(sel&&sel.dataset.goto){go(sel.dataset.goto);togglePal(false);}}
    return;
  }
  if(ev.target.tagName==='INPUT')return;
  const n = ev.key==='0' ? 10 : parseInt(ev.key,10);
  if(!isNaN(n) && n>=1 && n<=ORDER.length) go(ORDER[n-1]);
});
go('delib'); // open on the hero surface
}
