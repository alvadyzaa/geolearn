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
  try{ await navigator.clipboard.writeText(text+" "+location.href); alert(t("share_ok")); }
  catch(e){ prompt(t("share_prompt"), text); }
}
function sumRows(hist){
  return hist.map((h,i)=>`<div class="sum-row">${flagImg({cca2:h.c2||"",name_id:h.n,flagEmoji:h.f||"🏳️"},40,"flag-card")}<span>${i+1}. ${h.n}</span><b>${h.ok?"✅":"❌"}${h.pts!=null?" • +"+fmtID(h.pts):""}</b></div>`).join("");
}

function sumRows(hist){
  return hist.map((h,i)=>`<div class="sum-row">${flagImg({cca2:h.c2||"",name_id:h.n,flagEmoji:h.f||"🏳️"},40,"flag-card")}<span>${i+1}. ${h.n}</span><b>${h.ok?"✅":"❌"}${h.pts!=null?" • +"+fmtID(h.pts):""}</b></div>`).join("");
}

/* ---------- Bahasa ID/EN ---------- */
let LANG=localStorage.getItem("lg_lang")||"id";
const T={
nav_home:["Beranda","Home"],nav_country:["Tebak Negara","Guess the Country"],nav_continent:["Tebak Benua","Guess the Continent"],nav_explore:["Jelajah","Explore"],nav_list:["Negara","Countries"],
brand_sub:["Edisi Dunia 2026","2026 World Edition"],
hero_h1a:["Belajar geografi dunia","Learning world geography"],hero_h1b:["semudah main game.","is as easy as playing a game."],
hero_p:["Tidak perlu hafal nama jalan. Di sini kamu menebak <b>benua</b> dan <b>negara</b> dari 250 negara dan teritori (data 2026), lalu langsung dapat info pentingnya: ibu kota, mata uang, kode telepon, bahasa, populasi.","No need to memorize street names. Here you guess <b>continents</b> and <b>countries</b> from 250 countries and territories (2026 data), then instantly get the key facts: capital, currency, dial code, languages, population."],
cta_country:["Mulai Tebak Negara","Start country quiz"],cta_continent:["Tebak Benua","Continent quiz"],cta_map:["Buka Peta","Open map"],
stat_loaded:["negara dimuat","countries loaded"],stat_cont:["benua / region","continents"],stat_best_c:["skor terbaik negara","best country score"],stat_best_b:["skor terbaik benua","best continent score"],
feat_head:["Negara sorotan, diacak tiap dibuka","Featured country, shuffled on load"],feat_shuffle:["Acak lagi","Shuffle"],feat_all:["Semua negara","All countries"],
sec_modes:["Pilih mode belajar","Choose a mode"],
m1_tag:["Mulai dari sini","Start here"],m1_t:["Tebak Negara","Guess the Country"],
m1_d:["Lihat bendera dan petunjuk ibu kota, tebak dari 4 pilihan. 10 ronde per game, ada bonus beruntun.","See the flag and capital hints, pick from 4 options. 10 rounds per game, with streak bonus."],
m1_b:["Mulai tebak 10 negara","Start guessing 10 countries"],
m2_t:["Tebak Benua","Guess the Continent"],m2_d:["Negara ditampilkan, kamu tebak benuanya: Asia, Afrika, Eropa, dst.","A country is shown, you guess its continent: Asia, Africa, Europe, and more."],m2_b:["Mulai tebak 10 benua","Start guessing 10 continents"],
m3_t:["Jelajah Peta","Explore the Map"],m3_d:["Klik negara mana pun di peta dunia interaktif 2026 untuk info lengkap.","Click any country on the interactive 2026 world map for full details."],m3_b:["Buka peta dunia","Open the world map"],
qn_title:["Tebak Negara","Guess the Country"],qn_sub:["10 soal • +10 poin benar • bonus beruntun","10 questions • +10 pts per correct answer • streak bonus"],
qn_level:["Tingkat:","Level:"],lv_easy:["Mudah (bendera + ibu kota + benua)","Easy (flag + capital + continent)"],lv_mid:["Sedang (bendera + benua)","Medium (flag + continent)"],lv_hard:["Sulit (bendera saja)","Hard (flag only)"],
qn_ready:["Siap main?","Ready to play?"],qn_ready_p:["Kamu akan diberi bendera + petunjuk. Pilih jawaban yang benar dari 4 opsi.","You get a flag plus hints. Pick the correct answer from 4 options."],
qn_start:["Mulai Game","Start Game"],best:["Skor terbaik:","Best score:"],
w_score:["Skor","Score"],w_streak:["Beruntun","Streak"],w_round:["Soal {r}/{m}","Question {r}/{m}"],
qn_q:["Negara apakah ini?","Which country is this?"],qn_next:["Soal berikutnya →","Next question →"],
w_retry:["Main lagi","Play again"],w_share:["Bagikan","Share"],qn_study:["Belajar dulu","Study first"],
qn_res:["Skor: {s} / {m}","Score: {s} / {m}"],
qn_d_hi:["Luar biasa! Kamu master geografi.","Amazing! You are a geography master."],qn_d_mid:["Bagus! Sedikit lagi sempurna.","Good! Almost perfect."],qn_d_low:["Ayo belajar di menu Negara lalu coba lagi!","Study the Countries menu, then try again!"],
qn_fb_ok:["Benar! Ini {n}.","Correct! This is {n}."],qn_fb_no:["Kurang tepat. Ini {n}.","Not quite. This is {n}."],
qn_fb1:["Ibu kota: {k} • Benua: {b}","Capital: {k} • Continent: {b}"],qn_fb2:["{cur} • Tel: {tel} • Populasi: {pop}","{cur} • Tel: {tel} • Population: {pop}"],
cl_cap:["Ibu kota: ","Capital: "],cl_pop:["Pop: ±{m} jt","Pop: ±{m}M"],cl_cont:["Benua: ","Continent: "],
qb_title:["Tebak Benua","Guess the Continent"],qb_sub:["10 soal • Asia, Afrika, Eropa, Amerika Utara, Amerika Selatan, Oseania","10 questions • Asia, Africa, Europe, North America, South America, Oceania"],
qb_ready:["Seberapa hafal peta benua?","How well do you know the continents?"],qb_ready_p:["Contoh: Jepang ada di Asia. Brasil ada di Amerika Selatan.","Example: Japan is in Asia. Brazil is in South America."],
qb_q:["{n} ada di benua apa?","Which continent is {n} in?"],
qb_fb:["{n} ada di {b}. Ibu kota: {k}.","{n} is in {b}. Capital: {k}."],qb_wrong_pre:["Bukan {c}. ","Not {c}. "],
qb_map:["Lihat peta","View map"],qb_res:["Skor: {s}","Score: {s}"],
qb_d_hi:["Peta benua di luar kepala!","You know the continents by heart!"],qb_d_low:["Ayo jelajahi peta lalu coba lagi!","Explore the map, then try again!"],
ex_title:["Jelajah Peta Dunia 2026","Explore the 2026 World Map"],ex_desc:["Klik negara mana pun untuk info lengkap: pemimpin, ibu kota, mata uang, kode telepon dan populasi.","Click any country for full details: leader, capital, currency, dial code, and population."],
ex_search_ph:["Cari negara… mis. Jepang, Brasil, Mesir","Search countries… e.g. Japan, Brazil, Egypt"],
ex_credit:["Basemap: Esri World Street Map / OpenStreetMap (gratis, tanpa API key) • Batas: Natural Earth (2026) • Data pemimpin per 2026, bisa berubah.","Basemap: Esri World Street Map / OpenStreetMap (free, no API key) • Borders: Natural Earth (2026) • Leader data as of 2026, may change."],
ex_empty_t:["Klik negara di peta","Click a country on the map"],ex_empty_p:["Atau cari lewat kolom di atas. Info lengkap akan muncul di sini.","Or search above. Full details will appear here."],
li_title:["Semua Negara","All Countries"],li_search_ph:["Cari negara / ibu kota…","Search country / capital…"],
f_all:["Semua benua","All continents"],f_Asia:["Asia","Asia"],f_Afrika:["Afrika","Africa"],f_Eropa:["Eropa","Europe"],"f_Amerika Utara":["Amerika Utara","North America"],"f_Amerika Selatan":["Amerika Selatan","South America"],f_Oseania:["Oseania","Oceania"],
li_count:["negara • data 2026 • semua berbahasa Indonesia","countries • 2026 data"],li_empty:["Tidak ketemu. Coba kata kunci lain.","No match. Try another keyword."],
m_close:["Tutup","Close"],
in_cap:["Ibu kota","Capital"],in_cur:["Mata uang","Currency"],in_tel:["Kode telepon","Dial code"],in_lang:["Bahasa","Languages"],in_pop:["Populasi","Population"],in_area:["Luas","Area"],
in_pop_u:["jiwa","people"],in_nodata:["Data tidak tersedia","Not available"],in_noleader:["Belum ada data","No data"],
feat_sub:["{b} • Ibu kota: {k}","{b} • Capital: {k}"],
data_ok:["{n} negara + bendera dimuat dari data lokal 2026. Siap main!","{n} countries + flags loaded from 2026 local data. Ready to play!"],
data_fail:["countries.json tidak terbaca (buka via http://localhost:8000, jangan double-click file). Memakai data darurat.","countries.json is unreadable (open via http://localhost:8000, not by double-clicking the file). Using emergency data."],
ms_tiles:["Memuat ubin peta (Esri, gratis tanpa kunci)…","Loading map tiles (Esri, free, no key)…"],
ms_tiles_ok:["Ubin peta OK. Memuat batas 250 negara…","Map tiles OK. Loading 250 country borders…"],
ms_switched:["Sumber {a} gagal, beralih ke {b}…","{a} failed, switching to {b}…"],
ms_allfail:["Semua sumber ubin peta gagal dimuat. Periksa koneksi internet.","All map tile sources failed. Check your connection."],
ms_ready:["Peta siap: {f} wilayah digambar, {c} cocok dengan database 250 negara. Klik negara mana pun.","Map ready: {f} areas drawn, {c} matched to the 250-country database. Click any country."],
ms_geofail:["Gagal memuat batas negara (butuh internet ke raw.githubusercontent.com). Ubin peta tetap bisa dipakai.","Country borders failed to load (needs internet to raw.githubusercontent.com). Map tiles still work."],
ms_chosen:["Kamu memilih {n}. Lihat panel di samping untuk detailnya.","You picked {n}. See the side panel for details."],
ms_nomatch_map:["{n} tidak ada di database 250 negara.","{n} is not in the 250-country database."],
ms_found:["Ditemukan: {n}. Lihat detailnya di panel.","Found: {n}. See details in the panel."],
ms_nofind:['Tidak ada negara bernama "{q}".','No country named "{q}".'],
ms_nomatch_search:["Tidak ada negara yang cocok.","No matching country."],
filewarn:['Halaman ini dibuka sebagai file langsung, jadi peta, ikon, dan data 250 negara tidak bisa dimuat. Jalankan <b>python -m http.server 8000</b> di folder ini lalu buka <b>http://localhost:8000</b>.','This page was opened directly as a file, so the map, icons, and 250-country data cannot load. Run <b>python -m http.server 8000</b> in this folder, then open <b>http://localhost:8000</b>.'],
share_negara:["LearnGeo: aku dapat skor {s} di Tebak Negara! Berani lawan?","LearnGeo: I scored {s} in Guess the Country! Beat me if you can?"],
share_benua:["LearnGeo: aku dapat skor {s} di Tebak Benua! Berani lawan?","LearnGeo: I scored {s} in Guess the Continent! Beat me if you can?"],
share_ok:["Skor disalin! Tempel ke WA / IG","Score copied! Paste it to WA / IG"],share_prompt:["Salin skormu:","Copy your score:"],
ft:["<b>LearnGeo by Alva</b> - dibuat untuk edukasi.","<b>LearnGeo by Alva</b> - made for education."],
totop:["Kembali ke atas","Back to top"],snd:["Suara on/off","Sound on/off"],
w_correct:["Benar!","Correct!"]
};
const t=(k,v)=>{ let s=(T[k]?T[k][LANG==="en"?1:0]:k); if(v) for(const key in v) s=String(s).replace("{"+key+"}",v[key]); return s; };
const BENUA_EN={"Asia":"Asia","Afrika":"Africa","Eropa":"Europe","Amerika Utara":"North America","Amerika Selatan":"South America","Oseania":"Oceania","Antarktika":"Antarctica"};
const ROLES_EN={"Presiden":"President","Raja":"King","Ratu":"Queen","Perdana Menteri":"Prime Minister","Paus":"Pope","Emir":"Emir","Sultan":"Sultan","Pemimpin":"Leader","Gubernur (Belanda)":"Governor (Netherlands)","Raja (Belanda)":"King (Netherlands)","Presiden (transisi)":"Transitional President","Penasihat Kepala (interim)":"Chief Adviser (interim)","Emir (de facto)":"Emir (de facto)","Dewan Federal":"Federal Council","Presidensi Kolektif":"Collective Presidency","Presidensi kolektif bergilir":"Rotating collective presidency","Wali Kapten":"Captains Regent","Dua wali (bergilir)":"Two Captains Regent (rotating)","Kepala Eksekutif":"Chief Executive","Ketua (militer)":"Chairman (military)","Ketua (transisi)":"Chairman (transitional)","Kepala Negara":"Head of State","Pemimpin Tertinggi":"Supreme Leader","Adipati Agung":"Grand Duke","Pangeran":"Prince","Pangeran (Prancis & Uskup)":"Co-Prince (France & Bishop)","Presiden (terpecah)":"Disputed President","Presiden (sengketa)":"Disputed President"};
const LANGS_EN={"Inggris":"English","Prancis":"French","Spanyol":"Spanish","Arab":"Arabic","Portugis":"Portuguese","Jerman":"German","Rusia":"Russian","Mandarin":"Mandarin","Jepang":"Japanese","Korea":"Korean","Hindi":"Hindi","Indonesia":"Indonesian","Melayu":"Malay","Belanda":"Dutch","Italia":"Italian","Turki":"Turkish","Urdu":"Urdu","Bengali":"Bengali","Persia":"Persian","Thai":"Thai","Vietnam":"Vietnamese","Filipino":"Filipino","Swahili":"Swahili","Yunani":"Greek","Polandia":"Polish","Ukraina":"Ukrainian","Swedia":"Swedish","Norwegia":"Norwegian","Denmark":"Danish","Finlandia":"Finnish","Ibrani":"Hebrew","Hongaria":"Hungarian","Ceko":"Czech","Rumania":"Romanian","Bulgaria":"Bulgarian","Serbia":"Serbian","Kroasia":"Croatian","Slovakia":"Slovak","Slovenia":"Slovenian","Katalan":"Catalan","Tamil":"Tamil","Telugu":"Telugu","Marathi":"Marathi","Gujarati":"Gujarati","Punjabi":"Punjabi","Malayalam":"Malayalam","Kannada":"Kannada","Myanmar":"Burmese","Khmer":"Khmer","Laos":"Lao","Mongolia":"Mongolian","Kazakh":"Kazakh","Uzbek":"Uzbek","Kirgistan":"Kyrgyz","Tajik":"Tajik","Turkmen":"Turkmen","Azerbaijan":"Azerbaijani","Armenia":"Armenian","Georgia":"Georgian","Amharik":"Amharic","Somalia":"Somali","Yoruba":"Yoruba","Igbo":"Igbo","Hausa":"Hausa","Zulu":"Zulu","Xhosa":"Xhosa","Afrikaans":"Afrikaans","Nepali":"Nepali","Sinhala":"Sinhala","Dhivehi":"Dhivehi","Dzongkha":"Dzongkha","Pashto":"Pashto","Dari":"Dari","Kurdi":"Kurdish","Malta":"Maltese","Islandia":"Icelandic","Irlandia":"Irish","Welsh":"Welsh","Basque":"Basque","Galisia":"Galician","Luksemburg":"Luxembourgish","Estonia":"Estonian","Latvia":"Latvian","Lituania":"Lithuanian","Belarus":"Belarusian","Moldova":"Moldovan","Makedonia":"Macedonian","Albania":"Albanian","Bosnia":"Bosnian","Montenegro":"Montenegrin","Faroe":"Faroese","Manx":"Manx","Samoa":"Samoan","Tonga":"Tongan","Fiji":"Fijian","Maori":"Maori","Hawaii":"Hawaiian","Chamorro":"Chamorro","Carolina":"Carolinian","Marshall":"Marshallese","Nauru":"Nauruan","Palau":"Palauan","Tokelau":"Tokelauan","Tuvalu":"Tuvaluan","Bislama":"Bislama","Tetum":"Tetum","Swati":"Swati","Sotho":"Sotho","Tswana":"Tswana","Shona":"Shona","Ndebele":"Ndebele","Venda":"Venda","Tsonga":"Tsonga","Malagasi":"Malagasy","Komoro":"Comorian","Kreol Seychelles":"Seychellois Creole","Kreol Mauritius":"Mauritian Creole","Papiamento":"Papiamento","Guarani":"Guaraní","Quechua":"Quechua","Aymara":"Aymara","Greenland":"Greenlandic","Kirundi":"Kirundi","Rwanda":"Kinyarwanda","Lingala":"Lingala","Tshiluba":"Tshiluba","Sango":"Sango"};
const cname=c=>LANG==="en"?c.name_en:c.name_id;
const cbenua=c=>LANG==="en"?(BENUA_EN[c.continent]||c.continent):c.continent;
const langName=l=>LANG==="en"?(LANGS_EN[l]||l):l;
const roleName=r=>LANG==="en"?(ROLES_EN[r]||r):r;
function paintLangBtn(){
  $("btnLang").textContent=LANG==="id"?"EN":"ID";
  $("btnLang").title=LANG==="id"?"Ganti ke English":"Switch to Indonesian";
  $("btnSound").title=t("snd"); $("toTop").title=t("totop");
}
function applyLang(){
  document.documentElement.lang=LANG;
  document.querySelectorAll("[data-t]").forEach(el=>{el.textContent=t(el.dataset.t);});
  document.querySelectorAll("[data-t-html]").forEach(el=>{el.innerHTML=t(el.dataset.tHtml);});
  document.querySelectorAll("[data-t-ph]").forEach(el=>{el.placeholder=t(el.dataset.tPh);});
  paintLangBtn(); paintLegend(); refreshCounts();
  if(!$("modalBackdrop").classList.contains("hidden")&&state.modalC){
    const c=state.countries.find(x=>x.cca3===state.modalC); if(c) openModal(c);
  } else if(!$("infoContent").classList.contains("hidden")&&state.lastC){
    const c=state.countries.find(x=>x.cca3===state.lastC); if(c) showPanel(c);
  }
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
  if(!state.counted && state.countries.length>12){ state.counted=true; countUp($("statTotal"), state.countries.length); }
  else $("statTotal").textContent = state.countries.length;
  $("dataStatus").textContent = state.live
    ? "✓ "+t("data_ok",{n:state.countries.length})
    : "! "+t("data_fail");
  $("daftarCount").textContent = `${state.countries.length} ${t("li_count")}`;
  paintFeatured();
  renderList();
  buildMarquee();
}
function countUp(el, target){
  if(!el) return;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){ el.textContent=target; return; }
  const t0=performance.now(), dur=900;
  (function step(now){
    const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
    el.textContent=Math.round(target*e);
    if(p<1) requestAnimationFrame(step);
  })(t0);
}
function buildMarquee(){
  const box=$("flagStrip"); if(!box||!state.countries.length) return;
  const picks=shuffle(state.countries.filter(c=>c.population>2000000)).slice(0,36);
  const html=picks.map(c=>`<img src="${flagSvg(c)}" alt="${cname(c)}" title="${cname(c)}" loading="lazy" onerror="this.remove()">`).join("");
  box.innerHTML=html+html;
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
  $("qnRound").textContent=t("w_round",{r:q.round,m:TOTAL_ROUNDS});
  $("qnBar").style.width=((q.round-1)/TOTAL_ROUNDS*100)+"%";
  $("qnScore").textContent=q.score; $("qnStreak").textContent=q.streak;
  const clues=[];
  if(level==="mudah"){ clues.push(t("cl_cap")+c.capital, cbenua(c), t("cl_pop",{m:fmtID(Math.round(c.population/1e6))})); }
  else if(level==="sedang"){ clues.push(t("cl_cont")+cbenua(c)); }
  $("qnClues").innerHTML=clues.map(t=>`<span class="chip">${t}</span>`).join("");
  $("qnFlag").innerHTML = flagImg(c, 160, "flag-quiz");
  $("qnFeedback").className="feedback hidden"; $("qnFeedback").innerHTML="";
  $("qnNext").classList.add("hidden");
  const box=$("qnOptions"); box.innerHTML="";
  opts.forEach(o=>{
    const b=document.createElement("button"); b.className="opt"; b.textContent=cname(o);
    b.dataset.ok=o.cca3===c.cca3?"1":"0";
    b.onclick=()=>answerQn(b,o); box.appendChild(b);
  });
}
function answerQn(btn, chosen){
  const q=state.qn; if(q.lock) return; q.lock=true;
  const c=q.current, ok = chosen.cca3===c.cca3;
  document.querySelectorAll("#qnOptions .opt").forEach(b=>{
    b.disabled=true;
    if(b.dataset.ok==="1") b.classList.add("correct");
    else if(b===btn && !ok) b.classList.add("wrong");
  });
  if(ok){ q.streak++; const pts=10+(q.streak>=3?2*(q.streak-2):0); q.score+=pts; q.hist.push({n:c.name_id,ok:true,pts,c2:c.cca2,f:c.flagEmoji}); Snd.ok(); }
  else { q.streak=0; q.hist.push({n:c.name_id,ok:false,c2:c.cca2,f:c.flagEmoji}); Snd.no(); }
  $("qnScore").textContent=q.score; $("qnStreak").textContent=q.streak;
  $("qnBar").style.width=(q.round/TOTAL_ROUNDS*100)+"%";
  const f=$("qnFeedback");
  f.className="feedback "+(ok?"ok":"no");
  f.innerHTML=(ok?"✅ ":"❌ ")+(ok?t("qn_fb_ok",{n:`<b>${cname(c)}</b>`}):t("qn_fb_no",{n:`<b>${cname(c)}</b>`}))
    +`<br>${t("qn_fb1",{k:`<b>${c.capital}</b>`,b:`<b>${cbenua(c)}</b>`})}<br>${t("qn_fb2",{cur:`${c.currency.code} (${c.currency.name} ${c.currency.symbol})`,tel:c.phone,pop:c.population?fmtID(c.population):t("in_nodata")})}`;
  $("qnNext").classList.remove("hidden");
}
function endQn(){
  const q=state.qn;
  $("qnPlay").classList.add("hidden"); $("qnResult").classList.remove("hidden");
  const best=Math.max(q.score, +localStorage.getItem("lg_best_negara")||0);
  localStorage.setItem("lg_best_negara",best);
  $("statBestNegara").textContent=best; $("bestNegaraTxt").textContent=best;
  resultIcon("qnResultEmoji", q.score, 80, 50);
  $("qnResultTitle").textContent=t("qn_res",{s:q.score,m:TOTAL_ROUNDS*10+20});
  $("qnResultDesc").textContent = q.score>=80?t("qn_d_hi"):q.score>=50?t("qn_d_mid"):t("qn_d_low");
  $("qnSummary").innerHTML=sumRows(q.hist||[]);
  if(q.score>=80){ confetti(); Snd.win(); }
}
$("btnStartNegara").onclick=()=>{ Snd.click(); startNegara(); };
$("btnRetryNegara").onclick=()=>{ Snd.click(); startNegara(); };
$("qnNext").onclick=()=>{ Snd.click(); nextQn(); };
$("btnShareNegara").onclick=()=>shareScore(t("share_negara",{s:state.qn.score}));

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
  $("qbRound").textContent=t("w_round",{r:q.round,m:TOTAL_ROUNDS});
  $("qbBar").style.width=((q.round-1)/TOTAL_ROUNDS*100)+"%";
  $("qbScore").textContent=q.score; $("qbStreak").textContent=q.streak;
  $("qbFlag").innerHTML = flagImg(c, 160, "flag-quiz");
  $("qbName").textContent=t("qb_q",{n:cname(c)});
  $("qbFeedback").className="feedback hidden"; $("qbFeedback").innerHTML="";
  $("qbNext").classList.add("hidden");
  const box=$("qbOptions"); box.innerHTML="";
  shuffle(BENUA_LIST).forEach(bn=>{
    const b=document.createElement("button"); b.className="opt";
    b.textContent=LANG==="en"?(BENUA_EN[bn]||bn):bn; b.dataset.v=bn;
    b.onclick=()=>answerQb(b,bn); box.appendChild(b);
  });
}
function answerQb(btn, chosen){
  const q=state.qb; if(q.lock) return; q.lock=true;
  const c=q.current, ok=chosen===c.continent;
  document.querySelectorAll("#qbOptions .opt").forEach(b=>{
    b.disabled=true;
    if(b.dataset.v===c.continent) b.classList.add("correct");
    else if(b===btn&&!ok) b.classList.add("wrong");
  });
  if(ok){ q.streak++; q.score+=10+(q.streak>=3?2*(q.streak-2):0); q.hist.push({n:c.name_id,ok:true,c2:c.cca2,f:c.flagEmoji}); Snd.ok(); }
  else { q.streak=0; q.hist.push({n:c.name_id,ok:false,c2:c.cca2,f:c.flagEmoji}); Snd.no(); }
  $("qbScore").textContent=q.score; $("qbStreak").textContent=q.streak;
  $("qbBar").style.width=(q.round/TOTAL_ROUNDS*100)+"%";
  const f=$("qbFeedback");
  f.className="feedback "+(ok?"ok":"no");
  const disp=LANG==="en"?(BENUA_EN[chosen]||chosen):chosen;
  f.innerHTML=(ok?"✅ "+t("w_correct")+" ":("❌ "+t("qb_wrong_pre",{c:disp})))+t("qb_fb",{n:`<b>${cname(c)}</b>`,b:`<b>${cbenua(c)}</b>`,k:c.capital});
  $("qbNext").classList.remove("hidden");
}
function endQb(){
  const q=state.qb;
  $("qbPlay").classList.add("hidden"); $("qbResult").classList.remove("hidden");
  const best=Math.max(q.score,+localStorage.getItem("lg_best_benua")||0);
  localStorage.setItem("lg_best_benua",best);
  $("statBestBenua").textContent=best; $("bestBenuaTxt").textContent=best;
  resultIcon("qbResultEmoji", q.score, 80, 50);
  $("qbResultTitle").textContent=t("qb_res",{s:q.score});
  $("qbResultDesc").textContent=q.score>=80?t("qb_d_hi"):t("qb_d_low");
  $("qbSummary").innerHTML=sumRows(q.hist||[]);
  if(q.score>=80){ confetti(); Snd.win(); }
}
$("btnStartBenua").onclick=()=>{ Snd.click(); startBenua(); };
$("btnRetryBenua").onclick=()=>{ Snd.click(); startBenua(); };
$("qbNext").onclick=()=>{ Snd.click(); nextQb(); };
$("btnShareBenua").onclick=()=>shareScore(t("share_benua",{s:state.qb.score}));

/* ---------- INFO HTML ---------- */
function leaderOf(c){
  const L = state.leaders[c.cca3];
  if(L && L[1]) return {role:L[0]||"Pemimpin", name:L[1]};
  return {role:"Pemimpin", name:t("in_noleader")};
}
function infoHTML(c, withClose){
  const ld = leaderOf(c);
  const bc = BENUA_COLORS[c.continent]||"#64748b";
  const sub = LANG==="en" ? `${c.name_id} • ${cbenua(c)}` : `${c.name_en} • ${cbenua(c)}`;
  return `
  <div class="m-hero" style="background:${bc}1f">
    <div class="m-flag">${flagImg(c, 160, "flag-modal")}</div>
    <div class="m-title">
      <h3>${cname(c)}</h3>
      <p class="muted">${sub}</p>
      <div class="chip-row" style="margin:.35rem 0 0">
        <span class="chip">${c.phone}</span><span class="chip">${c.currency.code}</span><span class="chip">${cbenua(c)}</span>
      </div>
    </div>
    ${withClose?`<button class="x" onclick="modalClose()" title="${t("m_close")}">${U("i-x-mark")}</button>`:""}
  </div>
  <dl class="kv">
    <dt>${U("i-identification")} ${roleName(ld.role)}</dt><dd>${ld.name}</dd>
    <dt>${U("i-building-office-2")} ${t("in_cap")}</dt><dd>${c.capital}</dd>
    <dt>${U("i-banknotes")} ${t("in_cur")}</dt><dd>${c.currency.code} • ${c.currency.name} ${c.currency.symbol}</dd>
    <dt>${U("i-phone")} ${t("in_tel")}</dt><dd>${c.phone}</dd>
    <dt>${U("i-language")} ${t("in_lang")}</dt><dd>${c.languages.map(langName).join(", ")}</dd>
    <dt>${U("i-users")} ${t("in_pop")}</dt><dd>${c.population?fmtID(c.population)+" "+t("in_pop_u"):t("in_nodata")}</dd>
    <dt>${U("i-arrows-pointing-out")} ${t("in_area")}</dt><dd>${fmtID(Math.round(c.area))} km²</dd>
  </dl>
  <div class="row-btns">
    <button class="btn ghost" onclick="modalClose()">${t("m_close")}</button>
  </div>`;
}
function showPanel(c){
  state.lastC=c.cca3;
  $("infoEmpty").classList.add("hidden");
  const box=$("infoContent"); box.classList.remove("hidden");
  box.innerHTML=infoHTML(c, false);
}
window.modalClose=()=>{ state.modalC=null; $("modalBackdrop").classList.add("hidden"); };
$("modalBackdrop").addEventListener("click",e=>{ if(e.target.id==="modalBackdrop") window.modalClose(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") window.modalClose(); });
function openModal(c){ state.modalC=c.cca3; $("modalCard").innerHTML=infoHTML(c, true); $("modalBackdrop").classList.remove("hidden"); }

/* ---------- DAFTAR NEGARA ---------- */
function renderList(){
  const q=($("listSearch").value||"").toLowerCase(), f=$("filterBenua").value;
  const grid=$("countryGrid"); grid.innerHTML="";
  const rows=state.countries.filter(c=>
    (!f||c.continent===f)&&(!q||c.name_id.toLowerCase().includes(q)||c.name_en.toLowerCase().includes(q)||(c.capital||"").toLowerCase().includes(q)));
  rows.slice(0,300).forEach(c=>{
    const b=document.createElement("button"); b.className="country-card";
    b.innerHTML=`${flagImg(c, 80, "flag-card")}<span class="cc-text"><strong>${cname(c)}</strong><small>${cbenua(c)} • ${c.capital}</small></span>`;
    b.onclick=()=>openModal(c);
    grid.appendChild(b);
  });
  if(!rows.length) grid.innerHTML=`<p class="muted">${t("li_empty")}</p>`;
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
  box.innerHTML=order.map(b=>`<span class="lg-item"><i style="background:${BENUA_COLORS[b]}"></i>${LANG==="en"?(BENUA_EN[b]||b):b}</span>`).join("");
}
function mapStatus(t){ const el=$("mapStatus"); if(el) el.textContent=t; }
async function initMap(){
  if(state.mapInit){ setTimeout(()=>state.map&&state.map.invalidateSize(),200); return; }
  state.mapInit=true;
  mapStatus(t("ms_tiles"));
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
      mapStatus(t("ms_switched",{a:gagal,b:TILE_SETS[tileIdx].name}));
    } else if(tileErr>24){
      mapStatus(t("ms_allfail"));
    }
  });
  tiles.on("load",()=>mapStatus(t("ms_tiles_ok")));
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
              if(c){ showPanel(c); mapStatus(t("ms_chosen",{n:cname(c)})); }
              else{
                $("infoEmpty").classList.add("hidden");
                $("infoContent").classList.remove("hidden");
                $("infoContent").innerHTML=`<h3>${nm||iso||"Wilayah"}</h3><p class="muted">Data info belum tersedia untuk kode ${iso}. Coba negara lain, atau cari lewat kolom pencarian.</p>`;
                mapStatus(t("ms_nomatch_map",{n:nm||iso||"Wilayah"}));
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
    mapStatus(t("ms_geofail"));
  } else {
    mapStatus(t("ms_ready",{f:features,c:foundCountries}));
  }
  // search peta
  let mapSearchTimer=null;
  $("mapSearch").addEventListener("input",()=>{
    clearTimeout(mapSearchTimer);
    mapSearchTimer=setTimeout(()=>{
      const q=$("mapSearch").value.toLowerCase().trim(); if(!q) return;
      const c=state.countries.find(x=>x.name_id.toLowerCase().includes(q)||x.name_en.toLowerCase().includes(q));
      if(c){ showPanel(c); if(c.latlng) map.flyTo(c.latlng,4,{duration:1.2}); mapStatus(t("ms_found",{n:cname(c)})); }
      else mapStatus(t("ms_nofind",{q}));
    },350);
  });
}

/* ---------- Negara sorotan (hero, acak) ---------- */
function paintFeatured(){
  const pool=state.countries.filter(c=>c.population>500000 && c.continent!=="Antarktika");
  const c=pick(pool.length?pool:state.countries);
  if(!c||!$("featFlag")) return;
  $("featFlag").innerHTML=flagImg(c,160,"flag-quiz");
  $("featName").textContent=cname(c);
  $("featSub").textContent=t("feat_sub",{b:cbenua(c),k:c.capital});
  $("featChips").innerHTML=[
    `${c.currency.code}${c.currency.symbol?" ("+c.currency.symbol+")":""}`,
    `${c.phone}`,
    `${langName(c.languages[0]||"-")}`
  ].map(x=>`<span class="chip">${x}</span>`).join("");
}

/* ---------- init ---------- */
if(location.protocol==="file:"){
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="filewarn">${t("filewarn")}</div>`);
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
$("btnLang").onclick=()=>{
  Snd.click();
  LANG=LANG==="id"?"en":"id";
  localStorage.setItem("lg_lang",LANG);
  applyLang();
};
$("btnShuffleFeat").onclick=()=>{ Snd.click(); paintFeatured(); };
/* Back-to-top: muncul setelah scroll jauh */
const toTop=$("toTop");
addEventListener("scroll",()=>{ toTop.classList.toggle("hidden",scrollY<600); },{passive:true});
toTop.onclick=()=>{ Snd.click(); scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}); };
/* Reveal-on-scroll untuk blok beranda (sekali, lalu dilepas) */
try{
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }),{threshold:.1});
  document.querySelectorAll(".hero-text,.hero-card,.mode-card,.stat,.section-title,.marquee").forEach(el=>{ el.classList.add("rv"); io.observe(el); });
}catch(e){}
applyLang();
loadCountries();
