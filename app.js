/* LearnGeo 2026 - app.js (data lokal, Leaflet tanpa API key, ikon Heroicons) */
"use strict";

const BENUA_LIST = ["Asia","Afrika","Eropa","Amerika Utara","Amerika Selatan","Oseania"];

// Bendera: SVG vektor (tajam di semua ukuran) + PNG cadangan + emoji terakhir
function flagUrl(c, w){ return `https://flagcdn.com/w${w||80}/${String(c.cca2||"").toLowerCase()}.png`; }
function flagSvg(c){ return `https://flagcdn.com/${String(c.cca2||"").toLowerCase()}.svg`; }
function flagImg(c, w, cls){
  const f = c.flagEmoji || "🏳️";
  const png = flagUrl(c, w>=160?320:160);
  return `<img class="${cls||"flag-img"}" src="${flagSvg(c)}" alt="Bendera ${c.name_id}" loading="lazy" decoding="async" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${png}'}else{this.outerHTML='${f}'}" width="320">`;
}

// Darurat: dipakai hanya jika countries.json gagal dimuat (mis. dibuka via file://)
const FALLBACK_RAW = [
  ["id","IDN","Indonesia","Indonesia","Asia","Jakarta","IDR","Rupiah","Rp","+62",["Indonesia"],284e6,"🇮🇩",1905,[-2.5,118]],
  ["my","MYS","Malaysia","Malaysia","Asia","Kuala Lumpur","MYR","Ringgit","RM","+60",["Melayu"],34e6,"🇲🇾",330,[-4,102]],
  ["sg","SGP","Singapura","Singapore","Asia","Singapura","SGD","Dolar Singapura","S$","+65",["Inggris","Melayu"],6e6,"🇸🇬",0.7,[1.35,103.8]],
  ["jp","JPN","Jepang","Japan","Asia","Tokyo","JPY","Yen","¥","+81",["Jepang"],124e6,"🇯🇵",377,[36,138]],
  ["us","USA","Amerika Serikat","United States","Amerika Utara","Washington D.C.","USD","Dolar AS","$","+1",["Inggris"],340e6,"🇺🇸",9834,[38,-97]],
  ["gb","GBR","Inggris","United Kingdom","Eropa","London","GBP","Poundsterling","£","+44",["Inggris"],69e6,"🇬🇧",243,[54,-2]],
  ["fr","FRA","Prancis","France","Eropa","Paris","EUR","Euro","€","+33",["Prancis"],68e6,"🇫🇷",551,[46,2]],
  ["sa","SAU","Arab Saudi","Saudi Arabia","Asia","Riyadh","SAR","Riyal","﷼","+966",["Arab"],36e6,"🇸🇦",2149,[24,45]],
  ["au","AUS","Australia","Australia","Oseania","Canberra","AUD","Dolar Australia","A$","+61",["Inggris"],26e6,"🇦🇺",7692,[-25,133]],
  ["br","BRA","Brasil","Brazil","Amerika Selatan","Brasília","BRL","Real","R$","+55",["Portugis"],212e6,"🇧🇷",8516,[-10,-55]],
  ["eg","EGY","Mesir","Egypt","Afrika","Kairo","EGP","Pound Mesir","E£","+20",["Arab"],118e6,"🇪🇬",1001,[26,30]],
  ["de","DEU","Jerman","Germany","Eropa","Berlin","EUR","Euro","€","+49",["Jerman"],84e6,"🇩🇪",357,[51,10]],
];

function fallbackCountries(){
  return FALLBACK_RAW.map(r=>({
    cca2:r[0], cca3:r[1], name_id:r[2], name_en:r[3], continent:r[4],
    capital:r[5], currency:{code:r[6],name:r[7],symbol:r[8]},
    phone:r[9], languages:r[10], population:Math.round(r[11]),
    flagEmoji:r[12], area:r[13], latlng:r[14]
  }));
}

const state = {
  countries: fallbackCountries(),
  leaders: {},
  live: false,
  qn: { round:0, score:0, streak:0, current:null, lock:false },
  qb: { round:0, score:0, streak:0, current:null, lock:false },
  mapInit:false, map:null, geoLayer:null, byIso:{},
};
const TOTAL_ROUNDS = 10;
const $ = id => document.getElementById(id);
const fmtID = n => new Intl.NumberFormat("id-ID").format(n||0);
const shuffle = a => { const x=[...a]; for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];} return x; };
const pick = a => a[Math.floor(Math.random()*a.length)];

/* ---------- Efek suara (WebAudio, tanpa file) + confetti + bagikan ---------- */
const Snd = {
  on: localStorage.getItem("lg_sound")!=="0", ctx:null,
  beep(f,d,type,g){
    if(!this.on) return;
    try{
      this.ctx = this.ctx || new (window.AudioContext||window.webkitAudioContext)();
      const o=this.ctx.createOscillator(), v=this.ctx.createGain();
      o.type=type||"sine"; o.frequency.value=f; v.gain.value=g||.12;
      o.connect(v); v.connect(this.ctx.destination);
      const t=this.ctx.currentTime;
      v.gain.setValueAtTime(g||.12,t); v.gain.exponentialRampToValueAtTime(.001,t+d);
      o.start(t); o.stop(t+d);
    }catch(e){}
  },
  click(){ this.beep(520,.06,"triangle",.07); },
  ok(){ this.beep(660,.12); setTimeout(()=>this.beep(880,.16),110); },
  no(){ this.beep(220,.22,"sawtooth",.08); },
  win(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.beep(f,.2),i*135)); },
};
/* ---------- Ikon Heroicons (sprite icons.svg) ---------- */
const U = id => `<svg class="ic" aria-hidden="true"><use href="icons.svg#${id}"/></svg>`;
function paintSoundBtn(){ $("btnSound").innerHTML = U(Snd.on?"i-speaker-wave":"i-speaker-x-mark"); }
function resultIcon(el, score, hi, mid){
  $(el).innerHTML = U(score>=hi?"i-trophy":score>=mid?"i-sparkles":"i-rocket-launch");
}
function confetti(){
  const em=["🎉","⭐","🌍","🎊","✨","🏆"];
  for(let i=0;i<45;i++){
    const s=document.createElement("span");
    s.className="confetti"; s.textContent=pick(em);
    s.style.left=(Math.random()*100)+"vw";
    s.style.animationDelay=(Math.random()*.7)+"s";
    s.style.fontSize=(15+Math.random()*22)+"px";
    document.body.appendChild(s); setTimeout(()=>s.remove(),3400);
  }
}
async function shareScore(text){
  const data={title:"LearnGeo 2026", text, url:location.href};
  if(navigator.share){ try{ await navigator.share(data); return; }catch(e){ if(e&&e.name==="AbortError") return; } }
  try{ await navigator.clipboard.writeText(text+" "+location.href); alert("Skor disalin! Tempel ke WA / IG 📋"); }
  catch(e){ prompt("Salin skormu:", text); }
}
function sumRows(hist){
  return hist.map((h,i)=>`<div class="sum-row">${flagImg({cca2:h.c2||"",name_id:h.n,flagEmoji:h.f||"🏳️"},40,"flag-card")}<span>${i+1}. ${h.n}</span><b>${h.ok?"✅":"❌"}${h.pts!=null?" • +"+fmtID(h.pts):""}</b></div>`).join("");
}

/* ---------- Navigasi ---------- */
function goto(tab){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  $("page-"+tab).classList.add("active");
  window.scrollTo({top:0, behavior:"smooth"});
  if(tab==="jelajah") setTimeout(initMap, 60);
}
document.querySelectorAll("[data-goto]").forEach(el=>el.addEventListener("click",()=>goto(el.dataset.goto)));
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.tab)));

/* ---------- Load data: 250 negara dari countries.json lokal (tidak perlu internet/API) ---------- */
async function loadCountries(){
  try{
    const r = await fetch("countries.json");
    if(!r.ok) throw 0;
    const j = await r.json();
    if(j.length>200){ state.countries=j; state.live=true; }
  }catch(e){ /* tetap pakai fallback darurat */ }
  try{
    const r2 = await fetch("leaders.json");
    if(r2.ok) state.leaders = await r2.json();
  }catch(e){}
  refreshCounts();
}
function refreshCounts(){
  $("statTotal").textContent = state.countries.length;
  $("dataStatus").textContent = state.live
    ? `✓ ${state.countries.length} negara + bendera dimuat dari data lokal 2026. Siap main!`
    : `! countries.json tidak terbaca (buka via http://localhost:8000, jangan double-click file). Memakai data darurat.`;
  $("daftarCount").textContent = `${state.countries.length} negara • data 2026 • semua berbahasa Indonesia`;
  paintFeatured();
  renderList();
}

/* ---------- KUIS NEGARA ---------- */
function distractors(correct, n, sameContinent){
  let pool = state.countries.filter(c=>c.cca3!==correct.cca3);
  if(sameContinent){
    const same = pool.filter(c=>c.continent===correct.continent);
    if(same.length>=n) pool = same;
  }
  return shuffle(pool).slice(0,n);
}
function startNegara(){
  const pool=state.countries.filter(c=>c.continent!=="Antarktika");
  state.qn={round:0,score:0,streak:0,current:null,lock:false,hist:[],order:shuffle(pool.length?pool:state.countries)};
  $("qnSetup").classList.add("hidden"); $("qnResult").classList.add("hidden"); $("qnPlay").classList.remove("hidden");
  nextQn();
}
function nextQn(){
  const q=state.qn; q.round++; q.lock=false;
  if(q.round>TOTAL_ROUNDS) return endQn();
  const level=$("levelNegara").value;
  const ord=(q.order&&q.order.length)?q.order:state.countries;
  const c=ord[(q.round-1)%ord.length]; q.current=c;
  const hard = level==="sulit";
  const opts = shuffle([c, ...distractors(c,3,!hard)]);
  $("qnRound").textContent=`Soal ${q.round}/${TOTAL_ROUNDS}`;
  $("qnBar").style.width=((q.round-1)/TOTAL_ROUNDS*100)+"%";
  $("qnScore").textContent=q.score; $("qnStreak").textContent=q.streak;
  const clues=[];
  if(level==="mudah"){ clues.push("Ibu kota: "+c.capital, c.continent, "Pop: ±"+fmtID(Math.round(c.population/1e6))+" jt"); }
  else if(level==="sedang"){ clues.push("Benua: "+c.continent); }
  $("qnClues").innerHTML=clues.map(t=>`<span class="chip">${t}</span>`).join("");
  $("qnFlag").innerHTML = flagImg(c, 160, "flag-quiz");
  $("qnFeedback").className="feedback hidden"; $("qnFeedback").innerHTML="";
  $("qnNext").classList.add("hidden");
  const box=$("qnOptions"); box.innerHTML="";
  opts.forEach(o=>{
    const b=document.createElement("button"); b.className="opt"; b.textContent=o.name_id;
    b.onclick=()=>answerQn(b,o); box.appendChild(b);
  });
}
function answerQn(btn, chosen){
  const q=state.qn; if(q.lock) return; q.lock=true;
  const c=q.current, ok = chosen.cca3===c.cca3;
  document.querySelectorAll("#qnOptions .opt").forEach(b=>{
    b.disabled=true;
    if(b.textContent===c.name_id) b.classList.add("correct");
    else if(b===btn && !ok) b.classList.add("wrong");
  });
  if(ok){ q.streak++; const pts=10+(q.streak>=3?2*(q.streak-2):0); q.score+=pts; q.hist.push({n:c.name_id,ok:true,pts,c2:c.cca2,f:c.flagEmoji}); Snd.ok(); }
  else { q.streak=0; q.hist.push({n:c.name_id,ok:false,c2:c.cca2,f:c.flagEmoji}); Snd.no(); }
  $("qnScore").textContent=q.score; $("qnStreak").textContent=q.streak;
  $("qnBar").style.width=(q.round/TOTAL_ROUNDS*100)+"%";
  const f=$("qnFeedback");
  f.className="feedback "+(ok?"ok":"no");
  f.innerHTML=(ok?`✅ <b>Benar!</b> Ini <b>${c.name_id}</b>.`:`❌ Kurang tepat. Ini <b>${c.name_id}</b>.`)
    +`<br>Ibu kota: <b>${c.capital}</b> • Benua: <b>${c.continent}</b><br>${c.currency.code} (${c.currency.name} ${c.currency.symbol}) • Tel: ${c.phone} • Populasi: ${c.population?fmtID(c.population):"data tidak tersedia"}`;
  $("qnNext").classList.remove("hidden");
}
function endQn(){
  const q=state.qn;
  $("qnPlay").classList.add("hidden"); $("qnResult").classList.remove("hidden");
  const best=Math.max(q.score, +localStorage.getItem("lg_best_negara")||0);
  localStorage.setItem("lg_best_negara",best);
  $("statBestNegara").textContent=best; $("bestNegaraTxt").textContent=best;
  resultIcon("qnResultEmoji", q.score, 80, 50);
  $("qnResultTitle").textContent=`Skor: ${q.score} / ${TOTAL_ROUNDS*10+20}`;
  $("qnResultDesc").textContent = q.score>=80?"Luar biasa! Kamu master geografi 🌍":q.score>=50?"Bagus! Sedikit lagi sempurna.":"Ayo belajar di menu Negara lalu coba lagi!";
  $("qnSummary").innerHTML=sumRows(q.hist||[]);
  if(q.score>=80){ confetti(); Snd.win(); }
}
$("btnStartNegara").onclick=()=>{ Snd.click(); startNegara(); };
$("btnRetryNegara").onclick=()=>{ Snd.click(); startNegara(); };
$("qnNext").onclick=()=>{ Snd.click(); nextQn(); };
$("btnShareNegara").onclick=()=>shareScore(`🌍 LearnGeo: aku dapat skor ${state.qn.score} di Tebak Negara! Berani lawan?`);

/* ---------- KUIS BENUA ---------- */
function startBenua(){
  const pool=state.countries.filter(c=>BENUA_LIST.includes(c.continent));
  state.qb={round:0,score:0,streak:0,current:null,lock:false,hist:[],order:shuffle(pool.length?pool:state.countries)};
  $("qbSetup").classList.add("hidden"); $("qbResult").classList.add("hidden"); $("qbPlay").classList.remove("hidden");
  nextQb();
}
function nextQb(){
  const q=state.qb; q.round++; q.lock=false;
  if(q.round>TOTAL_ROUNDS) return endQb();
  const ord=(q.order&&q.order.length)?q.order:state.countries;
  const c=ord[(q.round-1)%ord.length]; q.current=c;
  $("qbRound").textContent=`Soal ${q.round}/${TOTAL_ROUNDS}`;
  $("qbBar").style.width=((q.round-1)/TOTAL_ROUNDS*100)+"%";
  $("qbScore").textContent=q.score; $("qbStreak").textContent=q.streak;
  $("qbFlag").innerHTML = flagImg(c, 160, "flag-quiz");
  $("qbName").textContent=`${c.name_id} ada di benua apa?`;
  $("qbFeedback").className="feedback hidden"; $("qbFeedback").innerHTML="";
  $("qbNext").classList.add("hidden");
  const box=$("qbOptions"); box.innerHTML="";
  shuffle(BENUA_LIST).forEach(bn=>{
    const b=document.createElement("button"); b.className="opt"; b.textContent=bn;
    b.onclick=()=>answerQb(b,bn); box.appendChild(b);
  });
}
function answerQb(btn, chosen){
  const q=state.qb; if(q.lock) return; q.lock=true;
  const c=q.current, ok=chosen===c.continent;
  document.querySelectorAll("#qbOptions .opt").forEach(b=>{
    b.disabled=true;
    if(b.textContent===c.continent) b.classList.add("correct");
    else if(b===btn&&!ok) b.classList.add("wrong");
  });
  if(ok){ q.streak++; q.score+=10+(q.streak>=3?2*(q.streak-2):0); q.hist.push({n:c.name_id,ok:true,c2:c.cca2,f:c.flagEmoji}); Snd.ok(); }
  else { q.streak=0; q.hist.push({n:c.name_id,ok:false,c2:c.cca2,f:c.flagEmoji}); Snd.no(); }
  $("qbScore").textContent=q.score; $("qbStreak").textContent=q.streak;
  $("qbBar").style.width=(q.round/TOTAL_ROUNDS*100)+"%";
  const f=$("qbFeedback");
  f.className="feedback "+(ok?"ok":"no");
  f.innerHTML=(ok?`✅ <b>Benar!</b> `:`❌ Bukan ${chosen}. `)+`<b>${c.name_id}</b> ada di <b>${c.continent}</b>. Ibu kota: ${c.capital}.`;
  $("qbNext").classList.remove("hidden");
}
function endQb(){
  const q=state.qb;
  $("qbPlay").classList.add("hidden"); $("qbResult").classList.remove("hidden");
  const best=Math.max(q.score,+localStorage.getItem("lg_best_benua")||0);
  localStorage.setItem("lg_best_benua",best);
  $("statBestBenua").textContent=best; $("bestBenuaTxt").textContent=best;
  resultIcon("qbResultEmoji", q.score, 80, 50);
  $("qbResultTitle").textContent=`Skor: ${q.score}`;
  $("qbResultDesc").textContent=q.score>=80?"Peta benua di luar kepala!":"Ayo jelajahi peta lalu coba lagi!";
  $("qbSummary").innerHTML=sumRows(q.hist||[]);
  if(q.score>=80){ confetti(); Snd.win(); }
}
$("btnStartBenua").onclick=()=>{ Snd.click(); startBenua(); };
$("btnRetryBenua").onclick=()=>{ Snd.click(); startBenua(); };
$("qbNext").onclick=()=>{ Snd.click(); nextQb(); };
$("btnShareBenua").onclick=()=>shareScore(`🗺️ LearnGeo: aku dapat skor ${state.qb.score} di Tebak Benua! Berani lawan?`);

/* ---------- INFO HTML ---------- */
function leaderOf(c){
  const L = state.leaders[c.cca3];
  if(L && L[1]) return {role:L[0]||"Pemimpin", name:L[1]};
  return {role:"Pemimpin", name:"Belum ada data"};
}
function infoHTML(c, withClose){
  const ld = leaderOf(c);
  return `
  <div class="modal-head">
    <div><div class="flag-big">${flagImg(c, 160, "flag-modal")}</div>
    <h3 style="margin:.4rem 0">${c.name_id}</h3>
    <p class="muted" style="margin:0">${c.name_en} • ${c.continent}</p></div>
    ${withClose?`<button class="x" onclick="modalClose()" title="Tutup">${U("i-x-mark")}</button>`:""}
  </div>
  <dl class="kv">
    <dt>${U("i-identification")} ${ld.role}</dt><dd>${ld.name}</dd>
    <dt>${U("i-building-office-2")} Ibu kota</dt><dd>${c.capital}</dd>
    <dt>${U("i-banknotes")} Mata uang</dt><dd>${c.currency.code} • ${c.currency.name} ${c.currency.symbol}</dd>
    <dt>${U("i-phone")} Kode telepon</dt><dd>${c.phone}</dd>
    <dt>${U("i-language")} Bahasa</dt><dd>${c.languages.join(", ")}</dd>
    <dt>${U("i-users")} Populasi</dt><dd>${c.population?fmtID(c.population)+" jiwa":"Data tidak tersedia"}</dd>
    <dt>${U("i-arrows-pointing-out")} Luas</dt><dd>${fmtID(Math.round(c.area))} km²</dd>
  </dl>
  <div class="row-btns">
    <button class="btn ghost" onclick="modalClose()">Tutup</button>
  </div>`;
}
function showPanel(c){
  $("infoEmpty").classList.add("hidden");
  const box=$("infoContent"); box.classList.remove("hidden");
  box.innerHTML=infoHTML(c, false);
}
window.modalClose=()=>$("modalBackdrop").classList.add("hidden");
$("modalBackdrop").addEventListener("click",e=>{ if(e.target.id==="modalBackdrop") window.modalClose(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") window.modalClose(); });
function openModal(c){ $("modalCard").innerHTML=infoHTML(c, true); $("modalBackdrop").classList.remove("hidden"); }

/* ---------- DAFTAR NEGARA ---------- */
function renderList(){
  const q=($("listSearch").value||"").toLowerCase(), f=$("filterBenua").value;
  const grid=$("countryGrid"); grid.innerHTML="";
  const rows=state.countries.filter(c=>
    (!f||c.continent===f)&&(!q||c.name_id.toLowerCase().includes(q)||c.name_en.toLowerCase().includes(q)||(c.capital||"").toLowerCase().includes(q)));
  rows.slice(0,300).forEach(c=>{
    const b=document.createElement("button"); b.className="country-card";
    b.innerHTML=`${flagImg(c, 80, "flag-card")}<strong>${c.name_id}</strong><small>${c.continent} • ${c.capital}</small>`;
    b.onclick=()=>openModal(c);
    grid.appendChild(b);
  });
  if(!rows.length) grid.innerHTML=`<p class="muted">Tidak ketemu. Coba kata kunci lain.</p>`;
}
$("listSearch").addEventListener("input",renderList);
$("filterBenua").addEventListener("change",renderList);

/* ---------- PETA ---------- */
const GEO_URLS=[
  "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
];
function isoOfFeature(f){
  const p=f.properties||{};
  let iso=p.ISO_A3||p.iso_a3||p.ADM0_A3||p.adm0_a3||p.ISO_A3_EH||p.id||"";
  iso=String(iso).toUpperCase();
  // Data Natural Earth menandai beberapa negara sebagai "-99"; petakan ke ISO yang benar.
  if(iso==="-99"&&p.ADMIN) iso = ({"France":"FRA","Norway":"NOR","Kosovo":"KOS","Somalia":"SOM"})[p.ADMIN] || iso;
  return iso;
}
function findCountry(iso, name){
  if(!iso&&!name) return null;
  iso=String(iso||"").toUpperCase();
  const fix={"-99":"NOR",SOM:"SOM",KOS:"KOS"};
  if(fix[iso]) iso=fix[iso];
  let c=state.byIso[iso];
  if(c) return c;
  if(name){
    const n=name.toLowerCase();
    c=state.countries.find(x=>x.name_en.toLowerCase()===n);
    if(c) return c;
  }
  return null;
}
/* Warna hidup per benua */
const BENUA_COLORS = {
  "Asia":"#eab308", "Afrika":"#f97316", "Eropa":"#8b5cf6",
  "Amerika Utara":"#22c55e", "Amerika Selatan":"#14b8a6",
  "Oseania":"#38bdf8", "Antarktika":"#94a3b8"
};
function benuaColorOf(feat){
  const p=feat.properties||{};
  const nm=(p.ADMIN||p.name)||"";
  const c=findCountry(isoOfFeature(feat), nm);
  return (c&&BENUA_COLORS[c.continent])||"#64748b";
}
function baseStyle(feat){ return {color:"#ffffff",weight:1,opacity:.85,fillColor:benuaColorOf(feat),fillOpacity:.55}; }
function hoverStyle(feat){ const s=baseStyle(feat); s.weight=2.5; s.fillOpacity=.85; return s; }
function paintLegend(){
  const box=$("mapLegend"); if(!box) return;
  const order=["Asia","Afrika","Eropa","Amerika Utara","Amerika Selatan","Oseania"];
  box.innerHTML=order.map(b=>`<span class="lg-item"><i style="background:${BENUA_COLORS[b]}"></i>${b}</span>`).join("");
}
function mapStatus(t){ const el=$("mapStatus"); if(el) el.textContent=t; }
async function initMap(){
  if(state.mapInit){ setTimeout(()=>state.map&&state.map.invalidateSize(),200); return; }
  state.mapInit=true;
  mapStatus("Memuat ubin peta (Esri, gratis tanpa kunci)…");
  const map=L.map("map",{worldCopyJump:true,minZoom:2,maxZoom:12}).setView([20,15],2);
  state.map=map;
  // Semua sumber tile gratis tanpa API key. Gagal di satu, pindah otomatis ke berikutnya.
  const TILE_SETS=[
    {url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", name:"Esri"},
    {url:"https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", name:"OSM Humanitarian"},
    {url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png", name:"OSM Standar"}
  ];
  let tileIdx=0, tileErr=0;
  const tiles=L.tileLayer(TILE_SETS[0].url,{maxZoom:12,attribution:"© OpenStreetMap, Tiles © Esri"}).addTo(map);
  tiles.on("tileerror",()=>{
    tileErr++;
    if(tileErr>8 && tileIdx<TILE_SETS.length-1){
      const gagal=TILE_SETS[tileIdx].name;
      tileIdx++; tileErr=0;
      tiles.setUrl(TILE_SETS[tileIdx].url);
      mapStatus(`Sumber ${gagal} gagal, beralih ke ${TILE_SETS[tileIdx].name}…`);
    } else if(tileErr>24){
      mapStatus("Semua sumber ubin peta gagal dimuat. Periksa koneksi internet.");
    }
  });
  tiles.on("load",()=>mapStatus("Ubin peta OK. Memuat batas 250 negara…"));
  state.byIso={}; state.countries.forEach(c=>state.byIso[c.cca3]=c);
  paintLegend();
  let features=0, foundCountries=0;
  for(const url of GEO_URLS){
    try{
      const r=await fetch(url); if(!r.ok) continue;
      const gj=await r.json();
      features=(gj.features||[]).length;
      state.geoLayer=L.geoJSON(gj,{
        style:baseStyle,
        onEachFeature:(feat,layer)=>{
          const iso=isoOfFeature(feat);
          const nm=(feat.properties&&(feat.properties.ADMIN||feat.properties.name))||"";
          if(findCountry(iso,nm)) foundCountries++;
          layer.on({
            mouseover:e=>e.target.setStyle(hoverStyle(feat)),
            mouseout:e=>state.geoLayer.resetStyle(e.target),
            click:e=>{
              const c=findCountry(iso,nm);
              state.geoLayer.resetStyle();
              e.target.setStyle({color:"#111111",weight:3,opacity:1,fillOpacity:.85});
              e.target.bringToFront();
              if(c){ showPanel(c); mapStatus(`Kamu memilih ${c.name_id}. Lihat panel di samping untuk detailnya.`); }
              else{
                $("infoEmpty").classList.add("hidden");
                $("infoContent").classList.remove("hidden");
                $("infoContent").innerHTML=`<h3>${nm||iso||"Wilayah"}</h3><p class="muted">Data info belum tersedia untuk kode ${iso}. Coba negara lain, atau cari lewat kolom pencarian.</p>`;
                mapStatus(`${nm||iso||"Wilayah"} tidak ada di database 250 negara.`);
              }
            }
          });
          layer.bindTooltip(nm||iso,{sticky:true,direction:"top"});
        }
      }).addTo(map);
      break;
    }catch(e){ /* coba URL berikutnya */ }
  }
  if(!state.geoLayer){
    const box=$("mapLegend");
    if(box) box.innerHTML=`<span class="lg-item">Batas negara gagal dimuat. Periksa koneksi lalu buka ulang tab Jelajah.</span>`;
    mapStatus("Gagal memuat batas negara (butuh internet ke raw.githubusercontent.com). Ubin peta tetap bisa dipakai.");
  } else {
    mapStatus(`Peta siap: ${features} wilayah digambar, ${foundCountries} cocok dengan database 250 negara. Klik negara mana pun.`);
  }
  // search peta
  let mapSearchTimer=null;
  $("mapSearch").addEventListener("input",()=>{
    clearTimeout(mapSearchTimer);
    mapSearchTimer=setTimeout(()=>{
      const q=$("mapSearch").value.toLowerCase().trim(); if(!q) return;
      const c=state.countries.find(x=>x.name_id.toLowerCase().includes(q)||x.name_en.toLowerCase().includes(q));
      if(c){ showPanel(c); if(c.latlng) map.flyTo(c.latlng,4,{duration:1.2}); mapStatus(`Ditemukan: ${c.name_id}. Lihat detailnya di panel.`); }
      else mapStatus(`Tidak ada negara bernama "${q}".`);
    },350);
  });
}

/* ---------- Negara sorotan (hero, acak) ---------- */
function paintFeatured(){
  const pool=state.countries.filter(c=>c.population>500000 && c.continent!=="Antarktika");
  const c=pick(pool.length?pool:state.countries);
  if(!c||!$("featFlag")) return;
  $("featFlag").innerHTML=flagImg(c,160,"flag-quiz");
  $("featName").textContent=c.name_id;
  $("featSub").textContent=`${c.continent} • Ibu kota: ${c.capital}`;
  $("featChips").innerHTML=[
    `${c.currency.code}${c.currency.symbol?" ("+c.currency.symbol+")":""}`,
    `${c.phone}`,
    `${c.languages[0]||"-"}`
  ].map(t=>`<span class="chip">${t}</span>`).join("");
}

/* ---------- init ---------- */
if(location.protocol==="file:"){
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="filewarn">Halaman ini dibuka sebagai file langsung, jadi peta, ikon, dan data 250 negara tidak bisa dimuat. Jalankan <b>python -m http.server 8000</b> di folder ini lalu buka <b>http://localhost:8000</b>.</div>`);
}
$("statBestNegara").textContent=localStorage.getItem("lg_best_negara")||0;
$("statBestBenua").textContent=localStorage.getItem("lg_best_benua")||0;
$("bestNegaraTxt").textContent=localStorage.getItem("lg_best_negara")||0;
$("bestBenuaTxt").textContent=localStorage.getItem("lg_best_benua")||0;
paintSoundBtn();
$("btnSound").onclick=()=>{
  Snd.on=!Snd.on;
  localStorage.setItem("lg_sound",Snd.on?"1":"0");
  paintSoundBtn(); Snd.click();
};
$("btnShuffleFeat").onclick=()=>{ Snd.click(); paintFeatured(); };
refreshCounts();
loadCountries();
