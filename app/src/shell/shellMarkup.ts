// Faithful port of DESKTOP_SHELL_MOCKUP.html — the converged-IA Agency shell.
export const SHELL_MARKUP = String.raw`
<div class="shell">

  <!-- TOP RIBBON -->
  <div class="rb-top">
    <div class="traffic"><i class="r"></i><i class="y"></i><i class="g"></i></div>
    <div class="frame-id">
      <span><span class="ax">product</span> <b>business</b></span>
      <span><span class="ax">period</span> <b>2026-06</b></span>
      <span><span class="ax">model</span> <b>Opus 4.8</b></span>
      <span><span class="ax">cohort</span> <b>7 eng</b></span>
    </div>
    <div class="loop" id="loop"></div>
    <div class="rel">
      <span class="lbl">relationship · subject = agents</span>
      <button data-rel="operator" class="on">operator</button>
      <button data-rel="oversight">oversight</button>
      <button data-rel="public">public</button>
    </div>
  </div>

  <!-- MIDDLE -->
  <div class="mid">
    <aside class="rail-l">
      <div class="rl-brand"><span class="g">◇</span><span class="n">Liminal Govern</span></div>
      <div class="beat done" data-go="setup"><span class="dot"></span><span class="lb">Setup</span></div>
      <div class="beat done" data-go="okr"><span class="dot"></span><span class="lb">OKR baseline</span></div>
      <div class="beat done" data-go="tray"><span class="dot"></span><span class="lb">Tray → Slate</span></div>
      <div class="beat cur" data-go="delib"><span class="dot"></span><span class="lb">Deliberation</span></div>
      <div class="beat" data-go="finding"><span class="dot"></span><span class="lb">Findings</span></div>
      <div class="beat" data-go="agentfit"><span class="dot"></span><span class="lb">Agent fit</span></div>
      <div class="beat" data-go="ratify"><span class="dot"></span><span class="lb">Ratify</span></div>
      <div class="beat" data-go="brief"><span class="dot"></span><span class="lb">Brief</span></div>
      <div class="beat" data-go="today"><span class="dot"></span><span class="lb">Today · re-enter</span></div>
      <div class="beat" data-go="mirror"><span class="dot"></span><span class="lb">Mirror</span></div>
      <div class="rl-sp"></div>
      <div class="rl-hint"><kbd>⌘K</kbd> jump</div>
    </aside>

    <section class="work" id="work"></section>

    <aside class="rail-r" id="agency"></aside>
  </div>

  <!-- BOTTOM RIBBON -->
  <div class="rb-bot" id="chain"></div>

  <!-- EXTENDED · the decision ledger (the chain promotes into it) -->
  <div class="ledger" id="ledger">
    <div class="ledger-h"><span class="lt">◇ Decision <b>ledger</b></span><span class="sub">append-only · hash-linked · corrections never overwrite</span><span class="lview" id="lview">⟋ spine</span><span class="prove" id="prove">⛓ prove on-chain</span><span class="close" id="lclose">✕</span></div>
    <div class="ledger-b" id="lbody"></div>
  </div>

  <!-- EXTENDED · ⌘K command palette -->
  <div class="palette" id="palette"><div class="pal-box">
    <input id="pal-input" placeholder="Jump to a surface…  (⌘K · or press 1–9 · 0)" autocomplete="off">
    <div class="pal-list" id="pal-list"></div>
  </div></div>
</div>
`;
