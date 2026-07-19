#!/usr/bin/env node
/* Efloud motoru backtest'i: EOB girişi + TP1/TP2 kademeli yönetim (stop->entry)
   MMXM (FVG girişi, tek DOL hedefi) ile karşılaştırma.
   Kullanım: node backtest2.js <klines.json> */
"use strict";
const fs = require('fs');

function loadCandles(path){
  const d = JSON.parse(fs.readFileSync(path,'utf8'));
  const out = [];
  for(let i=0;i<d.t.length;i++)
    out.push({t:+d.t[i], o:+d.o[i], h:+d.h[i], l:+d.l[i], c:+d.c[i]});
  return out;
}
function findSwings(c, k){
  const sw=[];
  for(let i=k;i<c.length-k;i++){
    let isH=true,isL=true;
    for(let j=i-k;j<=i+k;j++){
      if(j===i)continue;
      if(c[j].h>=c[i].h)isH=false;
      if(c[j].l<=c[i].l)isL=false;
      if(!isH&&!isL)break;
    }
    if(isH)sw.push({i,type:'H',p:c[i].h});
    if(isL)sw.push({i,type:'L',p:c[i].l});
  }
  return sw;
}
function avgRange(c,endIdx){
  const s=Math.max(0,endIdx-200); let sum=0;
  for(let j=s;j<endIdx;j++)sum+=c[j].h-c[j].l;
  return sum/(endIdx-s);
}
function invert(c){ return c.map(b=>({t:b.t,o:-b.o,h:-b.l,l:-b.h,c:-b.c})); }
function aggregate(c,f){
  const out=[];
  for(let i=0;i+f<=c.length;i+=f){
    let h=-Infinity,l=Infinity;
    for(let j=i;j<i+f;j++){h=Math.max(h,c[j].h);l=Math.min(l,c[j].l);}
    out.push({t:c[i].t,o:c[i].o,h,l,c:c[i+f-1].c});
  }
  return out;
}
function htfOrderflow(c,endIdx){
  const htf=aggregate(c.slice(Math.max(0,endIdx-800),endIdx),4);
  const sw=findSwings(htf,2);
  const hs=sw.filter(s=>s.type==='H').slice(-2);
  const ls=sw.filter(s=>s.type==='L').slice(-2);
  if(hs.length<2||ls.length<2)return 'Notr';
  const hh=hs[1].p>hs[0].p, hl=ls[1].p>ls[0].p;
  if(hh&&hl)return 'Bullish';
  if(!hh&&!hl)return 'Bearish';
  return 'Notr';
}
// causal HTF bölgeleri (uygulamadaki findZones'un slice'lı kopyası) — sadece fiyatlar
function zonePrices(c, endIdx){
  const cc = c.slice(Math.max(0,endIdx-2000), endIdx);
  if(cc.length < 60) return [];
  const htf = aggregate(cc, 6);
  const sw = findSwings(htf, 2);
  const a = avgRange(cc, cc.length);
  const tol = a*2.4, zones=[];
  for(const s of sw){
    let z = zones.find(z=>Math.abs(z.p-s.p)<tol);
    if(z){ z.n++; z.p=(z.p*(z.n-1)+s.p)/z.n; } else zones.push({p:s.p, n:1});
  }
  return zones.filter(z=>z.n>=3).map(z=>z.p);
}

/* tespit — index.html ile aynı parametreler, causal; entryKind: 'fvg' | 'eob' */
function detect(c, entryKind){
  const trades=[];
  const sw=findSwings(c,3);
  const highs=sw.filter(s=>s.type==='H');
  const lows=sw.filter(s=>s.type==='L');
  const n=c.length;
  for(const smr of highs){
    const prevHs=highs.filter(x=>x.i<smr.i&&x.i>=smr.i-200);
    if(!prevHs.length)continue;
    const ph=prevHs.reduce((a,b)=>b.p>a.p?b:a);
    if(smr.p<=ph.p)continue;
    const legLows=lows.filter(x=>x.i>ph.i&&x.i<smr.i);
    const legLow=legLows.length?legLows[legLows.length-1]:lows.filter(x=>x.i<smr.i).slice(-1)[0];
    if(!legLow)continue;
    let msbBar=-1;
    for(let j=smr.i+1;j<Math.min(n,smr.i+150);j++){
      if(c[j].h>smr.p)break;
      if(c[j].c<legLow.p){msbBar=j;break;}
    }
    if(msbBar<0)continue;
    let impIdx=msbBar;
    for(let j=msbBar;j<Math.min(n,msbBar+80);j++){
      if(c[j].l<c[impIdx].l)impIdx=j;
      if(j>impIdx+6&&c[j].c>(c[impIdx].l+(smr.p-c[impIdx].l)*0.5))break;
    }
    const impLow=c[impIdx].l;
    let zone=null;
    if(entryKind==='eob'){
      for(let j=msbBar-1;j>Math.max(ph.i,smr.i-5);j--){
        if(c[j].c>c[j].o){ zone={top:c[j].h,bottom:Math.min(c[j].o,c[j].c)}; break; }
      }
    } else {
      const fvgs=[];
      for(let j=smr.i+1;j<impIdx;j++){
        const gap=c[j-1].l-c[j+1].h;
        if(gap>0)fvgs.push({top:c[j-1].l,bottom:c[j+1].h});
      }
      const mid=impLow+(smr.p-impLow)*0.5;
      zone=fvgs.filter(f=>(f.top+f.bottom)/2>=mid).sort((a,b)=>a.top-b.top)[0]
        ||fvgs.sort((a,b)=>b.top-a.top)[0];
    }
    if(!zone)continue;
    let entryBar=-1;
    for(let j=impIdx+1;j<n;j++){
      if(c[j].h>smr.p)break;
      if(c[j].h>=zone.bottom){entryBar=j;break;}
    }
    if(entryBar<0)continue;
    const entry=zone.bottom;
    const stop=smr.p+avgRange(c,msbBar)*0.3;
    const risk=stop-entry;
    if(!(risk>0))continue;
    const originStart=Math.max(0,ph.i-250);
    let dol=Infinity;
    for(let j=originStart;j<=ph.i;j++)dol=Math.min(dol,c[j].l);
    if(!(dol<impLow))dol=entry-2.5*risk;
    if(!((entry-dol)/risk>0))continue;
    trades.push({smrBar:smr.i,entryBar,entry,stop,dol,risk});
  }
  const seen=new Set(),ded=[];
  for(const t of trades.sort((a,b)=>a.smrBar-b.smrBar)){
    if(seen.has(t.entryBar))continue;
    seen.add(t.entryBar);ded.push(t);
  }
  return ded;
}

// tek hedef (tam pozisyon DOL'e)
function simFull(c,t){
  for(let j=t.entryBar;j<c.length;j++){
    if(c[j].h>=t.stop)return {r:-1,res:'loss'};
    if(c[j].l<=t.dol)return {r:(t.entry-t.dol)/t.risk,res:'win'};
  }
  return null;
}
// kademeli: TP1'de %50 kapat + stop->entry, kalan TP2'ye
function simTiered(c,t,tp1){
  const rr1=(t.entry-tp1)/t.risk, rr2=(t.entry-t.dol)/t.risk;
  let banked=0, be=false;
  for(let j=t.entryBar;j<c.length;j++){
    const stopLevel=be?t.entry:t.stop;
    if(c[j].h>=stopLevel)return {r:be?banked:-1,res:be?(banked>0?'be+':'be'):'loss'};
    if(c[j].l<=t.dol){
      if(!be)banked=0.5*rr1;
      return {r:banked+0.5*rr2,res:'win'};
    }
    if(!be&&c[j].l<=tp1){banked=0.5*rr1;be=true;}
  }
  return null;
}

function summarize(name,results){
  const done=results.filter(r=>r);
  if(!done.length){ console.log(`  ${name.padEnd(38)} islem yok`); return; }
  const totalR=done.reduce((s,r)=>s+r.r,0);
  const pos=done.filter(r=>r.r>0).length;
  const sumWin=done.filter(r=>r.r>0).reduce((s,r)=>s+r.r,0);
  const sumLossAbs=Math.abs(done.filter(r=>r.r<0).reduce((s,r)=>s+r.r,0));
  const pf=sumLossAbs?sumWin/sumLossAbs:Infinity;
  console.log(`  ${name.padEnd(38)} islem:${String(done.length).padStart(4)}  `+
    `karli:%${(pos/done.length*100).toFixed(1).padStart(5)}  `+
    `ortR:${(totalR/done.length).toFixed(2).padStart(6)}  `+
    `toplamR:${totalR>=0?'+':''}${totalR.toFixed(1).padStart(6)}  `+
    `PF:${pf===Infinity?'inf':pf.toFixed(2)}`);
}

const path=process.argv[2];
const candles=loadCandles(path);
const fmt=t=>new Date(t*1000).toISOString().slice(0,10);
console.log(`\n=== ${path.split('/').pop()} — ${candles.length} mum (${fmt(candles[0].t)} → ${fmt(candles[candles.length-1].t)}) ===`);

const inv=invert(candles);
function run(entryKind){
  const sells=detect(candles,entryKind).map(t=>({...t,dir:'SELL',c:candles}));
  const buys=detect(inv,entryKind).map(t=>({...t,dir:'BUY',c:inv}));
  const all=[...sells,...buys];
  for(const t of all){
    const of=htfOrderflow(t.c,t.entryBar);
    t.ofOk=(of==='Bearish');   // inverted uzayda sell tespiti → gerçek yön zaten simetrik
    // TP1: causal bölgeler (tespit uzayında)
    const zs=zonePrices(t.c,t.entryBar);
    const between=zs.filter(p=>p<t.entry-t.risk*0.8&&p>t.dol);
    t.tp1=between.length?Math.max(...between):t.entry-1.5*t.risk;
  }
  return all;
}

const fvgT=run('fvg'), eobT=run('eob');
console.log(`  -- FVG girisli tespit: ${fvgT.length} islem | EOB girisli: ${eobT.length} islem --`);
summarize('MMXM: FVG giris, tek hedef (DOL)', fvgT.map(t=>simFull(t.c,t)));
summarize('  + orderflow filtresi', fvgT.filter(t=>t.ofOk).map(t=>simFull(t.c,t)));
summarize('EFLOUD: EOB giris, tek hedef (DOL)', eobT.map(t=>simFull(t.c,t)));
summarize('  + orderflow filtresi', eobT.filter(t=>t.ofOk).map(t=>simFull(t.c,t)));
summarize('EFLOUD: EOB + TP1/TP2 stop->entry', eobT.map(t=>simTiered(t.c,t,t.tp1)));
summarize('  + orderflow filtresi', eobT.filter(t=>t.ofOk).map(t=>simTiered(t.c,t,t.tp1)));
summarize('FVG + TP1/TP2 stop->entry', fvgT.map(t=>simTiered(t.c,t,t.tp1)));
summarize('  + orderflow filtresi', fvgT.filter(t=>t.ofOk).map(t=>simTiered(t.c,t,t.tp1)));
