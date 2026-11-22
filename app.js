import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBlEXrtxHlq5NIEuqpiGZbquUzWvPMcOiE",
  authDomain: "ohnoefinito.firebaseapp.com",
  projectId: "ohnoefinito",
  storageBucket: "ohnoefinito.firebasestorage.app",
  messagingSenderId: "251015979077",
  appId: "1:251015979077:web:5c6c4b902cddf6b4a1032c",
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
let fs;
try {
  fs = initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (_) {
  fs = initializeFirestore(fbApp, { localCache: memoryLocalCache() });
}

// ---------- costanti ----------
const CATS = [
  { id: "frigo", label: "Frigo e freschi" },
  { id: "surgelati", label: "Surgelati" },
  { id: "cibo", label: "Cibo e scaffale" },
  { id: "bevande", label: "Bevande" },
  { id: "pulizia", label: "Pulizia casa" },
  { id: "igiene", label: "Bagno e igiene" },
  { id: "altro", label: "Altro" },
];
const ZONES = [
  { id: "frigo", label: "Frigo", hint: "latte, uova, formaggi, verdure" },
  { id: "freezer", label: "Freezer", hint: "surgelati, gelati, pane congelato" },
  { id: "credenza", label: "Credenza", hint: "pasta, riso, scatolame, snack, bevande" },
  { id: "pulizia", label: "Pulizia casa", hint: "detersivi, carta, sacchetti" },
  { id: "bagno", label: "Bagno e cura", hint: "sapone, shampoo, dentifricio" },
];
const catById = Object.fromEntries(CATS.map(c => [c.id, c]));
const zoneById = Object.fromEntries(ZONES.map(z => [z.id, z]));
const ZONE_TO_CAT = { frigo: "frigo", freezer: "surgelati", credenza: "cibo", pulizia: "pulizia", bagno: "igiene" };
const CAT_TO_ZONE = { frigo: "frigo", surgelati: "freezer", cibo: "credenza", bevande: "credenza", pulizia: "pulizia", igiene: "bagno", altro: "credenza" };
const GUESS = [
  [/surgel|gelat|bastoncin|spinaci surg|piselli surg|pizza surg/i, "surgelati"],
  [/sapon|shampoo|bagnoschiuma|dentifric|spazzolin|carta igien|deodor|assorbent|rasoi|cotton|crema|balsamo|collutorio/i, "igiene"],
  [/detersiv|candeggin|sgrassat|anticalcare|spugn|pattumier|sacchett|ammorbid|lavastovigl|lavatric|pavimenti|scottex|carta cucina|vetri|brillantante|alluminio|pellicola/i, "pulizia"],
  [/latte|yogurt|burro|formagg|mozzarell|uova|prosciutt|insalat|verdur|frutta|carne|pollo|pesce|panna|kimchi|tofu/i, "frigo"],
  [/acqua|vino|birra|succo|caff[eè]|t[eè]\b|bibit|coca/i, "bevande"],
  [/pasta|riso|pane|farina|zucchero|sale|olio|aceto|biscott|cereali|pelati|passata|legumi|tonno|crackers|merend|ramen|noodle|gochujang|salsa di soia/i, "cibo"],
];
const guessCat = name => (GUESS.find(([re]) => re.test(name)) || [])[1] || null;
const CODE_RE = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const I = {
  check: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>`,
  trash: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h12M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.4.1 4 1.6 4.5 4.3"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`,
  scan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 8.5v7M11 8.5v7M13.5 8.5v7M16 8.5v7"/></svg>`,
  plus: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 4v12M4 10h12"/></svg>`,
  minus: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 10h12"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14l-1.4 9.1a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7L5 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>`,
  shelf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M4 10h16M4 15.5h16"/><path d="M8 6.8h3M8 12.7h2"/></svg>`,
};

const $ = id => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} },
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const norm = s => String(s || "").trim().toLocaleLowerCase("it-IT").replace(/\s+/g, " ");

// ---------- stato ----------
const state = {
  view: "boot",                // boot | setup | settings | app
  tab: store.get("onf-section") === "dispensa" ? "dispensa" : "spesa",
  list: store.get("onf-tab") === "mio" ? "mio" : "casa",
  filter: "all", zone: "all", search: "", status: "out",
  data: { casa: [], mio: [], pantry: [] },
  loaded: { casa: false, mio: false, pantry: false },
  server: { casa: false, mio: false, pantry: false },
  pending: false,
  uid: null, code: store.get("onf-code"), me: store.get("onf-name") || "",
  problems: { shop: null, pantry: null }, justCreated: false,
};
let unsubs = [], pendingDel = null, toastTimer = null, undoFn = null, refreshing = false, serverWaiters = [];

// codice di casa arrivato da un link d'invito (#casa=XXXX-XXXX-XXXX-XXXX)
const fromLink = parseCode(location.hash);
if (fromLink) { state.code = fromLink; store.set("onf-code", fromLink); history.replaceState(null, "", location.pathname); }

function parseCode(text) {
  if (!text) return null;
  const m = String(text).toUpperCase().match(/[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}/);
  if (!m) return null;
  const code = m[0].replace(/-/g, "").match(/.{4}/g).join("-");
  return CODE_RE.test(code) ? code : null;
}
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("").match(/.{4}/g).join("-");
}
const inviteLink = () => `${location.origin}${location.pathname}#casa=${state.code}`;

function ago(ts) {
  if (!ts) return "";
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "adesso";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "ieri";
  if (d < 7) return `${d} giorni fa`;
  return new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
function daysLeft(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - t) / 86400000);
}
function expLabel(iso) {
  const n = daysLeft(iso);
  if (n == null) return "";
  if (n < 0) return `<span class="exp bad">scaduto ${n === -1 ? "ieri" : `da ${-n} giorni`}</span>`;
  if (n === 0) return `<span class="exp bad">scade oggi</span>`;
  if (n === 1) return `<span class="exp soon">scade domani</span>`;
  if (n <= 3) return `<span class="exp soon">scade tra ${n} giorni</span>`;
  const [y, m, d] = iso.split("-").map(Number);
  return `<span class="exp ok">scade il ${new Date(y, m - 1, d).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>`;
}

// ---------- dati ----------
function colFor(kind) {
  if (kind === "casa") return collection(fs, "households", state.code, "items");
  if (kind === "pantry") return collection(fs, "households", state.code, "pantry");
  return collection(fs, "users", state.uid, "items");
}
const barcodeRef = ean => doc(fs, "households", state.code, "barcodes", ean);

function write(kind, id, data, isNew) {
  const ref = doc(colFor(kind), id);
  const p = isNew ? setDoc(ref, data) : updateDoc(ref, data);
  p.catch(e => handleWriteError(e, kind));
  return p;
}
function handleWriteError(e, kind) {
  console.error(e);
  state.problems[kind === "pantry" ? "pantry" : "shop"] = e && e.code === "permission-denied"
    ? "Il database ha rifiutato la modifica. Probabilmente le regole di Firestore vanno aggiornate: copia di nuovo firestore.rules nella console Firebase (vedi README)."
    : "Non sono riuscito a salvare. Controlla la connessione e riprova.";
  renderData();
}

function subscribe(kind) {
  const timer = setTimeout(() => { if (!state.loaded[kind]) { state.loaded[kind] = true; renderData(); } }, 8000);
  const unsub = onSnapshot(colFor(kind), { includeMetadataChanges: true }, snap => {
    clearTimeout(timer);
    state.data[kind] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.loaded[kind] = true;
    if (!snap.metadata.fromCache) state.server[kind] = true;
    state.pendingMap = { ...(state.pendingMap || {}), [kind]: snap.metadata.hasPendingWrites };
    checkServerWaiters();
    setSync(); renderData();
  }, err => {
    clearTimeout(timer);
    console.error(kind, err);
    state.loaded[kind] = true;
    state.server[kind] = true; checkServerWaiters();
    state.problems[kind === "pantry" ? "pantry" : "shop"] = err.code === "permission-denied"
      ? (kind === "pantry"
        ? "La dispensa non è ancora accessibile: aggiorna le regole di Firestore con il nuovo firestore.rules (vedi README)."
        : "La lista non è accessibile: controlla le regole di Firestore (vedi README).")
      : "La lista si è scollegata. Tocca il pulsante aggiorna per riprovare.";
    $("sync").dataset.state = "error";
    renderData();
  });
  unsubs.push(unsub);
}
function startLists() {
  unsubs.forEach(u => u()); unsubs = [];
  state.server = { casa: false, mio: false, pantry: false };
  state.problems = { shop: null, pantry: null };
  subscribe("casa"); subscribe("mio"); subscribe("pantry");
}
function checkServerWaiters() {
  if (state.server.casa && state.server.mio && state.server.pantry) { serverWaiters.forEach(f => f(true)); serverWaiters = []; }
}
function setSync() {
  const el = $("sync");
  const pending = Object.values(state.pendingMap || {}).some(Boolean);
  if (!navigator.onLine) { el.dataset.state = "pending"; el.setAttribute("aria-label", "Offline: le modifiche verranno salvate appena torna la rete"); }
  else if (pending) { el.dataset.state = "pending"; el.setAttribute("aria-label", "Salvataggio in corso"); }
  else { el.dataset.state = "live"; el.setAttribute("aria-label", "Sincronizzato"); }
}
addEventListener("online", setSync); addEventListener("offline", setSync);

// ---------- aggiorna (pulsante e tirare giù) ----------
async function refresh() {
  if (refreshing || state.view !== "app") return;
  refreshing = true;
  $("refresh-btn").classList.add("spinning");
  const reached = new Promise(res => { serverWaiters.push(res); setTimeout(() => res(false), 7000); });
  startLists();
  navigator.serviceWorker?.getRegistration().then(r => r && r.update()).catch(() => {});
  const ok = await reached;
  refreshing = false;
  $("refresh-btn").classList.remove("spinning");
  endPull();
  showToast(ok ? "Aggiornato" : (navigator.onLine ? "Il server non risponde: mostro l’ultima copia salvata" : "Sei offline: mostro l’ultima copia salvata"));
}

const ptr = $("ptr");
let pullStart = null, pullDist = 0;
const PULL_READY = 64;
function endPull() {
  ptr.classList.remove("dragging", "ready", "loading");
  ptr.style.height = "0px";
  $("ptr-text").textContent = "Tira per aggiornare";
}
addEventListener("touchstart", e => {
  if (state.view !== "app" || refreshing || document.querySelector(".scrim, .scanner")) return;
  if (window.scrollY > 0 || e.touches.length !== 1) return;
  pullStart = e.touches[0].clientY; pullDist = 0;
}, { passive: true });
addEventListener("touchmove", e => {
  if (pullStart == null) return;
  const dy = e.touches[0].clientY - pullStart;
  if (dy <= 0 || window.scrollY > 0) { pullDist = 0; ptr.style.height = "0px"; return; }
  pullDist = Math.min(dy * 0.5, 96);
  ptr.classList.add("dragging");
  ptr.style.height = pullDist + "px";
  const ready = pullDist >= PULL_READY;
  ptr.classList.toggle("ready", ready);
  $("ptr-text").textContent = ready ? "Rilascia per aggiornare" : "Tira per aggiornare";
}, { passive: true });
addEventListener("touchend", () => {
  if (pullStart == null) return;
  pullStart = null;
  ptr.classList.remove("dragging");
  if (pullDist >= PULL_READY) {
    ptr.classList.add("loading"); ptr.classList.remove("ready");
    ptr.style.height = "48px"; $("ptr-text").textContent = "Aggiorno…";
    refresh();
  } else endPull();
  pullDist = 0;
});
$("refresh-btn").addEventListener("click", refresh);

// ---------- toast ----------
function showToast(text, undo) {
  $("toast-text").textContent = text;
  undoFn = undo || null;
  $("toast-undo").hidden = !undo;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; undoFn = null; }, 5000);
}
$("toast-undo").addEventListener("click", () => { const f = undoFn; $("toast").hidden = true; undoFn = null; if (f) f(); });

// ---------- scanner (caricato solo quando serve) ----------
let scannerMod = null;
const scanner = async () => (scannerMod ||= await import("./scanner.js"));

/** Scansiona e cerca il prodotto. Risolve con { code, name, note, zone } oppure null. */
async function scanAndLookup() {
  const s = await scanner();
  const code = await s.scanBarcode();
  if (!code) return null;
  showToast("Cerco il prodotto…");
  let known = null;
  try { const snap = await getDoc(barcodeRef(code)); if (snap.exists()) known = snap.data(); } catch (_) {}
  if (known) { $("toast").hidden = true; return { code, name: known.name, note: known.note || "", zone: known.zone || null, cat: known.cat || null, source: "casa" }; }
  const p = await s.lookupProduct(code);
  $("toast").hidden = true;
  if (!p) return { code, name: "", note: "", zone: null, cat: null, source: null };
  const note = [p.brand, p.quantity].filter(Boolean).join(" · ");
  const zone = s.zoneFromProduct(p) || CAT_TO_ZONE[guessCat(p.name)] || null;
  return { code, name: p.name, note, zone, cat: guessCat(p.name) || (zone ? ZONE_TO_CAT[zone] : null), source: p.kind };
}
function rememberBarcode(code, data) {
  if (!code) return;
  setDoc(barcodeRef(code), { name: data.name, zone: data.zone || null, cat: data.cat || null, note: data.note || "", at: Date.now() }).catch(e => console.warn("barcode", e));
}

// ======================================================================
// SPESA
// ======================================================================
$("add-cat").innerHTML = CATS.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
$("add-scan").innerHTML = I.scan;
let catTouched = false, scannedCode = null;
$("add-cat").addEventListener("change", () => { catTouched = true; });
$("add-name").addEventListener("input", e => {
  const v = e.target.value.trim();
  $("add-btn").disabled = !v;
  if (!catTouched) { const g = guessCat(v); if (g) $("add-cat").value = g; }
  if (!v) scannedCode = null;
});
document.querySelectorAll("#add-form .chipbtn").forEach(b => b.addEventListener("click", () => {
  state.status = b.dataset.v;
  document.querySelectorAll("#add-form .chipbtn").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
}));
document.querySelectorAll("#view-shop .seg2 button").forEach(t => t.addEventListener("click", () => {
  state.list = t.dataset.list; state.filter = "all"; store.set("onf-tab", state.list); renderData();
}));
$("add-scan").addEventListener("click", async () => {
  const r = await scanAndLookup();
  if (!r) return;
  scannedCode = r.code;
  $("add-name").value = r.name;
  $("add-note").value = r.note;
  if (r.cat) { $("add-cat").value = r.cat; catTouched = true; }
  $("add-btn").disabled = !r.name;
  if (!r.name) { showToast("Prodotto non trovato: scrivi tu il nome, la prossima volta lo riconosco"); $("add-name").focus(); }
});

$("add-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("add-name").value.trim().replace(/\s+/g, " ");
  if (!name || !state.uid) return;
  const note = $("add-note").value.trim();
  const cat = $("add-cat").value;
  const list = state.list;
  addToShopping(list, { name, cat, note, status: state.status });
  if (scannedCode && list === "casa") rememberBarcode(scannedCode, { name, cat, zone: CAT_TO_ZONE[cat], note });
  $("add-name").value = ""; $("add-note").value = ""; $("add-btn").disabled = true; catTouched = false; scannedCode = null;
});

function whoFields() {
  return { byUid: state.uid, byName: state.me, at: Date.now(), boughtUid: null, boughtName: null, boughtAt: null };
}
/** Aggiunge alla lista della spesa, o rimette in lista se c'è già. Restituisce una funzione per annullare. */
function addToShopping(list, { name, cat, note, status, pantryId }, silent) {
  const existing = state.data[list].find(i => norm(i.name) === norm(name));
  if (existing) {
    const prev = { status: existing.status, cat: existing.cat || "altro", note: existing.note || "", at: existing.at || null };
    const patch = { status, cat, note: note || existing.note || "", ...whoFields() };
    if (pantryId) patch.pantryId = pantryId;
    write(list, existing.id, patch).catch(() => {});
    if (!silent) showToast(existing.status === "ok" ? `“${existing.name}” è di nuovo in lista` : `“${existing.name}” era già in lista: aggiornato`);
    return () => write(list, existing.id, prev).catch(() => {});
  }
  const id = doc(colFor(list)).id;
  const data = { name, cat, note: note || "", status, ...whoFields() };
  if (pantryId) data.pantryId = pantryId;
  write(list, id, data, true).catch(() => {});
  return () => deleteDoc(doc(colFor(list), id)).catch(() => {});
}

function markBought(list, item, rowEl) {
  if (rowEl) rowEl.classList.add("done-anim");
  const prev = { status: item.status, boughtUid: item.boughtUid || null, boughtName: item.boughtName || null, boughtAt: item.boughtAt || null };
  const pItem = list === "casa" && item.pantryId ? state.data.pantry.find(p => p.id === item.pantryId) : null;
  setTimeout(() => {
    write(list, item.id, { status: "ok", boughtUid: state.uid, boughtName: state.me, boughtAt: Date.now() }).catch(() => {});
    if (pItem) write("pantry", pItem.id, { qty: increment(1), updatedAt: Date.now() }).catch(() => {});
    showToast(pItem ? `Preso: ${item.name} (+1 in dispensa)` : `Preso: ${item.name}`, () => {
      write(list, item.id, prev).catch(() => {});
      if (pItem) write("pantry", pItem.id, { qty: increment(-1) }).catch(() => {});
    });
  }, 180);
}
function removeItem(kind, item) {
  const copy = { ...item }; delete copy.id;
  deleteDoc(doc(colFor(kind), item.id)).catch(e => handleWriteError(e, kind));
  showToast(`Eliminato: ${item.name}`, () => write(kind, item.id, copy, true).catch(() => {}));
}

$("shop-list").addEventListener("click", e => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const list = state.list;
  const item = state.data[list].find(i => i.id === b.dataset.id);
  if (!item) return;
  const act = b.dataset.act;
  if (act === "buy") markBought(list, item, b.closest(".item"));
  else if (act === "urg") write(list, item.id, { status: item.status === "out" ? "low" : "out" }).catch(() => {});
  else if (act === "again") write(list, item.id, { status: "out", ...whoFields() }).catch(() => {});
  else if (act === "del") askDelete(item.id);
  else if (act === "del-yes") { pendingDel = null; removeItem(list, item); }
});
function askDelete(id) {
  pendingDel = id; renderData();
  setTimeout(() => { if (pendingDel === id) { pendingDel = null; renderData(); } }, 3500);
}

function renderShop() {
  const list = state.list;
  document.querySelectorAll("#view-shop .seg2 button").forEach(t => t.setAttribute("aria-selected", String(t.dataset.list === list)));
  $("shop-hint").textContent = list === "casa"
    ? "Lista condivisa: la vede e la modifica chi ha il codice di casa."
    : "Lista personale: la vedi solo tu, su questo telefono.";
  for (const l of ["casa", "mio"]) {
    const n = state.data[l].filter(i => i.status !== "ok").length;
    const el = $("count-" + l); el.textContent = n; el.classList.toggle("zero", n === 0);
  }

  const items = state.data[list];
  const counts = {};
  items.forEach(i => { if (i.status !== "ok") counts[i.cat] = (counts[i.cat] || 0) + 1; });
  const fopts = [{ id: "all", label: "Tutto" }, ...CATS.filter(c => counts[c.id] || state.filter === c.id)];
  $("shop-filters").hidden = fopts.length < 3;
  $("shop-filters").innerHTML = fopts.map(c =>
    `<button type="button" data-f="${c.id}" data-c="${c.id}" aria-pressed="${state.filter === c.id}">${c.id !== "all" ? `<span class="dot"></span>` : ""}${c.label}${c.id !== "all" ? ` · ${counts[c.id] || 0}` : ""}</button>`).join("");

  const showWho = list === "casa";
  const who = (uid, name) => uid && uid === state.uid ? "te" : (name || "qualcuno");
  const parts = [];
  if (state.problems.shop) parts.push(`<div class="notice error">${esc(state.problems.shop)}</div>`);
  if (!state.loaded[list]) {
    $("shop-list").innerHTML = parts.join("") + `<div class="empty"><strong>Sto caricando la lista</strong>Tra un attimo vedi cosa manca in casa.</div>`;
    return;
  }
  const match = i => state.filter === "all" || i.cat === state.filter;
  const need = items.filter(i => i.status !== "ok" && match(i))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "out" ? -1 : 1) || (b.at || 0) - (a.at || 0));
  const home = items.filter(i => i.status === "ok" && match(i)).sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));
  const outN = need.filter(i => i.status === "out").length, lowN = need.length - outN;

  let sec = `<section><h2 class="section-title">Da comprare <small>${need.length ? `${outN} finiti · ${lowN} in esaurimento` : ""}</small></h2>`;
  if (!need.length) {
    sec += items.length
      ? `<div class="empty"><span class="kao" lang="ko">ㅎㅎ</span><strong>Non manca niente</strong>${state.filter === "all" ? "Quando qualcosa finisce, scrivilo qui sopra o toccalo tra le cose in casa." : "Niente da comprare in questa categoria."}</div>`
      : `<div class="empty"><span class="kao" lang="ko">ㅠㅠ</span><strong>La lista è vuota</strong>Scrivi qui sopra la prima cosa finita, per esempio “carta igienica” o “latte”.${list === "casa" ? " Chi ha il codice di casa la vedrà subito." : ""}</div>`;
  } else {
    for (const c of CATS) {
      const g = need.filter(i => (catById[i.cat] ? i.cat : "altro") === c.id);
      if (!g.length) continue;
      sec += `<div class="group" data-c="${c.id}"><h3><span class="dot"></span>${c.label}</h3>`;
      for (const i of g) {
        const meta = [];
        if (i.note) meta.push(`<span>${esc(i.note)}</span>`);
        if (showWho) meta.push(`<span>segnato da <b>${esc(who(i.byUid, i.byName))}</b> ${ago(i.at)}</span>`);
        else if (i.at) meta.push(`<span>${ago(i.at)}</span>`);
        if (i.pantryId) meta.push(`<span>dalla dispensa</span>`);
        const del = pendingDel === i.id
          ? `<button class="confirm-del" data-act="del-yes" data-id="${esc(i.id)}">Elimina</button>`
          : `<button class="icon-btn" data-act="del" data-id="${esc(i.id)}" aria-label="Elimina ${esc(i.name)}">${I.trash}</button>`;
        sec += `<div class="item">
          <button class="check" data-act="buy" data-id="${esc(i.id)}" aria-label="Segna ${esc(i.name)} come comprato">${I.check}</button>
          <div class="body"><div class="name">${esc(i.name)}</div>${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}</div>
          <div class="right"><button class="tag ${i.status === "low" ? "low" : "out"}" data-act="urg" data-id="${esc(i.id)}">${i.status === "low" ? "Sta finendo" : "Finito"}</button>${del}</div>
        </div>`;
      }
      sec += `</div>`;
    }
  }
  sec += `</section>`;
  parts.push(sec);

  if (home.length) {
    let h = `<section><h2 class="section-title">In casa <small>${home.length}</small></h2>
      <p class="hint" style="margin:0 4px 8px">Le cose già comprate restano qui. Quando finiscono di nuovo, tocca “Finito”.</p><div class="home">`;
    for (const i of home) {
      const t = showWho && i.boughtAt ? `Preso da ${who(i.boughtUid, i.boughtName)} ${ago(i.boughtAt)}` : (i.boughtAt ? `Preso ${ago(i.boughtAt)}` : "");
      h += `<span class="chip" data-c="${catById[i.cat] ? i.cat : "altro"}" title="${esc(t)}"><span class="dot"></span><span class="label">${esc(i.name)}</span>`;
      h += pendingDel === i.id
        ? `<button class="confirm-del" data-act="del-yes" data-id="${esc(i.id)}">Elimina</button>`
        : `<button data-act="again" data-id="${esc(i.id)}">Finito</button><button class="x" data-act="del" data-id="${esc(i.id)}" aria-label="Elimina ${esc(i.name)}">✕</button>`;
      h += `</span>`;
    }
    h += `</div></section>`;
    parts.push(h);
  }
  $("shop-list").innerHTML = parts.join("");
}
$("shop-filters").addEventListener("click", e => {
  const b = e.target.closest("button[data-f]"); if (!b) return;
  state.filter = state.filter === b.dataset.f ? "all" : b.dataset.f; renderData();
});

// ======================================================================
// DISPENSA
// ======================================================================
$("pantry-scan").innerHTML = I.scan;
$("pantry-add").innerHTML = `${I.plus}<span>Aggiungi</span>`;
$("pantry-search").addEventListener("input", e => { state.search = e.target.value; renderData(); });
$("pantry-add").addEventListener("click", () => openPantrySheet(null));
$("pantry-scan").addEventListener("click", async () => {
  const r = await scanAndLookup();
  if (!r) return;
  const existing = state.data.pantry.find(p => p.barcode === r.code) || (r.name && state.data.pantry.find(p => norm(p.name) === norm(r.name)));
  if (existing) {
    write("pantry", existing.id, { qty: increment(1), updatedAt: Date.now() }).catch(() => {});
    showToast(`+1 ${existing.name} in ${zoneById[existing.zone]?.label || "dispensa"}`, () => write("pantry", existing.id, { qty: increment(-1) }).catch(() => {}));
    return;
  }
  openPantrySheet(null, r);
});
$("pantry-filters").addEventListener("click", e => {
  const b = e.target.closest("button[data-f]"); if (!b) return;
  state.zone = state.zone === b.dataset.f ? "all" : b.dataset.f; renderData();
});

function changeQty(item, delta) {
  const qty = Math.max(0, (Number(item.qty) || 0) + delta);
  if (qty === (Number(item.qty) || 0)) return;
  write("pantry", item.id, { qty, updatedAt: Date.now() }).catch(() => {});
  if (qty === 0 && delta < 0) {
    // finito: va nella lista della spesa condivisa
    const undoShop = addToShopping("casa", { name: item.name, cat: ZONE_TO_CAT[item.zone] || "altro", note: item.note || "", status: "out", pantryId: item.id }, true);
    showToast(`${item.name} è finito: aggiunto alla spesa`, () => {
      undoShop();
      write("pantry", item.id, { qty: 1 }).catch(() => {});
    });
  }
}

$("pantry-list").addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-act=edit]")) { e.preventDefault(); e.target.click(); }
});
$("pantry-list").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const item = state.data.pantry.find(p => p.id === b.dataset.id);
  if (!item) return;
  const act = b.dataset.act;
  if (act === "inc") changeQty(item, +1);
  else if (act === "dec") changeQty(item, -1);
  else if (act === "edit") openPantrySheet(item);
  else if (act === "toshop") {
    const undo = addToShopping("casa", { name: item.name, cat: ZONE_TO_CAT[item.zone] || "altro", note: item.note || "", status: "out", pantryId: item.id }, true);
    showToast(`${item.name} aggiunto alla spesa`, undo);
  }
});

function renderPantry() {
  const items = state.data.pantry;
  const q = norm(state.search);
  // in scadenza (entro 3 giorni, o già scaduti)
  const exp = items.filter(p => (Number(p.qty) || 0) > 0 && daysLeft(p.expiry) != null && daysLeft(p.expiry) <= 3)
    .sort((a, b) => daysLeft(a.expiry) - daysLeft(b.expiry));
  $("pantry-expiring").innerHTML = exp.length
    ? `<div class="expiring"><h2>${exp.length === 1 ? "1 cosa da consumare presto" : `${exp.length} cose da consumare presto`}</h2>
       <ul>${exp.map(p => { const n = daysLeft(p.expiry); return `<li>${esc(p.name)} · ${n < 0 ? "scaduto" : n === 0 ? "oggi" : n === 1 ? "domani" : `${n} gg`}</li>`; }).join("")}</ul></div>`
    : "";

  const counts = {};
  items.forEach(p => { counts[p.zone] = (counts[p.zone] || 0) + 1; });
  $("pantry-filters").innerHTML = [{ id: "all", label: "Tutto" }, ...ZONES].map(z =>
    `<button type="button" data-f="${z.id}" data-z="${z.id}" aria-pressed="${state.zone === z.id}">${z.id !== "all" ? `<span class="dot"></span>` : ""}${z.label}${z.id !== "all" ? ` · ${counts[z.id] || 0}` : ""}</button>`).join("");

  const parts = [];
  if (state.problems.pantry) parts.push(`<div class="notice error">${esc(state.problems.pantry)}</div>`);
  if (!state.loaded.pantry) {
    $("pantry-list").innerHTML = parts.join("") + `<div class="empty"><strong>Sto aprendo la dispensa</strong>Un attimo…</div>`;
    return;
  }
  if (!items.length) {
    parts.push(`<div class="empty"><span class="kao" lang="ko">텅 빈</span><strong>La dispensa è vuota</strong>Tocca “Aggiungi” o scansiona il codice a barre di un prodotto. Dividi le cose tra frigo, freezer, credenza, pulizia e bagno, così sapete sempre cosa c’è in casa.</div>`);
    $("pantry-list").innerHTML = parts.join("");
    return;
  }
  const visible = items.filter(p => (state.zone === "all" || p.zone === state.zone) && (!q || norm(p.name).includes(q) || norm(p.note).includes(q)));
  if (!visible.length) {
    parts.push(`<div class="empty"><strong>Nessun risultato</strong>${q ? `Niente che corrisponda a “${esc(state.search)}”.` : "Questa zona è vuota."}</div>`);
    $("pantry-list").innerHTML = parts.join("");
    return;
  }
  const sorter = (a, b) => ((Number(b.qty) > 0) - (Number(a.qty) > 0))
    || ((daysLeft(a.expiry) ?? 9999) - (daysLeft(b.expiry) ?? 9999))
    || a.name.localeCompare(b.name, "it");
  for (const z of ZONES) {
    const g = visible.filter(p => (zoneById[p.zone] ? p.zone : "credenza") === z.id).sort(sorter);
    if (!g.length) continue;
    let s = `<div class="group" data-z="${z.id}"><div class="zone-head"><h3><span class="dot"></span>${z.label}</h3></div>`;
    for (const p of g) {
      const qty = Number(p.qty) || 0;
      const meta = [];
      if (p.note) meta.push(`<span>${esc(p.note)}</span>`);
      if (qty > 0 && p.expiry) meta.push(expLabel(p.expiry));
      if (qty === 0) meta.push(`<span>esaurito</span>`);
      const inShop = state.data.casa.some(i => i.status !== "ok" && (i.pantryId === p.id || norm(i.name) === norm(p.name)));
      const right = qty === 0 && !inShop
        ? `<button class="tag out" data-act="toshop" data-id="${esc(p.id)}">In lista</button>`
        : "";
      s += `<div class="item p-item${qty === 0 ? " empty-qty" : ""}" data-z="${z.id}">
        <span class="left-mark"></span>
        <div class="body tap" data-act="edit" data-id="${esc(p.id)}" role="button" tabindex="0" aria-label="Modifica ${esc(p.name)}">
          <div class="name">${esc(p.name)}</div>${meta.length ? `<div class="meta">${meta.join("")}${inShop ? "<span>in lista</span>" : ""}</div>` : (inShop ? `<div class="meta"><span>in lista</span></div>` : "")}
        </div>
        <div class="right">${right}
          <div class="stepper" aria-label="Quantità">
            <button data-act="dec" data-id="${esc(p.id)}" aria-label="Uno in meno di ${esc(p.name)}">${I.minus}</button>
            <output>${qty}</output>
            <button data-act="inc" data-id="${esc(p.id)}" aria-label="Uno in più di ${esc(p.name)}">${I.plus}</button>
          </div>
        </div>
      </div>`;
    }
    s += `</div>`;
    parts.push(s);
  }
  $("pantry-list").innerHTML = parts.join("");
}

// foglio per aggiungere / modificare un prodotto in dispensa
function openPantrySheet(item, scanned) {
  closeSheet();
  const isNew = !item;
  const d = item ? { ...item } : {
    name: scanned?.name || "", zone: scanned?.zone || (state.zone !== "all" ? state.zone : CAT_TO_ZONE[guessCat(scanned?.name || "")] || "credenza"),
    qty: 1, expiry: "", note: scanned?.note || "", barcode: scanned?.code || null,
  };
  let zoneTouched = !!(item || scanned?.zone);
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.innerHTML = `
    <form class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" autocomplete="off">
      <div class="grab"></div>
      <h2 id="sheet-title">${isNew ? "Aggiungi in dispensa" : "Modifica prodotto"}</h2>
      ${isNew && !scanned ? `<button type="button" class="btn lilac scan-big" data-scan>${I.scan}<span>Scansiona codice a barre</span></button>` : ""}
      ${scanned ? (scanned.name
        ? `<div class="found">Trovato${scanned.source === "casa" ? " tra i vostri prodotti" : ""}: controlla e salva.</div>`
        : `<div class="found miss">Codice ${esc(scanned.code)} non trovato nei database. Scrivi il nome: la prossima volta lo riconosco.</div>`) : ""}
      <div class="field"><label for="ps-name">Nome</label>
        <input type="text" id="ps-name" maxlength="80" required value="${esc(d.name)}" placeholder="es. Yogurt greco"></div>
      <div class="field"><span class="lbl">Dove sta</span>
        <div class="zones" role="group" aria-label="Zona">${ZONES.map(z => `<button type="button" data-zone="${z.id}" data-z="${z.id}" aria-pressed="${d.zone === z.id}"><span class="dot"></span>${z.label}</button>`).join("")}</div></div>
      <div class="row">
        <div class="field"><span class="lbl">Quantità</span>
          <div class="stepper" style="align-self:start"><button type="button" data-q="-1" aria-label="Meno">${I.minus}</button><output id="ps-qty">${Number(d.qty) || 0}</output><button type="button" data-q="1" aria-label="Più">${I.plus}</button></div></div>
        <div class="field grow"><label for="ps-exp">Scadenza (facoltativa)</label>
          <input type="date" id="ps-exp" value="${esc(d.expiry || "")}"></div>
      </div>
      <div class="field"><label for="ps-note">Nota</label>
        <input type="text" id="ps-note" maxlength="120" value="${esc(d.note || "")}" placeholder="marca, formato, aperto il…"></div>
      <div class="field"><span class="lbl">Codice a barre</span>
        <div class="barcode-line"><code id="ps-code">${d.barcode ? esc(d.barcode) : "nessuno"}</code><button type="button" class="btn soft" data-rescan>${I.scan}<span>${d.barcode ? "Cambia" : "Scansiona"}</span></button></div></div>
      <div class="row">
        <button type="submit" class="btn grow">${isNew ? "Aggiungi" : "Salva"}</button>
        <button type="button" class="btn soft grow" data-cancel>Annulla</button>
      </div>
      ${isNew ? "" : `<button type="button" class="btn danger" data-delete>${I.trash}<span>Elimina dalla dispensa</span></button>`}
    </form>`;
  $("sheet-root").appendChild(scrim);
  document.body.style.overflow = "hidden";
  const form = scrim.querySelector("form");
  const nameIn = form.querySelector("#ps-name");
  if (!d.name) setTimeout(() => nameIn.focus(), 250);

  const setZone = z => { d.zone = z; form.querySelectorAll("[data-zone]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.zone === z))); };
  form.querySelectorAll("[data-zone]").forEach(b => b.addEventListener("click", () => { zoneTouched = true; setZone(b.dataset.zone); }));
  nameIn.addEventListener("input", () => { if (!zoneTouched) { const c = guessCat(nameIn.value); if (c) setZone(CAT_TO_ZONE[c]); } });
  form.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => {
    d.qty = Math.max(0, Math.min(999, (Number(d.qty) || 0) + Number(b.dataset.q)));
    form.querySelector("#ps-qty").textContent = d.qty;
  }));
  const applyScan = r => {
    d.barcode = r.code;
    form.querySelector("#ps-code").textContent = r.code;
    if (r.name && !nameIn.value.trim()) nameIn.value = r.name;
    const noteIn = form.querySelector("#ps-note");
    if (r.note && !noteIn.value.trim()) noteIn.value = r.note;
    if (r.zone && !zoneTouched) setZone(r.zone);
    if (!r.name) showToast("Prodotto non trovato: scrivi tu il nome");
  };
  form.querySelector("[data-scan]")?.addEventListener("click", async () => { const r = await scanAndLookup(); if (r) applyScan(r); });
  form.querySelector("[data-rescan]").addEventListener("click", async () => { const r = await scanAndLookup(); if (r) applyScan(r); });
  form.querySelector("[data-cancel]").addEventListener("click", closeSheet);
  scrim.addEventListener("click", e => { if (e.target === scrim) closeSheet(); });
  form.querySelector("[data-delete]")?.addEventListener("click", e => {
    const b = e.currentTarget;
    if (b.dataset.sure) { closeSheet(); removeItem("pantry", item); return; }
    b.dataset.sure = "1"; b.querySelector("span").textContent = "Tocca di nuovo per eliminare";
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = nameIn.value.trim().replace(/\s+/g, " ");
    if (!name) { nameIn.focus(); return; }
    const data = {
      name, zone: d.zone, qty: Number(d.qty) || 0,
      expiry: form.querySelector("#ps-exp").value || null,
      note: form.querySelector("#ps-note").value.trim(),
      barcode: d.barcode || null,
      updatedAt: Date.now(),
    };
    if (isNew) {
      const dup = state.data.pantry.find(p => norm(p.name) === norm(name) && p.zone === data.zone);
      if (dup) {
        write("pantry", dup.id, { qty: increment(data.qty), updatedAt: Date.now(), ...(data.expiry ? { expiry: data.expiry } : {}), ...(data.barcode ? { barcode: data.barcode } : {}) }).catch(() => {});
        showToast(`${dup.name} c’era già: quantità aumentata`);
      } else {
        write("pantry", doc(colFor("pantry")).id, { ...data, byUid: state.uid, byName: state.me, at: Date.now() }, true).catch(() => {});
        showToast(`${name} aggiunto in ${zoneById[data.zone].label}`);
      }
    } else {
      write("pantry", item.id, data).catch(() => {});
    }
    if (data.barcode) rememberBarcode(data.barcode, { name, zone: data.zone, cat: ZONE_TO_CAT[data.zone], note: data.note });
    closeSheet();
  });
  addEventListener("keydown", escClose);
}
function escClose(e) { if (e.key === "Escape") closeSheet(); }
function closeSheet() {
  $("sheet-root").innerHTML = "";
  document.body.style.overflow = "";
  removeEventListener("keydown", escClose);
}

// ======================================================================
// AVVIO, CONDIVISIONE, NAVIGAZIONE
// ======================================================================
$("refresh-btn").innerHTML = I.refresh;
$("settings-btn").innerHTML = I.share;
$("ptr-icon").innerHTML = I.arrow;
$("tab-ico-spesa").innerHTML = I.cart;
$("tab-ico-dispensa").innerHTML = I.shelf;
document.querySelectorAll("#tabbar [data-tab]").forEach(b => b.addEventListener("click", () => {
  if (state.view !== "app") { state.view = "app"; state.justCreated = false; }
  state.tab = b.dataset.tab; store.set("onf-section", state.tab);
  render(); scrollTo(0, 0);
}));
$("settings-btn").addEventListener("click", () => { state.view = state.view === "settings" ? "app" : "settings"; render(); });

function renderSetup() {
  $("view-setup").innerHTML = `
    <div class="panel">
      <h2>Benvenuto <span lang="ko" style="font-family:var(--font-ko)">환영해요</span></h2>
      <p>Segnate qui cosa finisce in casa e cosa c’è in dispensa. Una persona crea la lista, l’altra entra con il codice.</p>
      <div class="field"><label for="setup-name">Come ti chiami?</label>
        <input id="setup-name" type="text" maxlength="30" placeholder="es. Giulia" value="${esc(state.me)}" autocomplete="given-name"></div>
      <button class="btn" id="setup-create" type="button">Crea una nuova lista di casa</button>
      <div class="or">oppure</div>
      <div class="field"><label for="setup-code">Hai ricevuto un codice o un link?</label>
        <input id="setup-code" type="text" placeholder="XXXX-XXXX-XXXX-XXXX" value="${esc(state.code || "")}" autocapitalize="characters" autocomplete="off" spellcheck="false"></div>
      <button class="btn soft" id="setup-join" type="button">Entra nella lista</button>
      <p id="setup-err" class="notice error" hidden></p>
    </div>`;
  const err = t => { $("setup-err").textContent = t; $("setup-err").hidden = false; };
  const saveName = () => {
    const n = $("setup-name").value.trim();
    if (!n) { err("Scrivi il tuo nome: serve all’altra persona per sapere chi ha segnato cosa."); return false; }
    state.me = n; store.set("onf-name", n); return true;
  };
  $("setup-create").addEventListener("click", () => {
    if (!saveName()) return;
    state.code = newCode(); store.set("onf-code", state.code);
    state.view = "settings"; state.justCreated = true; startLists(); render();
  });
  $("setup-join").addEventListener("click", () => {
    if (!saveName()) return;
    const c = parseCode($("setup-code").value);
    if (!c) { err("Il codice non è valido. Deve avere 16 caratteri, come ABCD-EFGH-JKLM-NPQR."); return; }
    state.code = c; store.set("onf-code", c);
    state.view = "app"; startLists(); render();
  });
}

function renderSettings() {
  $("view-settings").innerHTML = `
    <div class="panel">
      <h2>${state.justCreated ? "Lista creata!" : "Condividi e impostazioni"}</h2>
      <p>Per usare l’app in due, manda questo link all’altra persona. Chi ha il codice può leggere e modificare la lista “Casa” e la dispensa, quindi tenetelo tra voi.</p>
      <div class="code" id="invite-code">${esc(state.code)}</div>
      <div class="row">
        <button class="btn grow" id="copy-link" type="button">Copia link d’invito</button>
        <button class="btn soft grow" id="share-link" type="button" ${navigator.share ? "" : "hidden"}>Condividi…</button>
      </div>
      <p style="font-size:13px">Sull’iPhone dell’altra persona:</p>
      <ol class="steps">
        <li>Apre il link in Safari e tocca Condividi → <b>Aggiungi alla schermata Home</b>.</li>
        <li>Apre l’app dall’icona e, se lo chiede, incolla il codice qui sopra.</li>
      </ol>
      <div class="field"><label for="set-name">Il tuo nome</label>
        <input id="set-name" type="text" maxlength="30" value="${esc(state.me)}"></div>
      <div class="row">
        <button class="btn grow" id="settings-done" type="button">Torna alla lista</button>
        <button class="btn danger grow" id="leave" type="button">Esci da questa casa</button>
      </div>
      <p id="leave-confirm" hidden style="font-size:13px">Uscendo, su questo telefono non vedrai più lista e dispensa di casa finché non reinserisci il codice. I dati restano salvati per l’altra persona. <button class="confirm-del" id="leave-yes" type="button">Esci</button></p>
    </div>`;
  $("copy-link").addEventListener("click", () => {
    const link = inviteLink();
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents($("invite-code"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); showToast("Copia il codice selezionato");
    };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => showToast("Link copiato"), fallback);
    else fallback();
  });
  $("share-link").addEventListener("click", () => {
    navigator.share({ title: "Oh no, è finito!", text: "Entra nella nostra lista di casa:", url: inviteLink() }).catch(() => {});
  });
  $("set-name").addEventListener("change", e => {
    const n = e.target.value.trim(); if (n) { state.me = n; store.set("onf-name", n); showToast("Nome salvato"); }
  });
  $("settings-done").addEventListener("click", () => { state.justCreated = false; state.view = "app"; render(); });
  $("leave").addEventListener("click", () => { $("leave-confirm").hidden = false; });
  $("leave-yes").addEventListener("click", () => {
    unsubs.forEach(u => u()); unsubs = [];
    state.code = null; store.set("onf-code", null);
    state.data = { casa: [], mio: [], pantry: [] }; state.loaded = { casa: false, mio: false, pantry: false };
    state.view = "setup"; render();
  });
}

function renderBadges() {
  const need = state.data.casa.filter(i => i.status !== "ok").length + state.data.mio.filter(i => i.status !== "ok").length;
  const exp = state.data.pantry.filter(p => (Number(p.qty) || 0) > 0 && daysLeft(p.expiry) != null && daysLeft(p.expiry) <= 3).length;
  $("badge-spesa").textContent = need; $("badge-spesa").hidden = !need;
  $("badge-dispensa").textContent = exp; $("badge-dispensa").hidden = !exp;
}

/** Ridisegna solo le parti che dipendono dai dati (non tocca i campi dove si sta scrivendo). */
function renderData() {
  if (state.view !== "app") { renderBadges(); return; }
  if (state.tab === "spesa") renderShop(); else renderPantry();
  renderBadges();
}
let lastView = null;
function render() {
  const v = state.view;
  $("view-boot").hidden = v !== "boot";
  $("view-setup").hidden = v !== "setup";
  $("view-settings").hidden = v !== "settings";
  $("view-shop").hidden = !(v === "app" && state.tab === "spesa");
  $("view-pantry").hidden = !(v === "app" && state.tab === "dispensa");
  $("tabbar").hidden = !(v === "app" || v === "settings");
  $("refresh-btn").hidden = v !== "app";
  $("settings-btn").hidden = !(v === "app" || v === "settings");
  document.querySelectorAll("#tabbar [data-tab]").forEach(b => b.setAttribute("aria-selected", String(v === "app" && b.dataset.tab === state.tab)));
  if (v !== lastView) {
    if (v === "setup") renderSetup();
    if (v === "settings") renderSettings();
    lastView = v;
  }
  renderData();
}
setInterval(() => { if (document.visibilityState === "visible") renderData(); }, 60000);

// riaprendo l'app dopo un po', ricollega le liste
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000 && state.view === "app" && state.code) startLists();
});

const bootTimer = setTimeout(() => {
  if (!state.uid) {
    $("view-boot").innerHTML = `<strong>Non riesco a collegarmi</strong>Controlla la connessione e riapri l’app.`;
    $("sync").dataset.state = "error";
  }
}, 10000);

onAuthStateChanged(auth, user => {
  if (!user) {
    signInAnonymously(auth).catch(e => {
      console.error(e);
      clearTimeout(bootTimer);
      $("view-boot").innerHTML = `<strong>Accesso non riuscito</strong>${esc(e.code || "errore")}. Controlla la connessione e riapri l’app.`;
      $("sync").dataset.state = "error";
    });
    return;
  }
  clearTimeout(bootTimer);
  const first = !state.uid;
  state.uid = user.uid;
  if (!first) return;
  setSync();
  if (state.code && state.me) { state.view = "app"; startLists(); }
  else state.view = "setup";
  render();
});

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
