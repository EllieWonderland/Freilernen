"use strict";

/* Fächer: Mathe, Deutsch und Englisch sind fertig, die anderen folgen. */
const FAECHER = [
  { id: "mathe", name: "Mathe", sym: "🔢", farbe: "#3b7dd8", datei: "data/mathe.json" },
  { id: "deutsch", name: "Deutsch", sym: "📖", farbe: "#d0533f", datei: "data/deutsch.json" },
  { id: "englisch", name: "Englisch", sym: "🇬🇧", farbe: "#7a5bd6", datei: "data/englisch.json" },
  { id: "spanisch", name: "Spanisch", sym: "🇪🇸", farbe: "#e2a316" },
  { id: "nawi", name: "NaWi", sym: "🔬", farbe: "#2e9e5b" },
  { id: "gl", name: "Gesellschaftslehre", sym: "🌍", farbe: "#2a9bb0" },
  { id: "musik", name: "Musik", sym: "🎵", farbe: "#c2508f" }
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
  return s;
}
let state = ladeState();
function speichern() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* privat oder voll */ }
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
  englisch: ["Einfach Englisch", "BBC Learning English", "Mr Kay Erklärt Englisch"]
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
  ).join("");
  app.innerHTML = `
    <div class="topbar"><h1>Freilernen</h1><a class="iconbtn" href="#/einstellungen" aria-label="Einstellungen">⚙︎</a></div>
    <section class="card week">
      <h2>Mein Wochenziel</h2>
      <div class="stamps">${kreise}</div>
      <p class="muted">${text}</p>
    </section>
    <div class="tiles">${tiles}</div>`;
  app.querySelectorAll("[data-stamp]").forEach(b => b.addEventListener("click", () => {
    const i = Number(b.dataset.stamp);
    const c = stempel();
    state.week.count = i < c ? i : Math.min(5, c + 1);
    speichern();
    seiteStart();
  }));
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
    neu.forEach(t => { state.done[t.id] = true; });
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
    <div class="topbar"><a class="iconbtn" href="#/fach/${fid}" aria-label="Zurück">←</a><span class="muted">${esc(fach.name)} · ${esc(t.bereich)}</span></div>
    <div class="head">${marker(fach, t, true)}<div><h1>${esc(t.titel)}</h1><p class="muted">${esc(klasseText(t.klasse))} · ${esc(art)}</p></div></div>
    <p style="margin-top:14px"><strong>${esc(t.satz)}</strong></p>
    <h2>Kurz erklärt</h2><p>${esc(t.erklaerung)}</p>
    <h2>Beispiele</h2><ul class="ex">${t.beispiele.map(b => `<li>${esc(b)}</li>`).join("")}</ul>
    <h2>Videos</h2>
    <div class="links videos">${videoLinks(t).map(v => `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.titel)}${v.kanal ? ` <span class="muted">(${esc(v.kanal)})</span>` : " auf YouTube"}</a>`).join("")}</div>
    ${vor.length ? `<h2>Baut auf</h2><div class="links">${vor.map(link).join("")}</div>` : ""}
    ${nach.length ? `<h2>Darauf baut auf</h2><div class="links">${nach.map(link).join("")}</div>` : ""}
    <p class="source">Quelle: ${esc(fach.quelle)}, ${esc(t.quelle)}</p>
    <div class="bottombar"><button class="primary${fertig ? " undo" : ""}" id="toggle">${fertig ? "Doch noch nicht geschafft" : "Geschafft ✓"}</button></div>`;
  document.getElementById("toggle").addEventListener("click", () => {
    if (fertig) delete state.done[t.id]; else state.done[t.id] = true;
    speichern();
    seiteThema(fid, tid);
    if (!fertig) vorstufenHinweis(fach, [t]);
  });
  window.scrollTo(0, 0);
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
      <p class="muted">Häkchen und Stempel sind nur auf diesem Handy gespeichert. Sichere sie ab und zu als Datei.</p>
      <p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="secondary" id="export">Daten sichern</button>
        <label class="secondary" style="cursor:pointer">Wiederherstellen<input type="file" id="import" accept="application/json,.json" hidden></label>
      </p>
      <p class="muted" id="meldung"></p>
    </section>`;
  document.getElementById("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ app: "freilernen", version: 1, datum: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `freilernen-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  document.getElementById("import").addEventListener("change", async e => {
    const datei = e.target.files[0];
    const meldung = document.getElementById("meldung");
    if (!datei) return;
    try {
      const j = JSON.parse(await datei.text());
      if (j.app !== "freilernen" || !j.state) throw new Error("falsche Datei");
      state = Object.assign(ladeState(), j.state);
      speichern();
      seiteEinstellungen().then(() => { document.getElementById("meldung").textContent = "Wiederhergestellt."; });
    } catch (err) {
      meldung.textContent = "Diese Datei konnte nicht gelesen werden.";
    }
  });
}

/* ---------- Router ---------- */
function route() {
  schliesseSheet();
  const teile = location.hash.replace(/^#\/?/, "").split("/");
  if (teile[0] !== "fach") { mehrfach = false; auswahl.clear(); }
  if (teile[0] === "fach") return seiteFach(teile[1]);
  if (teile[0] === "thema") return seiteThema(teile[1], teile[2]);
  if (teile[0] === "einstellungen") return seiteEinstellungen();
  return seiteStart();
}
window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
