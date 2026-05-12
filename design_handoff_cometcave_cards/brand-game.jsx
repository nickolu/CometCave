// CometCave Cards — original screenshot copy, brand visuals, previous 3-rail layout
const { useState: useBrandState } = React;

function BrandGame() {
  const D = window.BrandData;
  const [hand, setHand] = useBrandState(D.buildHand());
  const [selected, setSelected] = useBrandState(new Set());
  const [score, setScore] = useBrandState(5540);
  const [yourScore, setYourScore] = useBrandState(0);
  const [chips, setChips] = useBrandState(0);
  const [mult, setMult] = useBrandState(0);
  const [plays, setPlays] = useBrandState(4);
  const [discards, setDiscards] = useBrandState(3);
  const [playing, setPlaying] = useBrandState(false);
  const [sortBy, setSortBy] = useBrandState('value');
  const [modal, setModal] = useBrandState(null);

  const SCORE_TARGET = 1200;
  const BASE_SCORE = 5540;

  const handType = D.detectHand([...selected].map(id => hand.find(c => c.id === id))) || D.HANDS.pair;
  const sortedHand = [...hand].sort((a,b) => sortBy==='value' ? b.rank.value - a.rank.value : a.suit.id.localeCompare(b.suit.id) || (b.rank.value-a.rank.value));

  const toggle = (id) => {
    if (playing) return;
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else if (s.size < 5) s.add(id);
    setSelected(s);
  };

  const playHand = () => {
    if (selected.size === 0 || plays === 0) return;
    setPlaying(true);
    const cards = [...selected].map(id => hand.find(c => c.id === id));
    const f = D.detectHand(cards);
    const cardChips = cards.reduce((s, c) => s + Math.min(c.rank.value, 11), 0);
    const final = (f.chips + cardChips) * f.mult;
    setChips(f.chips + cardChips); setMult(f.mult);
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 1400);
      const e = 1 - Math.pow(1 - t, 3);
      setYourScore(Math.floor(final * e));
      setScore(BASE_SCORE + Math.floor(final * e));
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(() => { setPlays(p=>p-1); setSelected(new Set()); setPlaying(false); setChips(0); setMult(0); }, 900);
    };
    requestAnimationFrame(tick);
  };

  const discard = () => {
    if (selected.size === 0 || discards === 0 || playing) return;
    setHand(hand.filter(c => !selected.has(c.id)));
    setSelected(new Set());
    setDiscards(d => d - 1);
  };

  const pct = Math.min(100, ((score - BASE_SCORE) / SCORE_TARGET) * 100);

  return (
    <div style={{
      width:'100%', height:'100%', position:'relative', overflow:'hidden',
      background: 'radial-gradient(ellipse at 15% 15%, #0a1f1c 0%, #050d0e 40%, #02080a 100%)',
      color: '#e6fff7', fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <window.AmbientBG/>

      {/* Top bar */}
      <div style={{
        position:'relative', zIndex:2,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 22px',
        borderBottom:'1px solid rgba(94,234,212,0.08)',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{display:'flex', alignItems:'center', gap: 22, flexWrap:'wrap'}}>
          <div style={{display:'flex', alignItems:'center', fontWeight:700, letterSpacing:1, fontSize:16}}>
            <span style={{color:'#5eead4'}}>COMET</span><span style={{color:'#fff'}}>CAVE</span>
          </div>
          <nav style={{display:'flex', gap:18, fontSize:10, fontWeight:600, letterSpacing:1.8, textTransform:'uppercase'}}>
            <NavItem label="Home"/>
            <NavItem label="Trivia"/>
            <NavItem label="Oracle"/>
            <NavItem label="Cards" active/>
            <NavItem label="Chat"/>
          </nav>
        </div>
        <div style={{display:'flex', gap:20, fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:1.5, textTransform:'uppercase', alignItems:'center'}}>
          <Stat label="Round" value="2/40"/>
          <Stat label="Money" value="$9" accent="#ffd166"/>
          <Stat label="Hands Played" value="12"/>
        </div>
      </div>

      {/* Main 3-col layout */}
      <div style={{
        position:'relative', zIndex:2,
        display:'grid',
        gridTemplateColumns: '230px minmax(0, 1fr) 230px',
        gap: 18,
        padding: '14px 22px 18px',
        height: 'calc(100% - 70px)',
        minHeight: 0,
      }}>
        {/* LEFT rail */}
        <div style={{display:'flex', flexDirection:'column', gap: 18, minHeight: 0, overflow:'auto'}}>
          <Panel title="Current Blind">
            <div style={{padding:'14px 16px'}}>
              <div style={{fontSize: 18, fontWeight: 700, letterSpacing:-0.3, color:'#5eead4'}}>Big Blind</div>
              <div style={{fontFamily:'JetBrains Mono, monospace', fontSize: 10, opacity: 0.5, letterSpacing: 2, textTransform:'uppercase', marginTop: 14, marginBottom: 6}}>Score at Least</div>
              <div style={{fontSize: 36, fontWeight: 700, letterSpacing: -1, color:'#ff6b9d', textShadow:'0 0 24px rgba(255,107,157,0.35)'}}>{SCORE_TARGET.toLocaleString()}</div>
              <div style={{marginTop: 16, height: 4, background:'rgba(94,234,212,0.1)', borderRadius: 2, overflow:'hidden'}}>
                <div style={{height:'100%', width:`${pct}%`, background:'linear-gradient(90deg, #5eead4, #2dd4bf)', boxShadow:'0 0 12px rgba(94,234,212,0.6)', transition:'width 0.3s'}}/>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap: 6, marginTop: 14, fontFamily:'JetBrains Mono, monospace', fontSize: 11}}>
                <div style={{display:'flex', justifyContent:'space-between', gap: 8, whiteSpace:'nowrap'}}>
                  <span style={{opacity:0.6}}>Remaining Hands</span><span style={{color:'#5eead4'}}>{plays}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', gap: 8, whiteSpace:'nowrap'}}>
                  <span style={{opacity:0.6}}>Remaining Discards</span><span style={{color:'#ff6b9d'}}>{discards}</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Selected Hand">
            <div style={{padding:'14px 16px'}}>
              <div style={{fontSize: 20, fontWeight: 600, letterSpacing:-0.3}}>{handType.name}</div>
              <div style={{fontFamily:'JetBrains Mono, monospace', fontSize: 11, opacity: 0.55, marginTop: 4}}>Lvl 1</div>
              <div style={{marginTop: 14, display:'flex', alignItems:'center', gap: 10, fontFamily:'JetBrains Mono, monospace', fontSize: 13}}>
                <span style={{padding:'6px 10px', borderRadius: 4, background:'rgba(94,234,212,0.12)', color:'#5eead4', minWidth: 48, textAlign:'center'}}>{chips || handType.chips}</span>
                <span style={{opacity:0.4}}>×</span>
                <span style={{padding:'6px 10px', borderRadius: 4, background:'rgba(255,107,157,0.12)', color:'#ff6b9d', minWidth: 48, textAlign:'center'}}>{mult || handType.mult}</span>
                {(chips > 0 || mult > 0) && (
                  <span style={{marginLeft:'auto', color:'#ffd166', fontWeight: 700, fontSize: 16}}>= {(chips * mult).toLocaleString()}</span>
                )}
              </div>
              <div style={{fontFamily:'JetBrains Mono, monospace', fontSize: 10, opacity: 0.5, letterSpacing: 1, textTransform:'uppercase', marginTop: 10}}>Chips × Mult</div>
            </div>
          </Panel>

          <Panel title="Run Log" small>
            <div style={{padding:'12px 16px', fontFamily:'JetBrains Mono, monospace', fontSize: 11, opacity: 0.6, lineHeight: 1.7}}>
              <div>· Hands Played: 12</div>
              <div>· Best: Four of a Kind (840)</div>
              <div>· Seed: 2026·05·02</div>
            </div>
          </Panel>
        </div>

        {/* CENTER — score + cards */}
        <div style={{display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth: 0}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize: 10, opacity: 0.5, letterSpacing: 3, textTransform:'uppercase'}}>Total Score</div>
            <div style={{
              fontSize: 44, fontWeight: 200, letterSpacing: -1.5, lineHeight: 1, marginTop: 4,
              color:'#fff',
              textShadow:'0 0 60px rgba(94,234,212,0.3)',
              transition:'transform 0.2s',
              transform: playing ? 'scale(1.04)' : 'scale(1)',
            }}>{score.toLocaleString()}</div>
            {yourScore > 0 && playing && (
              <div style={{fontFamily:'JetBrains Mono, monospace', fontSize: 13, color:'#5eead4', marginTop: 4, fontWeight: 700}}>
                + {yourScore.toLocaleString()}
              </div>
            )}
          </div>

          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap: 14, minWidth: 0, width:'100%'}}>
            {/* Cards: explicit-width fan, centered as a unit */}
            {(() => {
              const CARD_W = 92, OVERLAP = 48;
              const fanWidth = CARD_W + (sortedHand.length - 1) * (CARD_W - OVERLAP);
              return (
                <div style={{position:'relative', width: fanWidth, height: 150, perspective: 1200, paddingTop: 14}}>
                  {sortedHand.map((c, i) => (
                    <div key={c.id} style={{
                      position:'absolute',
                      left: i * (CARD_W - OVERLAP),
                      top: 14 + Math.abs(i - sortedHand.length/2 + 0.5)*3,
                      transform: `rotateZ(${(i - sortedHand.length/2 + 0.5) * 2}deg)`,
                      transition: 'transform 300ms, top 300ms',
                      zIndex: selected.has(c.id) ? 20 : i,
                    }}>
                      <window.BrandCard card={c} selected={selected.has(c.id)} onClick={() => toggle(c.id)} size="md"/>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{display:'flex', gap: 20, alignItems:'center', flexWrap:'wrap', justifyContent:'center', fontSize: 11, fontWeight:600, letterSpacing:1.5, textTransform:'uppercase'}}>
              <span style={{opacity:0.5}}>Sort By:</span>
              <button onClick={() => setSortBy('value')} style={pillSort(sortBy==='value')}>Value</button>
              <button onClick={() => setSortBy('suit')} style={pillSort(sortBy==='suit')}>Suit</button>
              <div style={{width:1, height: 22, background:'rgba(94,234,212,0.15)'}}/>
              <button onClick={discard} disabled={selected.size===0||discards===0||playing} style={btnSecondary}>
                Discard <span style={{opacity:0.55, marginLeft: 6}}>{discards}</span>
              </button>
              <button onClick={playHand} disabled={selected.size===0||plays===0||playing} style={btnPrimary}>
                Play Hand ↑
              </button>
              <button onClick={() => setModal('deck')} style={btnGhost}>Show Deck</button>
              <button onClick={() => setModal('hands')} style={btnGhost}>Show Hands</button>
            </div>
          </div>
        </div>

        {/* RIGHT rail — Jokers + Consumables */}
        <div style={{display:'flex', flexDirection:'column', gap: 18, minHeight: 0, overflow:'auto'}}>
          <Panel title="Jokers" subtitle="1 / 5 slots">
            <div style={{padding: 14, display:'flex', flexDirection:'column', gap: 10}}>
              <ItemRow name="Splash" desc="Every played card counts in scoring" accent="#5eead4" glyph="✺"/>
              <EmptySlot/>
            </div>
          </Panel>

          <Panel title="Consumables" subtitle="1 / 2 slots">
            <div style={{padding: 14, display:'flex', flexDirection:'column', gap: 10}}>
              <ItemRow name="Two Pair" desc="Increases the level of Two Pair by 1" accent="#ffd166" glyph="◈"/>
            </div>
          </Panel>
        </div>
      </div>

      {modal && <BrandModal kind={modal} onClose={() => setModal(null)}/>}
    </div>
  );
}

function NavItem({ label, active }) {
  return (
    <div style={{position:'relative', padding:'4px 0', color: active ? '#5eead4' : 'rgba(230,255,247,0.65)', cursor:'pointer'}}>
      {label}
      {active && <div style={{position:'absolute', left:0, right:0, bottom: -6, height: 2, background:'#5eead4', borderRadius: 1, boxShadow:'0 0 8px #5eead4'}}/>}
    </div>
  );
}

function Stat({ label, value, accent='#e6fff7' }) {
  return (
    <div style={{display:'flex', flexDirection:'column', gap: 2}}>
      <div style={{opacity: 0.45, fontSize: 10}}>{label}</div>
      <div style={{color: accent, fontWeight: 600, fontSize: 13}}>{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div style={{
      background:'linear-gradient(180deg, rgba(15,30,28,0.7), rgba(6,15,15,0.7))',
      border:'1px solid rgba(94,234,212,0.1)',
      borderRadius: 8,
      backdropFilter:'blur(8px)',
    }}>
      <div style={{
        padding:'10px 16px',
        borderBottom:'1px solid rgba(94,234,212,0.08)',
        display:'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <div style={{fontFamily:'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 2, textTransform:'uppercase', opacity: 0.6}}>{title}</div>
        {subtitle && <div style={{fontFamily:'JetBrains Mono, monospace', fontSize: 10, opacity: 0.4}}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function ItemRow({ name, desc, accent, glyph }) {
  return (
    <div style={{
      display:'flex', gap: 12, alignItems:'flex-start',
      padding: 10,
      background:'rgba(255,255,255,0.02)',
      borderRadius: 6,
      border:`1px solid ${accent}22`,
    }}>
      <div style={{
        width: 40, height: 56, borderRadius: 4,
        background:'linear-gradient(155deg, #07120f, #0a1f1c)',
        border:`1px solid ${accent}55`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: 22, color: accent,
        boxShadow:`0 0 12px ${accent}33`,
        flex: 'none',
      }}>{glyph}</div>
      <div style={{minWidth: 0, flex: 1}}>
        <div style={{fontWeight: 600, fontSize: 13, color: accent}}>{name}</div>
        <div style={{fontSize: 11, opacity: 0.65, marginTop: 2, lineHeight: 1.4}}>{desc}</div>
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div style={{
      height: 76, borderRadius: 6,
      border:'1px dashed rgba(94,234,212,0.12)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'JetBrains Mono, monospace', fontSize: 10, opacity: 0.3,
      letterSpacing: 2, textTransform:'uppercase',
    }}>Empty slot</div>
  );
}

const pillSort = (active) => ({
  background:'transparent', border:'none',
  color: active ? '#5eead4' : 'rgba(230,255,247,0.5)',
  fontFamily:'JetBrains Mono, monospace',
  fontSize: 11, letterSpacing: 1.5, textTransform:'uppercase',
  padding:'4px 0', cursor:'pointer',
  borderBottom: active ? '1px solid #5eead4' : '1px solid transparent',
});

const btnPrimary = {
  background:'linear-gradient(180deg, #5eead4, #2dd4bf)',
  border:'1px solid #5eead4',
  color:'#031a16',
  fontFamily:'JetBrains Mono, monospace',
  fontSize: 11, letterSpacing: 2, textTransform:'uppercase',
  padding:'10px 22px', borderRadius: 4, cursor:'pointer',
  boxShadow:'0 0 20px rgba(94,234,212,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
  fontWeight: 700,
};
const btnSecondary = {
  background:'rgba(255,107,157,0.1)',
  border:'1px solid rgba(255,107,157,0.35)',
  color:'#ff6b9d',
  fontFamily:'JetBrains Mono, monospace',
  fontSize: 11, letterSpacing: 2, textTransform:'uppercase',
  padding:'10px 18px', borderRadius: 4, cursor:'pointer',
  fontWeight: 700,
};
const btnGhost = {
  background:'transparent',
  border:'1px solid rgba(94,234,212,0.15)',
  color:'rgba(230,255,247,0.7)',
  fontFamily:'JetBrains Mono, monospace',
  fontSize: 10, letterSpacing: 2, textTransform:'uppercase',
  padding:'8px 14px', borderRadius: 4, cursor:'pointer',
};

function BrandModal({ kind, onClose }) {
  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex: 10,
      background:'rgba(2,8,10,0.75)', backdropFilter:'blur(10px)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxWidth:'85%',
        background:'linear-gradient(180deg, #0a1f1c, #050d0e)',
        border:'1px solid rgba(94,234,212,0.2)',
        borderRadius: 10, padding: 28, color:'#e6fff7',
      }}>
        <div style={{fontFamily:'JetBrains Mono, monospace', fontSize: 11, letterSpacing: 2, textTransform:'uppercase', opacity: 0.5}}>
          {kind === 'deck' ? 'Show Deck' : 'Show Hands'}
        </div>
        <div style={{fontSize: 24, fontWeight: 600, marginTop: 4}}>
          {kind === 'deck' ? 'Standard 52' : 'Poker Hands'}
        </div>
        <div style={{marginTop: 20, display:'grid', gridTemplateColumns: kind === 'hands' ? '1fr 1fr' : 'repeat(13, 1fr)', gap: 8}}>
          {kind === 'hands'
            ? Object.values(window.BrandData.HANDS).map(f => (
                <div key={f.name} style={{padding: 10, borderRadius: 6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(94,234,212,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span style={{fontWeight: 500}}>{f.name}</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace', fontSize: 11, color:'#5eead4'}}>{f.chips}×{f.mult}</span>
                </div>
              ))
            : window.BrandData.RANKS.slice().reverse().map(r => (
                <div key={r.id} style={{textAlign:'center', fontFamily:'JetBrains Mono, monospace', fontSize: 12, padding: 6, background:'rgba(255,255,255,0.03)', borderRadius: 4}}>
                  {r.label}<div style={{fontSize: 9, opacity: 0.5, marginTop: 2}}>×4</div>
                </div>
              ))
          }
        </div>
        <button onClick={onClose} style={{...btnGhost, marginTop: 20}}>Close</button>
      </div>
    </div>
  );
}

window.BrandGame = BrandGame;
