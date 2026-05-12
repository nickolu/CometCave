// CometCave-branded card game — original copy from screenshot, brand visuals
const { useState, useEffect, useRef } = React;

// Classic suits — but cosmic-glowing
const SUITS = [
  { id: 'hearts',   glyph: '♥', label: 'Hearts',   color: '#ff6b9d' },
  { id: 'diamonds', glyph: '♦', label: 'Diamonds', color: '#ffd166' },
  { id: 'spades',   glyph: '♠', label: 'Spades',   color: '#e6e6f0' },
  { id: 'clubs',    glyph: '♣', label: 'Clubs',    color: '#5eead4' },
];

const RANKS = [
  ...[2,3,4,5,6,7,8,9,10].map(n => ({id:n,label:String(n),value:n})),
  {id:'J',label:'J',value:11},{id:'Q',label:'Q',value:12},{id:'K',label:'K',value:13},{id:'A',label:'A',value:14},
];

// Original poker hand names
const HANDS = {
  high:         { name: 'High Card',       chips: 5,   mult: 1 },
  pair:         { name: 'Pair',            chips: 10,  mult: 2 },
  twoPair:      { name: 'Two Pair',        chips: 20,  mult: 2 },
  three:        { name: 'Three of a Kind', chips: 30,  mult: 3 },
  straight:     { name: 'Straight',        chips: 30,  mult: 4 },
  flush:        { name: 'Flush',           chips: 35,  mult: 4 },
  fullHouse:    { name: 'Full House',      chips: 40,  mult: 4 },
  four:         { name: 'Four of a Kind',  chips: 60,  mult: 7 },
  straightFlush:{ name: 'Straight Flush',  chips: 100, mult: 8 },
};

function makeCard(rank, suit) { return { id: `${rank.id}-${suit.id}`, rank, suit }; }

function buildHand() {
  return [
    makeCard(RANKS.find(r=>r.id==='K'), SUITS[3]),  // K clubs
    makeCard(RANKS.find(r=>r.id==='K'), SUITS[0]),  // K hearts
    makeCard(RANKS.find(r=>r.id==='Q'), SUITS[1]),  // Q diamonds
    makeCard(RANKS.find(r=>r.id==='J'), SUITS[0]),  // J hearts
    makeCard(RANKS.find(r=>r.id===9),   SUITS[2]),  // 9 spades
    makeCard(RANKS.find(r=>r.id===7),   SUITS[3]),  // 7 clubs
    makeCard(RANKS.find(r=>r.id===6),   SUITS[1]),  // 6 diamonds
    makeCard(RANKS.find(r=>r.id===5),   SUITS[1]),  // 5 diamonds
  ];
}

function detectHand(cards) {
  if (!cards || cards.length === 0) return null;
  const counts = {};
  cards.forEach(c => { counts[c.rank.id] = (counts[c.rank.id] || 0) + 1; });
  const pairs = Object.values(counts).filter(c => c === 2).length;
  const trips = Object.values(counts).filter(c => c === 3).length;
  const quads = Object.values(counts).filter(c => c === 4).length;
  const suits = new Set(cards.map(c => c.suit.id));
  const isFlush = suits.size === 1 && cards.length === 5;
  if (quads) return HANDS.four;
  if (trips && pairs) return HANDS.fullHouse;
  if (isFlush) return HANDS.flush;
  if (trips) return HANDS.three;
  if (pairs >= 2) return HANDS.twoPair;
  if (pairs === 1) return HANDS.pair;
  return HANDS.high;
}

function AmbientBG() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    let raf, w, h, stars = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const n = Math.floor((w*h)/8000);
      stars = Array.from({length:n}, () => ({
        x: Math.random()*w, y: Math.random()*h,
        r: Math.random()*1.4 + 0.2,
        a: Math.random()*0.7 + 0.2,
        tw: Math.random()*Math.PI*2,
        twS: Math.random()*0.015 + 0.003,
        hue: Math.random() < 0.7 ? 165 : (Math.random() < 0.5 ? 200 : 50),
      }));
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c);
    const tick = () => {
      ctx.clearRect(0,0,w,h);
      const g1 = ctx.createRadialGradient(w*0.15, h*0.15, 0, w*0.15, h*0.15, Math.max(w,h)*0.5);
      g1.addColorStop(0, 'rgba(94, 234, 212, 0.12)');
      g1.addColorStop(0.5, 'rgba(94, 234, 212, 0.04)');
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1; ctx.fillRect(0,0,w,h);
      const g2 = ctx.createRadialGradient(w*0.85, h*0.8, 0, w*0.85, h*0.8, Math.max(w,h)*0.5);
      g2.addColorStop(0, 'rgba(45, 212, 191, 0.10)');
      g2.addColorStop(0.5, 'rgba(45, 212, 191, 0.03)');
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2; ctx.fillRect(0,0,w,h);
      const g3 = ctx.createRadialGradient(w*0.55, h*0.55, 0, w*0.55, h*0.55, Math.max(w,h)*0.4);
      g3.addColorStop(0, 'rgba(255, 209, 102, 0.04)');
      g3.addColorStop(1, 'transparent');
      ctx.fillStyle = g3; ctx.fillRect(0,0,w,h);

      stars.forEach(s => {
        s.tw += s.twS;
        const tw = (Math.sin(s.tw)+1)/2;
        ctx.globalAlpha = s.a * (0.3 + 0.7*tw);
        ctx.fillStyle = `hsl(${s.hue}, 70%, ${75 + tw*15}%)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} style={{position:'absolute', inset:0, width:'100%', height:'100%'}}/>;
}

function BrandCard({ card, selected, onClick, size='md' }) {
  const dims = {
    md: { w: 92, h: 132, fs: 22, pip: 42 },
    lg: { w: 116, h: 168, fs: 28, pip: 56 },
  }[size];
  const c = card.suit.color;
  return (
    <button onClick={onClick} className="bc-card" style={{
      width: dims.w, height: dims.h, padding: 0, position: 'relative',
      background: 'linear-gradient(160deg, #0d1f1a 0%, #061712 60%, #03100d 100%)',
      borderRadius: 14,
      border: `1px solid ${selected ? c : 'rgba(94,234,212,0.18)'}`,
      cursor: onClick ? 'pointer' : 'default',
      boxShadow: selected
        ? `0 0 0 2px ${c}55, 0 0 28px ${c}, 0 16px 28px rgba(0,0,0,0.7)`
        : `0 0 12px ${c}1a, 0 8px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(94,234,212,0.08)`,
      transform: selected ? 'translateY(-16px)' : 'translateY(0)',
      transition: 'transform 220ms cubic-bezier(.2,.9,.3,1.2), box-shadow 220ms, border-color 220ms',
      overflow: 'hidden', flex: 'none',
    }}>
      <div style={{position:'absolute', inset:0, background: `linear-gradient(125deg, transparent 35%, ${c}1f 50%, transparent 65%)`, mixBlendMode: 'screen', pointerEvents: 'none'}}/>
      <div style={{position:'absolute', inset: 6, border: `1px solid ${c}22`, borderRadius: 9, pointerEvents: 'none'}}/>
      {[{t:8,l:10,r:'auto',b:'auto', rot:0}, {t:'auto',l:'auto',r:10,b:8, rot:180}].map((p,i) => (
        <div key={i} style={{
          position:'absolute', top:p.t, left:p.l, right:p.r, bottom:p.b,
          color:c, fontFamily:'JetBrains Mono, ui-monospace, monospace', lineHeight:1, textAlign:'center',
          transform: p.rot ? `rotate(${p.rot}deg)` : 'none',
          textShadow: `0 0 10px ${c}88`,
        }}>
          <div style={{fontWeight:700, fontSize: dims.fs*0.7}}>{card.rank.label}</div>
          <div style={{fontSize: dims.fs*0.62, marginTop: 2}}>{card.suit.glyph}</div>
        </div>
      ))}
      <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{fontSize: dims.pip, color: c, textShadow: `0 0 22px ${c}, 0 0 40px ${c}88`}}>
          {card.suit.glyph}
        </div>
      </div>
      <div style={{position:'absolute', inset:0, background: `radial-gradient(circle at 50% 55%, ${c}22 0%, transparent 60%)`, pointerEvents:'none'}}/>
    </button>
  );
}

window.BrandCard = BrandCard;
window.AmbientBG = AmbientBG;
window.BrandData = { SUITS, RANKS, HANDS, makeCard, buildHand, detectHand };
