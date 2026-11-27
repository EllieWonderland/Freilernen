"use strict";

/* Fächer: alle sieben Fächer haben Themen. */
const FAECHER = [
  { id: "mathe", name: "Mathe", sym: "🔢", farbe: "#3b7dd8", datei: "data/mathe.json" },
  { id: "deutsch", name: "Deutsch", sym: "📖", farbe: "#d0533f", datei: "data/deutsch.json" },
  { id: "englisch", name: "Englisch", sym: "🇬🇧", farbe: "#7a5bd6", datei: "data/englisch.json" },
  { id: "spanisch", name: "Spanisch", sym: "🇪🇸", farbe: "#e2a316", datei: "data/spanisch.json" },
  { id: "nawi", name: "NaWi", sym: "🔬", farbe: "#2e9e5b", datei: "data/nawi.json" },
  { id: "gl", name: "Gesellschaftslehre", sym: "🌍", farbe: "#2a9bb0", datei: "data/gewi.json" },
  { id: "musik", name: "Musik", sym: "🎵", farbe: "#c2508f", datei: "data/musik.json" }
];

const STORE_KEY = "freilernen-v1";
const app = document.getElementById("app");
const sheet = document.getElementById("sheet");
const backdrop = document.getElementById("sheet-backdrop");
const daten = {}; // fachId -> { ...json, byId, dependents }

/* ---------- Speicher ---------- */
function ladeState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
  s = s && typeof s === "object" ? s : {};
  s.done = s.done || {};
  s.week = s.week || { key: "", count: 0 };
  s.filter = s.filter || { stand: "alle", klasse: "alle", art: "alle" };
  s.merk = s.merk || {};       // themaId -> fachId
  s.notizen = s.notizen || {}; // themaId -> { fach, text, fotos: [fotoId], datum }
  return s;
}
let state = ladeState();
function speichern() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* privat oder voll */ }
}

/* ---------- Fotos (IndexedDB, damit der normale Speicher nicht vollläuft) ---------- */
let fotoDbPromise = null;
function fotoDB() {
  if (!fotoDbPromise) fotoDbPromise = new Promise((res, rej) => {
    const r = indexedDB.open("freilernen-fotos", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("fotos");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return fotoDbPromise;
}
async function fotoOp(modus, fn) {
  const db = await fotoDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("fotos", modus);
    const req = fn(tx.objectStore("fotos"));
    tx.oncomplete = () => res(req ? req.result : undefined);
    tx.onerror = () => rej(tx.error);
  });
}
const fotoSpeichern = (id, data) => fotoOp("readwrite", s => s.put(data, id));
const fotoLaden = id => fotoOp("readonly", s => s.get(id)).catch(() => null);
const fotoLoeschen = id => fotoOp("readwrite", s => s.delete(id)).catch(() => {});
function bildVerkleinern(datei) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(datei);
    img.onload = () => {
      const f = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Bild")); };
    img.src = url;
  });
}

/* ---------- Datum ---------- */
const datumText = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const heute = () => datumText(new Date());
function wochenStart() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return datumText(d);
}
const schoenesDatum = s => { const [j, m, t] = s.split("-"); return `${Number(t)}.${Number(m)}.${j}`; };
const fertigDatum = id => typeof state.done[id] === "string" ? state.done[id] : null;
function abhaken(t) {
  state.done[t.id] = heute();
  delete state.merk[t.id];
}

/* ---------- Woche (beginnt montags) ---------- */
function wochenKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - tag);
  const jahrStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const nr = Math.ceil(((t - jahrStart) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + "-W" + String(nr).padStart(2, "0");
}
function stempel() {
  const k = wochenKey();
  if (state.week.key !== k) { state.week = { key: k, count: 0 }; speichern(); }
  return state.week.count;
}

/* ---------- Daten ---------- */
async function ladeFach(id) {
  if (daten[id]) return daten[id];
  const f = FAECHER.find(x => x.id === id);
  if (!f || !f.datei) return null;
  const res = await fetch(f.datei);
  const json = await res.json();
  const byId = {};
  const dependents = {};
  json.themen.forEach(t => { byId[t.id] = t; dependents[t.id] = []; t.fach = id; });
  json.themen.forEach(t => t.baut_auf.forEach(p => { if (dependents[p]) dependents[p].push(t.id); }));
  const stufen = {};
  const stufe = (tid, seen = new Set()) => {
    if (stufen[tid]) return stufen[tid];
    if (seen.has(tid)) return 1;
    seen.add(tid);
    const t = byId[tid];
    const s = t.baut_auf.length ? 1 + Math.max(...t.baut_auf.map(p => stufe(p, seen))) : 1;
    stufen[tid] = s;
    return s;
  };
  json.themen.forEach(t => { t.stufe = stufe(t.id); t.einzel = !t.baut_auf.length && !dependents[t.id].length; });
  daten[id] = Object.assign(json, { byId, dependents, meta: f });
  return daten[id];
}

/* ---------- Helfer ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const istFertig = id => !!state.done[id];
const offeneVorstufen = (fach, t) => t.baut_auf.filter(p => !istFertig(p)).map(p => fach.byId[p]);

function marker(fach, t, gross = false) {
  const fertig = istFertig(t.id);
  const tick = fertig ? '<span class="tick" aria-hidden="true">✓</span>' : "";
  const cls = gross ? " big" : "";
  if (!t.baut_auf.length) {
    const farbe = fertig ? "green" : "orange";
    const label = fertig ? "geschafft" : "noch nicht bearbeitet";
    return `<span class="mk dot ${farbe}${cls}" role="img" aria-label="${label}">${fertig ? "✓" : ""}</span>`;
  }
  let farbe = "blue", label = `Stufe ${t.stufe}, Vorstufen noch offen`;
  if (fertig) { farbe = "green"; label = `Stufe ${t.stufe}, geschafft`; }
  else if (!offeneVorstufen(fach, t).length) { farbe = "orange"; label = `Stufe ${t.stufe}, bereit`; }
  return `<span class="mk ${farbe}${cls}" role="img" aria-label="${esc(label)}">${t.stufe}${tick}</span>`;
}
const klasseText = k => k === "ab 7" ? "oft ab Klasse 7" : `oft in Klasse ${k}`;

// Kanäle für die Suchlinks, wenn ein Thema noch keine fest ausgewählten Videos hat
const SUCHKANAELE = {
  standard: ["Lehrerschmidt", "einfach Schule", "Die Merkhilfe"],
  englisch: ["Einfach Englisch", "BBC Learning English", "Mr Kay Erklärt Englisch"],
  spanisch: ["Rockalingua", "BASHO & FRIENDS", "Die Merkhilfe Spanisch"],
  musik: ["MusikDurchblick", "Musiklehrer", "erklaerung-und-mehr"],
  nawi: ["Lehrerschmidt", "Woozle Goozle", "SRF Kids"],
  gl: ["SRF Kids", "Woozle Goozle", "CHECKER WELT"]
};

function videoLinks(t) {
  // Bevorzugt fest ausgewählte Videos; Suchlinks nur, wenn ein Thema noch keine hat
  if (t.videos && t.videos.length) {
    return t.videos.map(v => ({ titel: v.titel, kanal: v.kanal, url: v.url.replace(/^https:\/\/(www\.|m\.)?youtube\.com\/watch/, "https://www.yout-ube.com/watch") }));
  }
  const q = encodeURIComponent;
  const kanaele = SUCHKANAELE[t.fach] || SUCHKANAELE.standard;
  return kanaele.map(k => ({ titel: `Suche bei ${k}`, url: `https://www.youtube.com/results?search_query=${q(k + " " + t.suche)}` }));
}

/* ---------- Sheet ---------- */
function zeigeSheet(html) {
  sheet.innerHTML = html;
  sheet.hidden = false;
  backdrop.hidden = false;
  const b = sheet.querySelector("button, a");
  if (b) b.focus();
}
function schliesseSheet() { sheet.hidden = true; backdrop.hidden = true; sheet.innerHTML = ""; }
backdrop.addEventListener("click", schliesseSheet);
sheet.addEventListener("click", e => {
  if (e.target.closest("[data-close]") || e.target.closest("a")) schliesseSheet();
});

function vorstufenHinweis(fach, themen) {
  // themen: Liste frisch abgehakter Themen; zeigt offene Vorstufen als Vorschlag
  const offen = new Map();
  themen.forEach(t => offeneVorstufen(fach, t).forEach(v => offen.set(v.id, v)));
  if (!offen.size) return;
  const items = [...offen.values()].map(v =>
    `<a class="topic" href="#/thema/${fach.fach}/${v.id}">${marker(fach, v)}<span class="txt"><span class="t">${esc(v.titel)}</span><br><span class="s">${esc(v.satz)}</span></span></a>`
  ).join("");
  zeigeSheet(`
    <h2>Super, abgehakt!</h2>
    <p>Dazu gehören noch Vorstufen, die offen sind. Schau doch mal kurz rein, vielleicht kannst du sie auch schon:</p>
    <div style="margin:12px 0">${items}</div>
    <button class="secondary" data-close>Später</button>`);
}

/* ---------- Seiten ---------- */
function seiteStart() {
  const n = stempel();
  const kreise = Array.from({ length: 5 }, (_, i) =>
    `<button class="stamp${i < n ? " on" : ""}" data-stamp="${i}" aria-label="Stempel ${i + 1}${i < n ? ", gesetzt" : ""}">${i < n ? "★" : ""}</button>`
  ).join("");
  const text = n >= 5 ? "Wochenziel geschafft!" : n === 0 ? "Tippe auf einen Kreis, wenn du etwas gelernt hast." : `${n} von 5 Stempeln diese Woche`;
  const tiles = FAECHER.map(f => f.datei
    ? `<a class="tile" style="--c:${f.farbe}" href="#/fach/${f.id}"><span class="sym">${f.sym}</span><span class="name">${esc(f.name)}</span></a>`
    : `<div class="tile soon" style="--c:${f.farbe}" aria-disabled="true"><span class="sym">${f.sym}</span><span><span class="name">${esc(f.name)}</span><br><span class="muted">kommt bald</span></span></div>`
  ).join("") + `<a class="tile finden" href="#/finden"><span class="sym">🎲</span><span class="name">Thema finden</span></a>`;
  app.innerHTML = `
    <div class="topbar"><h1>Freilernen</h1><a class="iconbtn" href="#/einstellungen" aria-label="Einstellungen">⚙︎</a></div>
    <section class="card week">
      <h2>Mein Wochenziel</h2>
      <div class="stamps">${kreise}</div>
      <p class="muted">${text}</p>
    </section>
    <div class="tiles">${tiles}</div>
    <div id="merkliste"></div>
    <a class="tagebuch-link" href="#/tagebuch">📔 <span><strong>Mein Lerntagebuch</strong><br><span class="muted">Notizen, Fotos und was du geschafft hast</span></span></a>`;
  app.querySelectorAll("[data-stamp]").forEach(b => b.addEventListener("click", () => {
    const i = Number(b.dataset.stamp);
    const c = stempel();
    state.week.count = i < c ? i : Math.min(5, c + 1);
    speichern();
    seiteStart();
    if (c < 5 && state.week.count === 5) sicherungsHinweis();
  }));
  zeigeMerkliste();
}

async function zeigeMerkliste() {
  const ids = Object.keys(state.merk).filter(id => !istFertig(id));
  const ziel = document.getElementById("merkliste");
  if (!ids.length || !ziel) return;
  const eintraege = [];
  for (const id of ids) {
    const fach = await ladeFach(state.merk[id]);
    const t = fach && fach.byId[id];
    if (t) eintraege.push(vorschlag({ t, fach }));
  }
  if (!eintraege.length || !document.body.contains(ziel)) return;
  ziel.innerHTML = `<h2>⭐ Meine nächsten Themen</h2>${eintraege.join("")}`;
}

function sicherungsHinweis() {
  zeigeSheet(`
    <h2>⭐ Wochenziel geschafft!</h2>
    <p>Toll gemacht! Sicher jetzt kurz deine Häkchen, Notizen und Fotos. Dann ist nichts weg, falls mit dem Handy mal etwas passiert.</p>
    <p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="primary" id="jetzt-sichern" style="width:auto">Daten sichern</button>
      <button class="secondary" data-close>Später</button>
    </p>`);
  document.getElementById("jetzt-sichern").addEventListener("click", async () => { await datenSichern(); schliesseSheet(); });
}

let mehrfach = false;
let auswahl = new Set();

function passtFilter(t) {
  const f = state.filter;
  if (f.stand === "offen" && istFertig(t.id)) return false;
  if (f.stand === "geschafft" && !istFertig(t.id)) return false;
  if (f.klasse !== "alle") {
    if (f.klasse === "7" && t.klasse !== "ab 7") return false;
    if (f.klasse === "5" && !["5", "5/6"].includes(t.klasse)) return false;
    if (f.klasse === "6" && !["6", "5/6"].includes(t.klasse)) return false;
  }
  if (f.art === "einzel" && !t.einzel) return false;
  if (f.art === "reihe" && t.einzel) return false;
  return true;
}

function chips(name, optionen) {
  return `<div class="chiprow" role="group">${optionen.map(([v, l]) =>
    `<button class="chip" data-f="${name}" data-v="${v}" aria-pressed="${state.filter[name] === v}">${esc(l)}</button>`).join("")}</div>`;
}

async function seiteFach(id) {
  const fach = await ladeFach(id);
  if (!fach) { location.hash = "#/"; return; }
  const sichtbar = fach.themen.filter(passtFilter);
  let liste = "";
  fach.bereiche.forEach(b => {
    const ts = sichtbar.filter(t => t.bereich === b).sort((a, c) => a.stufe - c.stufe || a.nr - c.nr);
    if (!ts.length) return;
    liste += `<h3>${esc(b)}</h3>` + ts.map(t => {
      const box = mehrfach ? `<span class="check${auswahl.has(t.id) || istFertig(t.id) ? " on" : ""}" aria-hidden="true">${auswahl.has(t.id) || istFertig(t.id) ? "✓" : ""}</span>` : "";
      const inner = `${box}${marker(fach, t)}<span class="txt"><span class="t">${esc(t.titel)}</span><br><span class="s">${esc(t.satz)}</span></span><span class="badge">${t.klasse === "ab 7" ? "ab 7" : "Kl. " + esc(t.klasse)}</span>`;
      return mehrfach
        ? `<button class="topic" data-sel="${t.id}" aria-pressed="${auswahl.has(t.id)}"${istFertig(t.id) ? " disabled" : ""}>${inner}</button>`
        : `<a class="topic" href="#/thema/${id}/${t.id}">${inner}</a>`;
    }).join("");
  });
  if (!liste) liste = `<p class="muted" style="margin-top:24px">Hier ist gerade nichts. Probier einen anderen Filter.</p>`;

  app.innerHTML = `
    <div class="topbar"><a class="iconbtn" href="#/" aria-label="Zurück">←</a><h1>${esc(fach.name)}</h1>
      <button class="secondary" id="mehrfach">${mehrfach ? "Fertig" : "Mehrere abhaken"}</button></div>
    <div class="filters">
      ${chips("stand", [["alle", "Alle"], ["offen", "Das könnte ich mir noch ansehen"], ["geschafft", "Das habe ich schon geschafft"]])}
      ${chips("klasse", [["alle", "Jede Klasse"], ["5", "Klasse 5"], ["6", "Klasse 6"], ["7", "ab Klasse 7"]])}
      ${chips("art", [["alle", "Alle Arten"], ["einzel", "Kleines Einzelthema"], ["reihe", "Teil einer Reihe"]])}
    </div>
    ${liste}
    ${mehrfach ? `<div class="bottombar"><button class="primary" id="abhaken"${auswahl.size ? "" : " disabled"}>${auswahl.size ? `${auswahl.size} als geschafft markieren` : "Themen antippen"}</button></div>` : ""}`;

  app.querySelectorAll('.chip[aria-pressed="true"]').forEach(c => { c.parentElement.scrollLeft = Math.max(0, c.offsetLeft - c.parentElement.offsetLeft - 16); });
  app.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => {
    state.filter[b.dataset.f] = b.dataset.v; speichern(); seiteFach(id);
  }));
  document.getElementById("mehrfach").addEventListener("click", () => { mehrfach = !mehrfach; auswahl.clear(); seiteFach(id); });
  app.querySelectorAll("[data-sel]").forEach(b => b.addEventListener("click", () => {
    const tid = b.dataset.sel;
    auswahl.has(tid) ? auswahl.delete(tid) : auswahl.add(tid);
    seiteFach(id);
  }));
  const ab = document.getElementById("abhaken");
  if (ab) ab.addEventListener("click", () => {
    const neu = [...auswahl].map(t => fach.byId[t]);
    neu.forEach(abhaken);
    speichern();
    mehrfach = false; auswahl.clear();
    seiteFach(id);
    vorstufenHinweis(fach, neu);
  });
}

async function seiteThema(fid, tid) {
  const fach = await ladeFach(fid);
  const t = fach && fach.byId[tid];
  if (!t) { location.hash = "#/"; return; }
  const fertig = istFertig(t.id);
  const link = x => `<a href="#/thema/${fid}/${x.id}">${esc(x.titel)}</a>`;
  const vor = t.baut_auf.map(p => fach.byId[p]);
  const nach = fach.dependents[t.id].map(d => fach.byId[d]);
  const art = t.einzel ? "Kleines Einzelthema" : `Teil einer Reihe, Stufe ${t.stufe}`;
  app.innerHTML = `
    <div class="topbar"><a class="iconbtn" href="#/fach/${fid}" aria-label="Zurück">←</a><span class="muted" style="flex:1">${esc(fach.name)} · ${esc(t.bereich)}</span>
      ${fertig ? "" : `<button class="iconbtn stern" id="merk" aria-pressed="${!!state.merk[t.id]}" aria-label="${state.merk[t.id] ? "Gemerkt, nicht mehr merken" : "Für später merken"}">${state.merk[t.id] ? "★" : "☆"}</button>`}</div>
    <div class="head">${marker(fach, t, true)}<div><h1>${esc(t.titel)}</h1><p class="muted">${esc(klasseText(t.klasse))} · ${esc(art)}</p></div></div>
    <p style="margin-top:14px"><strong>${esc(t.satz)}</strong></p>
    <h2>Kurz erklärt</h2><p>${esc(t.erklaerung)}</p>
    <h2>Beispiele</h2><ul class="ex">${t.beispiele.map(b => `<li>${esc(b)}</li>`).join("")}</ul>
    <h2>Videos</h2>
    <div class="links videos">${videoLinks(t).map(v => `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.titel)}${v.kanal ? ` <span class="muted">(${esc(v.kanal)})</span>` : " auf YouTube"}</a>`).join("")}</div>
    ${vor.length ? `<h2>Baut auf</h2><div class="links">${vor.map(link).join("")}</div>` : ""}
    ${nach.length ? `<h2>Darauf baut auf</h2><div class="links">${nach.map(link).join("")}</div>` : ""}
    <h2>📔 Mein Lerntagebuch</h2>
    <textarea id="notiz" class="notiz" rows="4" placeholder="Was hast du gelernt? Was war schwierig? Was willst du noch wissen?">${esc((state.notizen[t.id] || {}).text || "")}</textarea>
    <div class="fotos" id="fotos"></div>
    <p style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label class="secondary" style="cursor:pointer">📷 Foto hinzufügen<input type="file" accept="image/*" id="foto" hidden></label>
      <span class="muted" id="notizstatus"></span>
    </p>
    <p class="source">Quelle: ${esc(fach.quelle)}, ${esc(t.quelle)}</p>
    <div class="bottombar"><button class="primary${fertig ? " undo" : ""}" id="toggle">${fertig ? "Doch noch nicht geschafft" : "Geschafft ✓"}</button></div>`;
  document.getElementById("toggle").addEventListener("click", () => {
    if (fertig) delete state.done[t.id]; else abhaken(t);
    speichern();
    seiteThema(fid, tid);
    if (!fertig) vorstufenHinweis(fach, [t]);
  });
  const merk = document.getElementById("merk");
  if (merk) merk.addEventListener("click", () => {
    if (state.merk[t.id]) delete state.merk[t.id]; else state.merk[t.id] = fid;
    speichern();
    const an = !!state.merk[t.id];
    merk.textContent = an ? "★" : "☆";
    merk.setAttribute("aria-pressed", an);
    merk.setAttribute("aria-label", an ? "Gemerkt, nicht mehr merken" : "Für später merken");
  });
  tagebuchEinrichten(fid, t);
  window.scrollTo(0, 0);
}

function notizAufraeumen(id) {
  const n = state.notizen[id];
  if (n && !n.text.trim() && !n.fotos.length) delete state.notizen[id];
}
function notizHolen(fid, id) {
  if (!state.notizen[id]) state.notizen[id] = { fach: fid, text: "", fotos: [], datum: heute() };
  return state.notizen[id];
}
async function fotosZeigen(id, ziel, loeschbar) {
  const n = state.notizen[id];
  if (!n || !n.fotos.length) { ziel.innerHTML = ""; return; }
  const bilder = await Promise.all(n.fotos.map(fotoLaden));
  ziel.innerHTML = n.fotos.map((fid, i) => bilder[i]
    ? `<span class="foto"><img src="${bilder[i]}" alt="Foto aus dem Lerntagebuch">${loeschbar ? `<button data-weg="${fid}" aria-label="Foto löschen">×</button>` : ""}</span>` : "").join("");
}
function tagebuchEinrichten(fid, t) {
  const feld = document.getElementById("notiz");
  const status = document.getElementById("notizstatus");
  const fotos = document.getElementById("fotos");
  const zeigen = () => fotosZeigen(t.id, fotos, true);
  feld.addEventListener("input", () => {
    const n = notizHolen(fid, t.id);
    n.text = feld.value;
    n.datum = heute();
    notizAufraeumen(t.id);
    speichern();
    status.textContent = "Gespeichert";
  });
  document.getElementById("foto").addEventListener("change", async e => {
    const datei = e.target.files[0];
    e.target.value = "";
    if (!datei) return;
    status.textContent = "Foto wird gespeichert …";
    try {
      const data = await bildVerkleinern(datei);
      const id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await fotoSpeichern(id, data);
      const n = notizHolen(fid, t.id);
      n.fotos.push(id);
      n.datum = heute();
      speichern();
      status.textContent = "Foto gespeichert";
      zeigen();
    } catch (err) {
      status.textContent = "Das Foto konnte nicht gespeichert werden.";
    }
  });
  fotos.addEventListener("click", async e => {
    const b = e.target.closest("[data-weg]");
    if (!b) return;
    const n = state.notizen[t.id];
    n.fotos = n.fotos.filter(x => x !== b.dataset.weg);
    await fotoLoeschen(b.dataset.weg);
    notizAufraeumen(t.id);
    speichern();
    zeigen();
  });
  zeigen();
}

/* ---------- Lerntagebuch und Rückblick ---------- */
let zeitraum = "woche";
async function tagebuchEintraege() {
  const alle = await alleThemen();
  const ab = zeitraum === "woche" ? wochenStart() : zeitraum === "monat" ? heute().slice(0, 8) + "01" : "";
  const imZeitraum = d => (zeitraum === "alles" ? true : !!d && d >= ab);
  return alle.map(x => {
    const n = state.notizen[x.t.id];
    const fd = fertigDatum(x.t.id);
    const geschafft = istFertig(x.t.id) && imZeitraum(fd);
    const notiz = n && imZeitraum(n.datum) ? n : null;
    if (!geschafft && !notiz) return null;
    return { x, geschafft, notiz, datum: [fd, notiz && notiz.datum].filter(Boolean).sort().pop() || "" };
  }).filter(Boolean).sort((a, b) => b.datum.localeCompare(a.datum));
}

async function seiteTagebuch() {
  const eintraege = await tagebuchEintraege();
  const nGeschafft = eintraege.filter(e => e.geschafft).length;
  const nNotizen = eintraege.filter(e => e.notiz).length;
  const zr = { woche: "Diese Woche", monat: "Diesen Monat", alles: "Insgesamt" }[zeitraum];
  app.innerHTML = `
    <div class="topbar"><a class="iconbtn" href="#/" aria-label="Zurück">←</a><h1>Lerntagebuch</h1></div>
    <div class="chiprow" role="group">${[["woche", "Diese Woche"], ["monat", "Dieser Monat"], ["alles", "Alles"]].map(([v, l]) =>
      `<button class="chip" data-z="${v}" aria-pressed="${zeitraum === v}">${l}</button>`).join("")}</div>
    <section class="card" style="margin-top:12px">
      <h2 style="margin-top:0">${zr}</h2>
      <p>✓ ${nGeschafft} ${nGeschafft === 1 ? "Thema" : "Themen"} geschafft · 📔 ${nNotizen} ${nNotizen === 1 ? "Notiz" : "Notizen"}</p>
      ${eintraege.length ? `<p style="margin-top:10px"><button class="secondary" id="teilen">📤 Rückblick teilen</button></p>` : ""}
    </section>
    <div id="eintraege" style="margin-top:12px">${eintraege.length ? eintraege.map(e => `
      <article class="card eintrag">
        <a class="eintrag-kopf" href="#/thema/${e.x.t.fach}/${e.x.t.id}">${marker(e.x.fach, e.x.t)}<span><strong>${esc(e.x.t.titel)}</strong><br>
          <span class="muted">${e.x.fach.meta.sym} ${esc(e.x.fach.meta.name)}${e.datum ? " · " + schoenesDatum(e.datum) : ""}${e.geschafft ? " · geschafft" : ""}</span></span></a>
        ${e.notiz && e.notiz.text.trim() ? `<p class="notiztext">${esc(e.notiz.text)}</p>` : ""}
        <div class="fotos" data-fotos="${e.x.t.id}"></div>
      </article>`).join("") : `<p class="muted" style="margin-top:16px">Hier ist noch nichts. Schreib bei einem Thema etwas ins Lerntagebuch oder hake es als geschafft ab.</p>`}</div>`;
  app.querySelectorAll("[data-z]").forEach(b => b.addEventListener("click", () => { zeitraum = b.dataset.z; seiteTagebuch(); }));
  app.querySelectorAll("[data-fotos]").forEach(d => fotosZeigen(d.dataset.fotos, d, false));
  const teilen = document.getElementById("teilen");
  if (teilen) teilen.addEventListener("click", () => rueckblickTeilen(eintraege, zr));
}

async function rueckblickTeilen(eintraege, zr) {
  const teile = [];
  for (const e of eintraege) {
    const bilder = e.notiz ? (await Promise.all(e.notiz.fotos.map(fotoLaden))).filter(Boolean) : [];
    teile.push(`<section><h2>${esc(e.x.t.titel)}</h2>
      <p class="m">${esc(e.x.fach.meta.name)} · ${esc(e.x.t.bereich)}${e.datum ? " · " + schoenesDatum(e.datum) : ""}${e.geschafft ? " · geschafft ✓" : ""}</p>
      ${e.notiz && e.notiz.text.trim() ? `<p>${esc(e.notiz.text).replace(/\n/g, "<br>")}</p>` : ""}
      ${bilder.map(b => `<img src="${b}" alt="">`).join("")}</section>`);
  }
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lerntagebuch: ${zr}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:700px;margin:0 auto;padding:16px;color:#1f2430}
h1{font-size:1.5rem}h2{font-size:1.1rem;margin:0 0 2px}section{border-top:1px solid #ddd;padding:12px 0}.m{color:#5d6472;font-size:.9rem;margin:0 0 6px}
img{max-width:100%;border-radius:8px;margin:6px 0;display:block}</style></head><body>
<h1>Lerntagebuch: ${zr}</h1><p class="m">Erstellt am ${schoenesDatum(heute())} mit Freilernen</p>${teile.join("")}</body></html>`;
  const name = `lerntagebuch-${heute()}.html`;
  const datei = new File([html], name, { type: "text/html" });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try { await navigator.share({ files: [datei], title: `Lerntagebuch: ${zr}` }); return; } catch (err) { if (err && err.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(datei);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function seiteEinstellungen() {
  const fortschritt = [];
  for (const f of FAECHER) {
    if (!f.datei) continue;
    const fach = await ladeFach(f.id);
    const n = fach.themen.filter(t => istFertig(t.id)).length;
    fortschritt.push(`<div class="row"><span>${esc(f.name)}</span><span class="muted">${n} von ${fach.themen.length}</span></div>
      <div class="bar"><div style="width:${Math.round(100 * n / fach.themen.length)}%"></div></div>`);
  }
  app.innerHTML = `
    <div class="topbar"><a class="iconbtn" href="#/" aria-label="Zurück">←</a><h1>Einstellungen</h1></div>
    <section class="card"><h2 style="margin-top:0">Mein Fortschritt</h2>${fortschritt.join("")}</section>
    <section class="card" style="margin-top:12px">
      <h2 style="margin-top:0">So liest du die Punkte</h2>
      <div class="legend">
        <div><span class="mk dot orange"></span> Noch nicht angesehen</div>
        <div><span class="mk dot green">✓</span> Geschafft</div>
        <div><span class="mk blue">3</span> Teil einer Reihe, die Vorstufen sind noch offen</div>
        <div><span class="mk orange">3</span> Teil einer Reihe, du kannst loslegen</div>
        <div><span class="mk green">3<span class="tick">✓</span></span> Teil einer Reihe, geschafft</div>
      </div>
      <p class="muted" style="margin-top:8px">Die Zahl zeigt, an welcher Stelle der Reihe ein Thema steht.</p>
    </section>
    <section class="card" style="margin-top:12px">
      <h2 style="margin-top:0">Daten sichern</h2>
      <p class="muted">Häkchen, Stempel, Notizen und Fotos sind nur auf diesem Handy gespeichert. Sichere sie ab und zu als Datei.</p>
      <p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="secondary" id="export">Daten sichern</button>
        <label class="secondary" style="cursor:pointer">Wiederherstellen<input type="file" id="import" accept="application/json,.json" hidden></label>
      </p>
      <p class="muted" id="meldung"></p>
    </section>`;
  document.getElementById("export").addEventListener("click", datenSichern);
  document.getElementById("import").addEventListener("change", async e => {
    const datei = e.target.files[0];
    const meldung = document.getElementById("meldung");
    if (!datei) return;
    try {
      const j = JSON.parse(await datei.text());
      if (j.app !== "freilernen" || !j.state) throw new Error("falsche Datei");
      if (j.fotos) for (const [fid, data] of Object.entries(j.fotos)) await fotoSpeichern(fid, data);
      state = Object.assign(ladeState(), j.state);
      speichern();
      seiteEinstellungen().then(() => { document.getElementById("meldung").textContent = "Wiederhergestellt."; });
    } catch (err) {
      meldung.textContent = "Diese Datei konnte nicht gelesen werden.";
    }
  });
}

/* ---------- Thema finden ---------- */
async function alleThemen() {
  const ds = await Promise.all(FAECHER.filter(f => f.datei).map(f => ladeFach(f.id)));
  return ds.filter(Boolean).flatMap(d => d.themen.map(t => ({ t, fach: d })));
}
const istBereit = x => !istFertig(x.t.id) && !offeneVorstufen(x.fach, x.t).length;
const zufall = arr => arr[Math.floor(Math.random() * arr.length)];
const wenigBewegung = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function vorschlag(x) {
  const m = x.fach.meta;
  return `<a class="topic" href="#/thema/${x.t.fach}/${x.t.id}">${marker(x.fach, x.t)}<span class="txt"><span class="t">${esc(x.t.titel)}</span><br><span class="s">${m.sym} ${esc(m.name)} · ${esc(x.t.satz)}</span></span></a>`;
}

function seiteFinden() {
  app.innerHTML = `
    <div class="topbar"><a class="iconbtn" href="#/" aria-label="Zurück">←</a><h1>Thema finden</h1></div>
    <section class="card">
      <h2 style="margin-top:0">🎲 Überrasch mich</h2>
      <p class="muted">Alle Themen wirbeln durch, und am Ende bleibt eins stehen, das du noch nicht abgehakt hast.</p>
      <div class="spin" id="spin" aria-live="polite"><span class="spin-sym">🎲</span><span class="spin-t">Drück auf den Knopf!</span></div>
      <button class="primary" id="drehen">Los geht's!</button>
      <div id="ergebnis"></div>
    </section>
    <section class="card" style="margin-top:16px">
      <h2 style="margin-top:0">💬 Was passt heute zu mir?</h2>
      <p class="muted">Beantworte ein paar kurze Fragen, dann bekommst du Vorschläge, die zu deiner Laune passen.</p>
      <p style="margin-top:12px"><a class="secondary" href="#/finden/fragen" style="display:inline-block;text-decoration:none;color:var(--text)">Fragen starten</a></p>
    </section>`;
  const knopf = document.getElementById("drehen");
  knopf.addEventListener("click", async () => {
    knopf.disabled = true;
    document.getElementById("ergebnis").innerHTML = "";
    const alle = await alleThemen();
    const offen = alle.filter(x => !istFertig(x.t.id));
    const spin = document.getElementById("spin");
    if (!offen.length) {
      spin.innerHTML = `<span class="spin-sym">🏆</span><span class="spin-t">Du hast alle Themen abgehakt!</span>`;
      knopf.disabled = false;
      return;
    }
    const bereit = offen.filter(istBereit);
    const ziel = zufall(bereit.length ? bereit : offen);
    const zeige = x => { spin.style.setProperty("--c", x.fach.meta.farbe); spin.innerHTML = `<span class="spin-sym">${x.fach.meta.sym}</span><span class="spin-t">${esc(x.t.titel)}</span>`; };
    const schritte = wenigBewegung() ? 0 : 26;
    spin.classList.add("dreht");
    for (let i = 0; i < schritte; i++) {
      zeige(zufall(alle));
      await new Promise(r => setTimeout(r, 45 + i * i * 0.6));
    }
    zeige(ziel);
    spin.classList.remove("dreht");
    spin.classList.add("stopp");
    setTimeout(() => spin.classList.remove("stopp"), 600);
    document.getElementById("ergebnis").innerHTML = `
      <p style="margin:14px 0 8px"><strong>Wie wär's damit?</strong></p>
      ${vorschlag(ziel)}`;
    knopf.textContent = "Nochmal drehen";
    knopf.disabled = false;
  });
}

const FRAGEN = [
  { key: "lust", frage: "Worauf hast du heute Lust?", optionen: [
    ["🔢 Zahlen und Knobeln", ["mathe"]],
    ["📖 Lesen, Schreiben, Geschichten", ["deutsch"]],
    ["🗣️ Andere Sprachen", ["englisch", "spanisch"]],
    ["🔬 Natur und Experimente", ["nawi"]],
    ["🌍 Menschen, Länder und früher", ["gl"]],
    ["🎵 Musik", ["musik"]],
    ["🤷 Weiß nicht, alles ist okay", null]] },
  { key: "kopf", frage: "Wie fühlt sich dein Kopf gerade an?", optionen: [
    ["⚡ Hellwach, ich will was Kniffliges", "schwer"],
    ["🙂 Ganz normal", null],
    ["😴 Eher müde, lieber was Leichtes", "leicht"]] },
  { key: "weg", frage: "Wie möchtest du heute lernen?", optionen: [
    ["▶️ Mit einem Video", "video"],
    ["✏️ Lesen und selbst ausprobieren", null],
    ["🤷 Egal", null]] },
  { key: "neu", frage: "Was ist dir heute lieber?", optionen: [
    ["🔁 Weitermachen, wo ich schon angefangen habe", "weiter"],
    ["✨ Etwas ganz Neues entdecken", "neu"],
    ["🤷 Egal", null]] }
];
let antworten = {};

function passendeThemen(alle) {
  const offen = alle.filter(x => !istFertig(x.t.id));
  let pool = offen.filter(istBereit);
  if (!pool.length) pool = offen;
  if (antworten.lust) {
    const nurFach = pool.filter(x => antworten.lust.includes(x.t.fach));
    if (nurFach.length) pool = nurFach;
  }
  const bereichAngefangen = new Set(alle.filter(x => istFertig(x.t.id)).map(x => x.t.fach + "|" + x.t.bereich));
  return pool.map(x => {
    const t = x.t;
    let p = Math.random() * 1.5;
    if (antworten.kopf === "schwer") p += Math.min(t.stufe, 5) * 0.6;
    if (antworten.kopf === "leicht") p += (t.stufe === 1 ? 2 : 0) + (t.einzel ? 1 : 0);
    if (antworten.weg === "video" && t.videos && t.videos.length) p += 2;
    if (antworten.neu === "weiter" && t.baut_auf.some(istFertig)) p += 3;
    if (antworten.neu === "neu" && !bereichAngefangen.has(t.fach + "|" + t.bereich)) p += 2;
    return { x, p };
  }).sort((a, b) => b.p - a.p).map(e => e.x);
}

async function seiteFragen(schritt) {
  const n = Number(schritt) || 0;
  if (n === 0) antworten = {};
  const kopf = `<div class="topbar"><a class="iconbtn" href="#/finden" aria-label="Zurück">←</a><h1>Was passt heute?</h1></div>`;
  if (n < FRAGEN.length) {
    const f = FRAGEN[n];
    app.innerHTML = `${kopf}
      <p class="muted">Frage ${n + 1} von ${FRAGEN.length}</p>
      <h2>${esc(f.frage)}</h2>
      <div class="opts">${f.optionen.map((o, i) => `<button class="opt" data-i="${i}">${esc(o[0])}</button>`).join("")}</div>`;
    app.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
      antworten[f.key] = f.optionen[Number(b.dataset.i)][1];
      location.hash = `#/finden/fragen/${n + 1}`;
    }));
    return;
  }
  const liste = passendeThemen(await alleThemen()).slice(0, 3);
  app.innerHTML = `${kopf}
    <h2>Das könnte heute zu dir passen:</h2>
    ${liste.length ? liste.map(vorschlag).join("") : '<p class="muted">Du hast schon alles abgehakt. Stark!</p>'}
    <p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      <button class="secondary" id="andere">Andere Vorschläge</button>
      <a class="secondary" href="#/finden/fragen" style="text-decoration:none;color:var(--text)">Nochmal fragen</a>
    </p>`;
  document.getElementById("andere").addEventListener("click", () => seiteFragen(FRAGEN.length));
}

async function datenSichern() {
  const fotos = {};
  for (const n of Object.values(state.notizen)) {
    for (const fid of n.fotos) { const d = await fotoLaden(fid); if (d) fotos[fid] = d; }
  }
  const blob = new Blob([JSON.stringify({ app: "freilernen", version: 2, datum: new Date().toISOString(), state, fotos }, null, 2)], { type: "application/json" });
  const name = `freilernen-sicherung-${heute()}.json`;
  const datei = new File([blob], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try { await navigator.share({ files: [datei], title: "Freilernen Sicherung" }); return; } catch (err) { if (err && err.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Router ---------- */
function route() {
  schliesseSheet();
  const teile = location.hash.replace(/^#\/?/, "").split("/");
  if (teile[0] !== "fach") { mehrfach = false; auswahl.clear(); }
  if (teile[0] === "fach") return seiteFach(teile[1]);
  if (teile[0] === "thema") return seiteThema(teile[1], teile[2]);
  if (teile[0] === "einstellungen") return seiteEinstellungen();
  if (teile[0] === "tagebuch") return seiteTagebuch();
  if (teile[0] === "finden") return teile[1] === "fragen" ? seiteFragen(teile[2]) : seiteFinden();
  return seiteStart();
}
window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
