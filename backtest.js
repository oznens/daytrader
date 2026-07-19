#!/usr/bin/env node
/* MMXM backtest — index.html'deki tespit motorunun ileriye-bakışsız (causal) kopyası.
   Kullanım: node backtest.js <klines.json>
   JSON biçimi: {"t":[...],"o":[...],"h":[...],"l":[...],"c":[...]} (MEXC kline dizileri) */
"use strict";
const fs = require('fs');

function loadCandles(path){
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  const out = [];
  for(let i=0;i<d.t.length;i++)
    out.push({t:+d.t[i], o:+d.o[i], h:+d.h[i], l:+d.l[i], c:+d.c[i]});
  return out;
}

function findSwings(c, k){
  const sw = [];
  for(let i=k; i<c.length-k; i++){
    let isH=true, isL=true;
    for(let j=i-k; j<=i+k; j++){
      if(j===i) continue;
      if(c[j].h >= c[i].h) isH=false;
      if(c[j].l <= c[i].l) isL=false;
      if(!isH && !isL) break;
    }
    if(isH) sw.push({i, type:'H', p:c[i].h});
    if(isL) sw.push({i, type:'L', p:c[i].l});
  }
  return sw;
}
// causal ortalama bar aralığı: endIdx'e KADARKİ son 200 bar
function avgRange(c, endIdx){
  const s = Math.max(0, endIdx-200);
  let sum=0; for(let j=s;j<endIdx;j++) sum += c[j].h-c[j].l;
  return sum/(endIdx-s);
}
function invert(c){ return c.map(b=>({t:b.t, o:-b.o, h:-b.l, l:-b.h, c:-b.c})); }

function aggregate(c, f){
  const out=[];
  for(let i=0;i+f<=c.length;i+=f){
    let h=-Infinity,l=Infinity;
    for(let j=i;j<i+f;j++){ h=Math.max(h,c[j].h); l=Math.min(l,c[j].l); }
    out.push({t:c[i].t,o:c[i].o,h,l,c:c[i+f-1].c});
  }
  return out;
}
// entryBar anına KADARKİ veriyle HTF orderflow (causal)
function htfOrderflow(c, endIdx){
  const htf = aggregate(c.slice(Math.max(0,endIdx-800), endIdx), 4);
  const sw = findSwings(htf, 2);
  const hs = sw.filter(s=>s.type==='H').slice(-2);
  const ls = sw.filter(s=>s.type==='L').slice(-2);
  if(hs.length<2 || ls.length<2) return 'Notr';
  const hh = hs[1].p>hs[0].p, hl = ls[1].p>ls[0].p;
  if(hh&&hl) return 'Bullish';
  if(!hh&&!hl) return 'Bearish';
  return 'Notr';
}

/* index.html'deki detectSellModels ile aynı parametreler; farklar:
   - "SMR sonrası daha yüksek high var" küresel eleme YOK (lookahead) —
     giriş taraması zaten SMR aşılırsa modeli geçersiz kılıyor
   - stop tamponu causal avgRange ile */
function detectAndTrade(c){
  const trades = [];
  const sw = findSwings(c, 3);
  const highs = sw.filter(s=>s.type==='H');
  const lows  = sw.filter(s=>s.type==='L');
  const n = c.length;

  for(const smr of highs){
    const prevHs = highs.filter(x => x.i < smr.i && x.i >= smr.i-200);
    if(!prevHs.length) continue;
    const ph = prevHs.reduce((a,b)=> b.p>a.p ? b : a);
    if(smr.p <= ph.p) continue;                       // likidite süpürme yok

    const legLows = lows.filter(x => x.i > ph.i && x.i < smr.i);
    const legLow = legLows.length ? legLows[legLows.length-1]
                 : lows.filter(x=>x.i<smr.i).slice(-1)[0];
    if(!legLow) continue;

    let msbBar = -1;
    for(let j=smr.i+1; j<Math.min(n, smr.i+150); j++){
      if(c[j].h > smr.p) break;                       // MSB'den önce SMR aşıldı → geçersiz
      if(c[j].c < legLow.p){ msbBar = j; break; }
    }
    if(msbBar < 0) continue;

    // düşüş impalsının dibi
    let impIdx = msbBar;
    for(let j=msbBar; j<Math.min(n, msbBar+80); j++){
      if(c[j].l < c[impIdx].l) impIdx = j;
      if(j > impIdx+6 && c[j].c > (c[impIdx].l + (smr.p-c[impIdx].l)*0.5)) break;
    }
    const impLow = c[impIdx].l;

    // ayı FVG'leri (SMR→dip bacağında)
    const fvgs = [];
    for(let j=smr.i+1; j<impIdx; j++){
      const gap = c[j-1].l - c[j+1].h;
      if(gap > 0) fvgs.push({i:j, top:c[j-1].l, bottom:c[j+1].h});
    }
    const mid = impLow + (smr.p-impLow)*0.5;
    const fvg = fvgs.filter(f=>(f.top+f.bottom)/2 >= mid).sort((a,b)=>a.top-b.top)[0]
             || fvgs.sort((a,b)=>b.top-a.top)[0];
    if(!fvg) continue;

    // giriş: dipten sonra FVG'ye dönüş (SMR aşılırsa geçersiz)
    let entryBar = -1;
    for(let j=impIdx+1; j<n; j++){
      if(c[j].h > smr.p) break;
      if(c[j].h >= fvg.bottom){ entryBar = j; break; }
    }
    if(entryBar < 0) continue;

    const entry = fvg.bottom;
    const stop = smr.p + avgRange(c, msbBar)*0.3;

    // DOL: markup öncesi likidite
    const originStart = Math.max(0, ph.i-250);
    let dol = Infinity;
    for(let j=originStart; j<=ph.i; j++) dol = Math.min(dol, c[j].l);
    if(!(dol < impLow)) dol = entry - 2.5*(stop-entry);

    const rr = (entry-dol)/(stop-entry);
    if(!(rr > 0)) continue;

    // sonuç: stop mu hedef mi önce? (aynı barda ikisi de → muhafazakâr: ZARAR)
    let result = 'open', exitBar = -1;
    for(let j=entryBar; j<n; j++){
      const stopHit = c[j].h >= stop, tgtHit = c[j].l <= dol;
      if(stopHit){ result='loss'; exitBar=j; break; }
      if(tgtHit){ result='win'; exitBar=j; break; }
    }
    trades.push({smrBar:smr.i, entryBar, exitBar, entry, stop, dol, rr, result,
                 curveOk: rr >= 1});
  }
  // aynı giriş barına düşen kopyaları ele (en erken SMR kalsın)
  const seen = new Set(), ded = [];
  for(const t of trades.sort((a,b)=>a.smrBar-b.smrBar)){
    if(seen.has(t.entryBar)) continue;
    seen.add(t.entryBar); ded.push(t);
  }
  return ded;
}

function summarize(name, trades){
  const closed = trades.filter(t=>t.result!=='open');
  const wins = closed.filter(t=>t.result==='win');
  const losses = closed.filter(t=>t.result==='loss');
  const sumWinR = wins.reduce((s,t)=>s+t.rr, 0);
  const totalR = sumWinR - losses.length;
  const wr = closed.length ? (wins.length/closed.length*100) : 0;
  const avgRR = closed.length ? closed.reduce((s,t)=>s+t.rr,0)/closed.length : 0;
  const pf = losses.length ? sumWinR/losses.length : Infinity;
  console.log(`  ${name.padEnd(34)} islem:${String(closed.length).padStart(4)}  ` +
    `kazanc:${String(wins.length).padStart(3)}  kayip:${String(losses.length).padStart(3)}  ` +
    `WR:%${wr.toFixed(1).padStart(5)}  ortRR:${avgRR.toFixed(2)}  ` +
    `toplamR:${totalR>=0?'+':''}${totalR.toFixed(1)}  PF:${pf===Infinity?'inf':pf.toFixed(2)}`);
  return {closed:closed.length, wins:wins.length, losses:losses.length, wr, totalR, pf};
}

const path = process.argv[2];
if(!path){ console.error('kullanım: node backtest.js <klines.json>'); process.exit(1); }
const candles = loadCandles(path);
const fmt = t => new Date(t*1000).toISOString().slice(0,10);
console.log(`\n=== ${path} — ${candles.length} mum (${fmt(candles[0].t)} → ${fmt(candles[candles.length-1].t)}) ===`);

const inv = invert(candles);
const sellT = detectAndTrade(candles).map(t=>({...t, dir:'SELL'}));
const buyTinv = detectAndTrade(inv);
const buyT = buyTinv.map(t=>({...t, dir:'BUY', entry:-t.entry, stop:-t.stop, dol:-t.dol}));
const all = [...sellT, ...buyT].sort((a,b)=>a.entryBar-b.entryBar);

// causal HTF orderflow filtresi
for(const t of all){
  const of = htfOrderflow(candles, t.entryBar);
  t.ofOk = (t.dir==='SELL' && of==='Bearish') || (t.dir==='BUY' && of==='Bullish');
}

// varyant: DOL yerine sabit R-katı hedef
function simulateFixed(t, R){
  const risk = Math.abs(t.stop - t.entry);
  const sell = t.dir==='SELL';
  const tp = sell ? t.entry - R*risk : t.entry + R*risk;
  for(let j=t.entryBar; j<candles.length; j++){
    const b = candles[j];
    const stopHit = sell ? b.h >= t.stop : b.l <= t.stop;
    const tpHit   = sell ? b.l <= tp     : b.h >= tp;
    if(stopHit) return 'loss';
    if(tpHit) return 'win';
  }
  return 'open';
}
const fixed2R = all.map(t=>({...t, rr:2, result:simulateFixed(t,2)}));
const fixed1R = all.map(t=>({...t, rr:1, result:simulateFixed(t,1)}));

summarize('TUM SETUPLAR', all);
summarize('  yon: SELL', all.filter(t=>t.dir==='SELL'));
summarize('  yon: BUY', all.filter(t=>t.dir==='BUY'));
summarize('FILTRE: HTF orderflow uyumlu', all.filter(t=>t.ofOk));
summarize('FILTRE: orderflow + RR>=1.5', all.filter(t=>t.ofOk && t.rr>=1.5));
summarize('FILTRE: RR>=1.5 (orderflowsuz)', all.filter(t=>t.rr>=1.5));
summarize('VARYANT: sabit 2R hedef', fixed2R);
summarize('VARYANT: 2R + orderflow uyumlu', fixed2R.filter(t=>t.ofOk));
summarize('VARYANT: sabit 1R hedef', fixed1R);
summarize('VARYANT: 1R + orderflow uyumlu', fixed1R.filter(t=>t.ofOk));

const open = all.filter(t=>t.result==='open');
if(open.length) console.log(`  (halen acik/sonuclanmamis: ${open.length})`);

// son 5 islem dokumu
console.log('  Son 5 islem:');
for(const t of all.slice(-5)){
  console.log(`    ${t.dir.padEnd(4)} giris:${fmt(candles[t.entryBar].t)} @${t.entry.toFixed(1)} ` +
    `stop:${t.stop.toFixed(1)} hedef:${t.dol.toFixed(1)} RR:${t.rr.toFixed(2)} → ${t.result}`);
}
