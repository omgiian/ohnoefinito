import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, increment, writeBatch, deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AVATARS, AVATAR_COLORS, avatarSvg, randomAvatar } from "./avatars.js";
import { PRODUCT_ICONS, iconIdFor, productIconSvg } from "./icons.js";

const firebaseConfig = {
  apiKey: "AIzaSyBlEXrtxHlq5NIEuqpiGZbquUzWvPMcOiE",
  authDomain: "ohnoefinito.firebaseapp.com",
  projectId: "ohnoefinito",
  storageBucket: "ohnoefinito.firebasestorage.app",
  messagingSenderId: "251015979077",
  appId: "1:251015979077:web:5c6c4b902cddf6b4a1032c",
};

// notifiche push: il servizio su Cloudflare (cartella push-worker/) e la sua chiave pubblica VAPID
const PUSH_URL = "https://ohnoefinito-push.ohnoefinito.workers.dev/notify";
const VAPID_PUBLIC = "BEVB5lq1aQkONraQ9bCqC0dFnOCHMsiHW_uZRv1BBRLLFYill2BSYEk_4tbSoZcUbpCBKVxx7XcSQC7Iz2OAr8g";

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
  chevL: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  chevD: `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  basketSm: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 9.5h19l-2 9.6a2.2 2.2 0 0 1-2.2 1.8H6.7a2.2 2.2 0 0 1-2.2-1.8z"/><path d="M7.5 9.5 12 3.8l4.5 5.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7.5 12 3l9 4.5-9 4.5z"/><path d="M3 9.2l8.2 4.1v7.7L3 16.9zM21 9.2l-8.2 4.1v7.7l8.2-4.1z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M12 7v5.3l3.4 2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  alert: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M12 7v6.2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.4" fill="#fff"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="8" r="3.6"/><path d="M2.5 19.5c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6z"/><circle cx="17" cy="9" r="2.8"/><path d="M16.4 14.1c2.9.1 4.7 1.8 5.2 4.9h-4.3c-.2-1.9-.7-3.5-.9-4.9z"/></svg>`,
  tabBasket: `<svg viewBox="0 0 32 32" fill="currentColor"><path d="M3 12.5h26l-2.6 12.8A3 3 0 0 1 23.5 28h-15a3 3 0 0 1-2.9-2.7z"/><path d="M9.5 12.5 16 4.5l6.5 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 16.5v7M16 16.5v7M21 16.5v7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  tabPantry: `<svg viewBox="0 0 32 32" fill="currentColor"><rect x="5" y="3" width="22" height="26" rx="3.5"/><path d="M5 12.5h22M5 21h22" stroke="#fff" stroke-width="2.2"/><path d="M10 7.8h4M10 16.8h3M10 25.2h3.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  tabScan: `<svg viewBox="0 0 32 32" fill="currentColor"><rect x="3.5" y="5.5" width="25" height="21" rx="4"/><path d="M9 10.5v11M12.5 10.5v11M16.5 10.5v11M19.5 10.5v11M23 10.5v11" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/></svg>`,
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
  pview: "zone", psort: "scad", pfilter: "", syncState: "wait",
  data: { casa: [], mio: [], pantry: [] },
  loaded: { casa: false, mio: false, pantry: false },
  server: { casa: false, mio: false, pantry: false },
  pending: false,
  uid: null, code: store.get("onf-code"), me: store.get("onf-name") || "",
  problems: { shop: null, pantry: null }, justCreated: false,
  look: loadLook(), members: [], house: null, pushSubs: [],
};
function loadLook() {
  try {
    const l = JSON.parse(store.get("onf-look") || "null");
    if (l && AVATARS.some(a => a.id === l.avatar) && AVATAR_COLORS.some(c => c.id === l.color)) return l;
  } catch (_) {}
  const l = randomAvatar();
  store.set("onf-look", JSON.stringify(l));
  return l;
}
let unsubs = [], pendingDel = null, toastTimer = null, undoFn = null, refreshing = false, serverWaiters = [];

// aperta toccando una notifica: va alla lista "Casa"
if (location.hash === "#spesa") {
  state.tab = "spesa"; state.list = "casa";
  history.replaceState(null, "", location.pathname);
}
navigator.serviceWorker?.addEventListener("message", e => {
  if (e.data && e.data.type === "open" && state.code && state.me) {
    state.view = "app"; state.tab = "spesa"; state.list = "casa"; render(); scrollTo(0, 0);
  }
});

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
    setSyncState("error");
    renderData();
  });
  unsubs.push(unsub);
}
function startLists() {
  unsubs.forEach(u => u()); unsubs = [];
  state.server = { casa: false, mio: false, pantry: false };
  state.problems = { shop: null, pantry: null };
  subscribe("casa"); subscribe("mio"); subscribe("pantry");
  subscribeHouse();
  syncMe();
  syncPush();
}

// ---------- casa e componenti ----------
function subscribeHouse() {
  unsubs.push(onSnapshot(collection(fs, "households", state.code, "members"), snap => {
    state.members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.view === "settings") renderMembers();
    renderData();
  }, err => console.warn("members", err)));
  unsubs.push(onSnapshot(doc(fs, "households", state.code), snap => {
    state.house = snap.exists() ? snap.data() : null;
    updateHouseName();
  }, err => console.warn("house", err)));
  unsubs.push(onSnapshot(collection(fs, "households", state.code, "push"), snap => {
    state.pushSubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.view === "settings") renderPushPanel();
  }, err => console.warn("push", err)));
}
// ======================================================================
// NOTIFICHE PUSH
// ======================================================================
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function b64urlToBytes(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function currentPushSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
function saveSubscription(sub) {
  const j = sub.toJSON();
  return setDoc(doc(fs, "households", state.code, "push", state.uid), {
    endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, name: state.me, at: Date.now(),
  });
}
/** All'avvio: se le notifiche sono attive, aggiorna l'iscrizione salvata (può cambiare nel tempo). */
async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== "granted" || !state.code || !state.uid) return;
    const sub = await currentPushSub();
    if (sub) await saveSubscription(sub);
  } catch (e) { console.warn("push sync", e); }
}
async function pushStatus() {
  if (!pushSupported()) return isIOS && !isStandalone() ? "need-home" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = Notification.permission === "granted" ? await currentPushSub() : null;
  return sub ? "on" : "off";
}
async function enablePush() {
  let perm;
  try { perm = await Notification.requestPermission(); } catch (_) { perm = Notification.permission; }
  if (perm !== "granted") { renderPushPanel(); return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(VAPID_PUBLIC) });
    await saveSubscription(sub);
    showToast("Notifiche attive su questo telefono");
  } catch (e) {
    console.error(e);
    showToast(e && e.code === "permission-denied"
      ? "Non riesco a salvare: aggiorna le regole di Firestore (vedi README)"
      : "Non riesco ad attivare le notifiche. Riprova tra poco.");
  }
  renderPushPanel();
}
async function disablePush() {
  try { const sub = await currentPushSub(); if (sub) await sub.unsubscribe(); } catch (_) {}
  deleteDoc(doc(fs, "households", state.code, "push", state.uid)).catch(() => {});
  showToast("Notifiche disattivate su questo telefono");
  renderPushPanel();
}
async function postNotify(subs, title, body) {
  const res = await fetch(PUSH_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscriptions: subs.map(s => ({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })),
      title, body, url: "./#spesa", tag: "spesa",
    }),
  });
  if (!res.ok) throw new Error("push " + res.status);
  const out = await res.json();
  // iscrizioni scadute (telefono cambiato, app reinstallata): le togliamo
  for (const gone of out.gone || []) {
    const s = state.pushSubs.find(x => x.endpoint === gone);
    if (s) deleteDoc(doc(fs, "households", state.code, "push", s.id)).catch(() => {});
  }
  return out;
}
async function testPush() {
  try {
    const sub = await currentPushSub();
    if (!sub) { showToast("Prima attiva le notifiche"); return; }
    const j = sub.toJSON();
    const out = await postNotify([{ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }],
      "Funziona!", "Così ti avviso quando manca qualcosa in casa.");
    if (out.sent) { lastPushInfo = ""; showToast("Notifica di prova inviata"); }
    else { lastPushInfo = pushFailureText(out); showToast(lastPushInfo); }
  } catch (e) { console.error(e); lastPushInfo = `Servizio non raggiungibile (${e.message || e})`; showToast("Non riesco a raggiungere il servizio delle notifiche"); }
  renderPushPanel();
}
let lastPushInfo = "";
/** Spiega perché il servizio non ha consegnato la notifica (risposta del servizio push). */
function pushFailureText(out) {
  const r = (out.results || [])[0] || {};
  let host = "";
  try { host = new URL(r.endpoint).hostname; } catch (_) {}
  const svc = /apple/.test(host) ? "Apple" : /google|fcm/.test(host) ? "Google" : /mozilla/.test(host) ? "Mozilla" : host || "il servizio push";
  if (r.status === "invalid") return "Non inviata: iscrizione non valida. Disattiva e riattiva le notifiche.";
  if (r.status === "gone") return "Non inviata: iscrizione scaduta. Disattiva e riattiva le notifiche.";
  let why = "";
  try { why = JSON.parse(r.reason || "{}").reason || ""; } catch (_) { why = (r.reason || "").slice(0, 60); }
  return `Non inviata: ${svc} ha risposto ${r.code ?? "?"}${why ? ` (${why})` : ""}`;
}

// avvisi per gli altri: raccolti per 4 secondi, così più aggiunte diventano una notifica sola
let notifyQueue = [], notifyTimer = null, notifySeq = 0;
function queueNotify(name, status) {
  const key = ++notifySeq;
  notifyQueue.push({ key, name, status });
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(flushNotify, 4000);
  return key;
}
function dropNotify(key) { notifyQueue = notifyQueue.filter(n => n.key !== key); }
async function flushNotify() {
  const items = notifyQueue.splice(0);
  if (!items.length) return;
  const subs = state.pushSubs.filter(s => s.id !== state.uid && s.endpoint && s.p256dh && s.auth);
  if (!subs.length) return;
  const who = state.me || "Qualcuno";
  const names = [...new Set(items.map(i => i.name))];
  const title = names.length === 1 ? `${who} ha aggiunto alla spesa` : `${who} ha aggiunto ${names.length} cose alla spesa`;
  const body = names.length === 1
    ? `${names[0]} · ${items[items.length - 1].status === "low" ? "sta finendo" : "finito"}`
    : names.slice(0, 6).join(", ") + (names.length > 6 ? ` e altre ${names.length - 6}` : "");
  try { await postNotify(subs, title, body); }
  catch (e) {
    console.warn("notify", e);
    // senza rete: riprova quando torna la connessione
    notifyQueue.unshift(...items);
    addEventListener("online", () => { clearTimeout(notifyTimer); notifyTimer = setTimeout(flushNotify, 1500); }, { once: true });
  }
}

async function renderPushPanel() {
  const el = document.getElementById("push-panel");
  if (!el) return;
  const st = await pushStatus();
  const others = state.pushSubs.filter(s => s.id !== state.uid).map(s => memberById(s.id)?.name || s.name || "qualcuno");
  const who = others.length ? `Le ricevono anche: ${others.map(esc).join(", ")}.` : "Anche l’altra persona deve attivarle sul suo telefono.";
  let html = `<h3>Notifiche</h3>`;
  if (st === "need-home") html += `<p>Su iPhone le notifiche funzionano solo se apri l’app dall’icona sulla schermata Home.</p>`;
  else if (st === "unsupported") html += `<p>Questo browser non può ricevere notifiche.</p>`;
  else if (st === "denied") html += `<p>Le notifiche sono bloccate. Su iPhone: Impostazioni › Notifiche › È finito! › Consenti notifiche. Poi riapri l’app.</p>`;
  else if (st === "off") html += `<p>Ricevi un avviso quando qualcuno aggiunge qualcosa alla lista “Casa”.</p>
      <button class="btn" type="button" id="push-on">Attiva le notifiche</button><p style="font-size:13px">${who}</p>`;
  else html += `<p><b>Attive su questo telefono.</b> Ti avviso quando qualcuno aggiunge qualcosa alla lista “Casa”.</p>
      <div class="row"><button class="btn grow" type="button" id="push-test">Prova</button>
      <button class="btn soft grow" type="button" id="push-off">Disattiva</button></div><p style="font-size:13px">${who}</p>`;
  if (lastPushInfo) html += `<p class="push-diag">Ultimo tentativo · ${esc(lastPushInfo)}</p>`;
  el.innerHTML = html;
  el.querySelector("#push-on")?.addEventListener("click", enablePush);
  el.querySelector("#push-test")?.addEventListener("click", testPush);
  el.querySelector("#push-off")?.addEventListener("click", disablePush);
}

/** Salva nome e avatar di questo telefono tra i componenti della casa. */
function syncMe() {
  if (!state.uid || !state.code || !state.me) return;
  const joinedKey = "onf-joined-" + state.code;
  const data = { name: state.me, avatar: state.look.avatar, color: state.look.color, lastSeen: Date.now() };
  if (!store.get(joinedKey)) data.joinedAt = Date.now();
  setDoc(doc(fs, "households", state.code, "members", state.uid), data, { merge: true })
    .then(() => { if (data.joinedAt) store.set(joinedKey, "1"); })
    .catch(e => console.warn("member", e));
}
let syncTimer = null;
const syncMeSoon = () => { clearTimeout(syncTimer); syncTimer = setTimeout(syncMe, 700); };
const memberById = id => state.members.find(m => m.id === id);
function personName(uid, fallback) {
  if (uid && uid === state.uid) return "te";
  return memberById(uid)?.name || fallback || "qualcuno";
}
function lookOf(uid) {
  if (uid && uid === state.uid) return state.look;
  const m = memberById(uid);
  return m && m.avatar ? { avatar: m.avatar, color: m.color } : null;
}
function miniAvatar(uid) {
  const l = lookOf(uid);
  return l ? `<span class="mini-av">${avatarSvg(l.avatar, l.color)}</span>` : "";
}
function houseName() { return (state.house && state.house.name) || "La nostra casa"; }
function updateHouseName() {
  const t = document.getElementById("house-title");
  if (t) t.textContent = houseName();
  const inp = document.getElementById("house-name");
  if (inp && document.activeElement !== inp) inp.value = state.house?.name || "";
}
function updateMeButton() {
  $("tab-ico-casa").innerHTML = avatarSvg(state.look.avatar, state.look.color);
}
function checkServerWaiters() {
  if (state.server.casa && state.server.mio && state.server.pantry) { serverWaiters.forEach(f => f(true)); serverWaiters = []; }
}
const SYNC_LABEL = { wait: "Collegamento in corso", live: "Sincronizzato", pending: "Salvataggio in corso", offline: "Offline: le modifiche verranno salvate appena torna la rete", error: "Non collegato" };
function setSyncState(st) {
  state.syncState = st;
  document.querySelectorAll("[data-act=refresh]").forEach(el => {
    el.dataset.state = st === "offline" ? "pending" : st;
    el.setAttribute("aria-label", `Aggiorna · ${SYNC_LABEL[st] || ""}`);
  });
}
function setSync() {
  const pending = Object.values(state.pendingMap || {}).some(Boolean);
  setSyncState(!navigator.onLine ? "offline" : pending ? "pending" : "live");
}
addEventListener("online", setSync); addEventListener("offline", setSync);

// ---------- intestazione delle pagine: titolo grande e contatori ----------
function headHtml({ title, titleId, sub, stats = [], back }) {
  const st = state.syncState;
  return `<div class="titles">${back ? `<button class="back" type="button" data-act="back">${I.chevL}<span>${esc(back)}</span></button>` : ""}
      <h1${titleId ? ` id="${titleId}"` : ""}>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>
    <div class="stats">${stats.map(x => `<span class="stat${x.alert ? " alert" : ""}" title="${esc(x.label)}" aria-label="${esc(x.label)}">${x.icon}${x.n}</span>`).join("")}
      <button class="icon-round${refreshing ? " spinning" : ""}" type="button" data-act="refresh" data-state="${st === "offline" ? "pending" : st}" aria-label="Aggiorna · ${esc(SYNC_LABEL[st] || "")}">${I.refresh}</button></div>`;
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-act=refresh]")) { refresh(); return; }
  if (e.target.closest("[data-act=back]")) { state.zone = "all"; renderData(); scrollTo(0, 0); }
});

// ---------- aggiorna (pulsante e tirare giù) ----------
async function refresh() {
  if (refreshing || !(state.view === "app" || state.view === "settings")) return;
  refreshing = true;
  document.querySelectorAll("[data-act=refresh]").forEach(b => b.classList.add("spinning"));
  const reached = new Promise(res => { serverWaiters.push(res); setTimeout(() => res(false), 7000); });
  startLists();
  navigator.serviceWorker?.getRegistration().then(r => r && r.update()).catch(() => {});
  const ok = await reached;
  refreshing = false;
  document.querySelectorAll("[data-act=refresh]").forEach(b => b.classList.remove("spinning"));
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
  if (known) { $("toast").hidden = true; return { code, name: known.name, note: known.note || "", zone: known.zone || null, cat: known.cat || null, img: known.img || null, source: "casa" }; }
  const p = await s.lookupProduct(code);
  $("toast").hidden = true;
  if (!p) return { code, name: "", note: "", zone: null, cat: null, img: null, source: null };
  const note = [p.brand, p.quantity].filter(Boolean).join(" · ");
  const zone = s.zoneFromProduct(p) || CAT_TO_ZONE[guessCat(p.name)] || null;
  return { code, name: p.name, note, zone, cat: guessCat(p.name) || (zone ? ZONE_TO_CAT[zone] : null), img: p.img || null, source: p.kind };
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
document.querySelectorAll("#view-shop .utabs button").forEach(t => t.addEventListener("click", () => {
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
    const nk = list === "casa" && existing.status === "ok" ? queueNotify(existing.name, status) : null;
    return () => { if (nk) dropNotify(nk); write(list, existing.id, prev).catch(() => {}); };
  }
  const id = doc(colFor(list)).id;
  const data = { name, cat, note: note || "", status, ...whoFields() };
  if (pantryId) data.pantryId = pantryId;
  write(list, id, data, true).catch(() => {});
  const nk = list === "casa" ? queueNotify(name, status) : null;
  return () => { if (nk) dropNotify(nk); deleteDoc(doc(colFor(list), id)).catch(() => {}); };
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
  else if (act === "again") {
    write(list, item.id, { status: "out", ...whoFields() }).catch(() => {});
    if (list === "casa") queueNotify(item.name, "out");
  }
  else if (act === "del") askDelete(item.id);
  else if (act === "del-yes") { pendingDel = null; removeItem(list, item); }
});
function askDelete(id) {
  pendingDel = id; renderData();
  setTimeout(() => { if (pendingDel === id) { pendingDel = null; renderData(); } }, 3500);
}

function renderShop() {
  const list = state.list;
  document.querySelectorAll("#view-shop .utabs button").forEach(t => t.setAttribute("aria-selected", String(t.dataset.list === list)));
  $("shop-hint").textContent = list === "casa"
    ? "Lista condivisa: la vede e la modifica chi ha il codice di casa."
    : "Lista personale: la vedi solo tu, su questo telefono.";
  for (const l of ["casa", "mio"]) {
    const n = state.data[l].filter(i => i.status !== "ok").length;
    $("count-" + l).textContent = n || "";
  }
  const items = state.data[list];
  const need = items.filter(i => i.status !== "ok")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "out" ? -1 : 1) || (b.at || 0) - (a.at || 0));
  const home = items.filter(i => i.status === "ok").sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));
  const outN = need.filter(i => i.status === "out").length;
  $("shop-head").innerHTML = headHtml({
    title: "Da comprare",
    stats: [
      { icon: I.alert, n: outN, label: `${outN} ${outN === 1 ? "finito" : "finiti"}`, alert: outN > 0 },
      { icon: I.basketSm, n: need.length, label: `${need.length} da comprare` },
    ],
  });

  const showWho = list === "casa";
  const who = (uid, name) => personName(uid, name);
  const parts = [];
  if (state.problems.shop) parts.push(`<div class="notice error">${esc(state.problems.shop)}</div>`);
  if (!state.loaded[list]) {
    $("shop-list").innerHTML = parts.join("") + `<div class="empty"><strong>Sto caricando la lista</strong>Tra un attimo vedi cosa manca in casa.</div>`;
    return;
  }
  if (!need.length) {
    parts.push(items.length
      ? `<div class="empty"><strong>Non manca niente</strong>Quando qualcosa finisce, scrivilo qui sopra o tocca “Finito” tra le cose in casa.</div>`
      : `<div class="empty"><strong>La lista è vuota</strong>Scrivi qui sopra la prima cosa finita, per esempio “carta igienica” o “latte”.${list === "casa" ? " Chi ha il codice di casa la vedrà subito." : ""}</div>`);
  } else {
    let cards = `<div class="cards">`;
    for (const c of CATS) {
      const g = need.filter(i => (catById[i.cat] ? i.cat : "altro") === c.id);
      if (!g.length) continue;
      cards += `<section class="bleed-card" data-c="${c.id}"><div class="card-head"><h2>${c.label}</h2>
        <div class="stats"><span class="stat" aria-label="${g.length} da comprare">${I.basketSm}${g.length}</span></div></div><div class="rows">`;
      for (const i of g) {
        const meta = [];
        if (i.note) meta.push(`<span>${esc(i.note)}</span>`);
        if (showWho) meta.push(`<span>${miniAvatar(i.byUid)}<b>${esc(who(i.byUid, i.byName))}</b> · ${ago(i.at)}</span>`);
        else if (i.at) meta.push(`<span>${ago(i.at)}</span>`);
        if (i.pantryId) meta.push(`<span>dalla dispensa</span>`);
        const del = pendingDel === i.id
          ? `<button class="confirm-del" data-act="del-yes" data-id="${esc(i.id)}">Elimina</button>`
          : `<button class="icon-btn" data-act="del" data-id="${esc(i.id)}" aria-label="Elimina ${esc(i.name)}">${I.trash}</button>`;
        cards += `<div class="item">
          <button class="check" data-act="buy" data-id="${esc(i.id)}" aria-label="Segna ${esc(i.name)} come comprato">${I.check}</button>
          <div class="body"><div class="name">${esc(i.name)}</div>${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}</div>
          <div class="right"><button class="tag ${i.status === "low" ? "low" : "out"}" data-act="urg" data-id="${esc(i.id)}">${i.status === "low" ? "Sta finendo" : "Finito"}</button>${del}</div>
        </div>`;
      }
      cards += `</div></section>`;
    }
    parts.push(cards + `</div>`);
  }
  if (home.length) {
    let h = `<h2 class="section-title">In casa <small>tocca “Finito” quando finisce di nuovo</small></h2><div class="home">`;
    for (const i of home) {
      const t = showWho && i.boughtAt ? `Preso da ${who(i.boughtUid, i.boughtName)} ${ago(i.boughtAt)}` : (i.boughtAt ? `Preso ${ago(i.boughtAt)}` : "");
      h += `<span class="chip" data-c="${catById[i.cat] ? i.cat : "altro"}" title="${esc(t)}"><span class="dot"></span><span class="label">${esc(i.name)}</span>`;
      h += pendingDel === i.id
        ? `<button class="confirm-del" data-act="del-yes" data-id="${esc(i.id)}">Elimina</button>`
        : `<button data-act="again" data-id="${esc(i.id)}">Finito</button><button class="x" data-act="del" data-id="${esc(i.id)}" aria-label="Elimina ${esc(i.name)}">✕</button>`;
      h += `</span>`;
    }
    parts.push(h + `</div>`);
  }
  $("shop-list").innerHTML = parts.join("");
}

// ======================================================================
// DISPENSA
// ======================================================================
$("pantry-add").innerHTML = `${I.plus}<span>Aggiungi</span>`;
document.querySelectorAll("#view-pantry .utabs button").forEach(t => t.addEventListener("click", () => {
  state.pview = t.dataset.pview; state.zone = "all"; renderData(); scrollTo(0, 0);
}));
$("pantry-search").addEventListener("input", e => { state.search = e.target.value; renderData(); });
$("pantry-add").addEventListener("click", () => openPantrySheet(null));
async function scanToPantry() {
  const r = await scanAndLookup();
  if (!r) return;
  const existing = state.data.pantry.find(p => p.barcode === r.code) || (r.name && state.data.pantry.find(p => norm(p.name) === norm(r.name)));
  if (existing) {
    write("pantry", existing.id, { qty: increment(1), updatedAt: Date.now() }).catch(() => {});
    showToast(`+1 ${existing.name} in ${zoneById[existing.zone]?.label || "dispensa"}`, () => write("pantry", existing.id, { qty: increment(-1) }).catch(() => {}));
    return;
  }
  openPantrySheet(null, r);
}
const SORTS = { scad: "Scadenza", nome: "Nome", qty: "Quantità" };
$("pantry-filters").addEventListener("click", e => {
  const b = e.target.closest("button[data-pf]"); if (!b) return;
  const f = b.dataset.pf;
  if (f === "sort") { const k = Object.keys(SORTS); state.psort = k[(k.indexOf(state.psort) + 1) % k.length]; }
  else state.pfilter = state.pfilter === f ? "" : f;
  renderData();
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
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-act=zone]")) { e.preventDefault(); e.target.click(); }
});
$("pantry-list").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  if (b.dataset.act === "zone") { state.zone = b.dataset.id; state.pfilter = ""; renderData(); scrollTo(0, 0); return; }
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

const zoneOf = p => (zoneById[p.zone] ? p.zone : "credenza");
const isExpiring = p => (Number(p.qty) || 0) > 0 && daysLeft(p.expiry) != null && daysLeft(p.expiry) <= 3;
function inShopping(p) {
  return state.data.casa.some(i => i.status !== "ok" && (i.pantryId === p.id || norm(i.name) === norm(p.name)));
}
// disegno del prodotto (scelto a mano, oppure in base al nome e alla zona)
function productPic(p) {
  return productIconSvg(iconIdFor(p.name, zoneOf(p), p.icon));
}
function productCard(p) {
  const qty = Number(p.qty) || 0;
  const inShop = inShopping(p);
  return `<article class="p-card${qty === 0 ? " empty-qty" : ""}" data-z="${zoneOf(p)}">
    <div class="p-top">${qty > 0 && p.expiry ? expLabel(p.expiry) : qty === 0 ? `<span class="exp">esaurito</span>` : ""}<span class="qty" aria-label="Quantità ${qty}">×${qty}</span></div>
    <button class="p-tap" type="button" data-act="edit" data-id="${esc(p.id)}" aria-label="Modifica ${esc(p.name)}">
      <div class="p-pic">${productPic(p)}</div>
      <div class="p-name">${esc(p.name)}</div>${p.note ? `<div class="p-note">${esc(p.note)}</div>` : ""}
    </button>
    <div class="p-actions">
      <div class="mini-step">
        <button type="button" data-act="dec" data-id="${esc(p.id)}" aria-label="Uno in meno di ${esc(p.name)}">${I.minus}</button>
        <button type="button" data-act="inc" data-id="${esc(p.id)}" aria-label="Uno in più di ${esc(p.name)}">${I.plus}</button>
      </div>
      ${inShop
        ? `<button type="button" class="cart-pill" disabled>${I.check}<span>In lista</span></button>`
        : `<button type="button" class="cart-pill" data-act="toshop" data-id="${esc(p.id)}">${I.basketSm}<span>Spesa</span></button>`}
    </div>
  </article>`;
}

function renderPantry() {
  const items = state.data.pantry;
  const detail = state.pview === "zone" && state.zone !== "all" && zoneById[state.zone];
  const homeView = state.pview === "zone" && !detail;
  document.querySelectorAll("#view-pantry .utabs button").forEach(t => t.setAttribute("aria-selected", String(t.dataset.pview === state.pview)));
  $("view-pantry").querySelector(".utabs").hidden = !!detail;

  const scope = detail ? items.filter(p => zoneOf(p) === state.zone) : items;
  const inStock = scope.filter(p => (Number(p.qty) || 0) > 0).length;
  const expN = scope.filter(isExpiring).length;
  $("pantry-head").innerHTML = headHtml({
    title: detail ? detail.label : state.pview === "all" ? "In casa" : "La dispensa",
    back: detail ? "Dispensa" : null,
    sub: detail ? detail.hint : null,
    stats: [
      { icon: I.box, n: inStock, label: `${inStock} prodotti in casa` },
      { icon: I.clock, n: expN, label: `${expN} da consumare presto`, alert: expN > 0 },
    ],
  });
  $("pantry-search-wrap").hidden = state.pview !== "all";
  $("pantry-filters").hidden = homeView;
  if (!homeView) {
    $("pantry-filters").innerHTML = `<button type="button" class="pill" data-pf="sort" aria-label="Ordina per ${SORTS[state.psort]}">${SORTS[state.psort]}${I.chevD}</button>
      <button type="button" class="pill" data-pf="exp" aria-pressed="${state.pfilter === "exp"}">In scadenza</button>
      <button type="button" class="pill" data-pf="out" aria-pressed="${state.pfilter === "out"}">Esauriti</button>`;
  }

  // in scadenza (entro 3 giorni, o già scaduti): solo nella pagina principale
  const exp = homeView ? items.filter(isExpiring).sort((a, b) => daysLeft(a.expiry) - daysLeft(b.expiry)) : [];
  $("pantry-expiring").innerHTML = exp.length
    ? `<div class="expiring"><h2>${exp.length === 1 ? "1 cosa da consumare presto" : `${exp.length} cose da consumare presto`}</h2>
       <ul>${exp.map(p => { const n = daysLeft(p.expiry); return `<li>${esc(p.name)} · ${n < 0 ? "scaduto" : n === 0 ? "oggi" : n === 1 ? "domani" : `${n} gg`}</li>`; }).join("")}</ul></div>`
    : "";

  const parts = [];
  if (state.problems.pantry) parts.push(`<div class="notice error">${esc(state.problems.pantry)}</div>`);
  if (!state.loaded.pantry) {
    $("pantry-list").innerHTML = parts.join("") + `<div class="empty"><strong>Sto aprendo la dispensa</strong>Un attimo…</div>`;
    return;
  }

  if (homeView) {
    // una scheda per zona, con dentro le cose che ci sono
    let cards = `<div class="cards">`;
    for (const z of ZONES) {
      const g = items.filter(p => zoneOf(p) === z.id && (Number(p.qty) || 0) > 0)
        .sort((a, b) => ((daysLeft(a.expiry) ?? 9999) - (daysLeft(b.expiry) ?? 9999)) || (b.updatedAt || 0) - (a.updatedAt || 0));
      const e = g.filter(isExpiring).length;
      const shown = g.slice(0, 8);
      cards += `<div class="bleed-card zone-card" data-z="${z.id}" data-act="zone" data-id="${z.id}" role="button" tabindex="0" aria-label="${z.label}: ${g.length} prodotti">
        <div class="card-head"><h2>${z.label}</h2><div class="stats">
          <span class="stat">${I.box}${g.length}</span>${e ? `<span class="stat alert">${I.clock}${e}</span>` : ""}</div></div>
        ${g.length
          ? `<div class="zone-strip">${shown.map(p => `<div class="thing"><div class="pic">${productPic(p)}</div><div class="tn">${esc(p.name)}${p.qty > 1 ? ` ×${p.qty}` : ""}</div></div>`).join("")}${g.length > shown.length ? `<div class="thing more"><div class="pic">+${g.length - shown.length}</div><div class="tn">altri</div></div>` : ""}</div>`
          : `<div class="zone-empty">Vuoto · tocca per aggiungere ${esc(z.hint.split(",")[0])} e altro</div>`}
      </div>`;
    }
    parts.push(cards + `</div>`);
    $("pantry-list").innerHTML = parts.join("");
    return;
  }

  // griglia di prodotti: dettaglio di una zona oppure elenco di tutto
  const q = norm(state.search);
  let visible = scope.filter(p => state.pview !== "all" || !q || norm(p.name).includes(q) || norm(p.note).includes(q));
  if (state.pfilter === "exp") visible = visible.filter(isExpiring);
  if (state.pfilter === "out") visible = visible.filter(p => (Number(p.qty) || 0) === 0);
  const sorters = {
    scad: (a, b) => ((Number(b.qty) > 0) - (Number(a.qty) > 0)) || ((daysLeft(a.expiry) ?? 9999) - (daysLeft(b.expiry) ?? 9999)) || a.name.localeCompare(b.name, "it"),
    nome: (a, b) => a.name.localeCompare(b.name, "it"),
    qty: (a, b) => (Number(b.qty) || 0) - (Number(a.qty) || 0) || a.name.localeCompare(b.name, "it"),
  };
  visible.sort(sorters[state.psort]);
  if (!items.length) {
    parts.push(`<div class="empty"><strong>La dispensa è vuota</strong>Tocca “Aggiungi”, scansiona un codice a barre o importa uno scontrino Esselunga.</div>`);
  } else if (!visible.length) {
    parts.push(`<div class="empty"><strong>${q ? "Nessun risultato" : detail ? `${esc(detail.label)}: niente qui` : "Niente qui"}</strong>${
      q ? `Niente che corrisponda a “${esc(state.search)}”.` : state.pfilter ? "Prova a togliere il filtro." : "Tocca “Aggiungi” per mettere qualcosa in questa zona."}</div>`);
  } else {
    parts.push(`<div class="grid">${visible.map(productCard).join("")}</div>`);
  }
  $("pantry-list").innerHTML = parts.join("");
}

// foglio per aggiungere / modificare un prodotto in dispensa
function openPantrySheet(item, scanned) {
  closeSheet();
  const isNew = !item;
  const d = item ? { ...item } : {
    name: scanned?.name || "", zone: scanned?.zone || (state.zone !== "all" ? state.zone : CAT_TO_ZONE[guessCat(scanned?.name || "")] || "credenza"),
    qty: 1, expiry: "", note: scanned?.note || "", barcode: scanned?.code || null, icon: null,
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
        ? `<div class="found"><span>Trovato${scanned.source === "casa" ? " tra i vostri prodotti" : ""}: controlla e salva.</span></div>`
        : `<div class="found miss">Codice ${esc(scanned.code)} non trovato nei database. Scrivi il nome: la prossima volta lo riconosco.</div>`) : ""}
      <div class="field"><label for="ps-name">Nome</label>
        <input type="text" id="ps-name" maxlength="80" required value="${esc(d.name)}" placeholder="es. Yogurt greco"></div>
      <div class="field"><span class="lbl">Disegno</span>
        <div class="ico-strip" id="ps-icons" role="radiogroup" aria-label="Disegno del prodotto"></div></div>
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

  // scelta del disegno: "Automatico" segue nome e zona
  const icoStrip = form.querySelector("#ps-icons");
  const autoBtn = () => `<button type="button" class="ico-opt" data-ico="" role="radio" aria-checked="${!d.icon}">${productIconSvg(iconIdFor(nameIn.value, d.zone))}<span>Automatico</span></button>`;
  icoStrip.innerHTML = autoBtn() + PRODUCT_ICONS.map(i =>
    `<button type="button" class="ico-opt" data-ico="${i.id}" role="radio" aria-checked="${d.icon === i.id}">${productIconSvg(i.id)}<span>${i.label}</span></button>`).join("");
  const refreshAuto = () => { icoStrip.firstElementChild.outerHTML = autoBtn(); };
  icoStrip.addEventListener("click", e => {
    const b = e.target.closest("[data-ico]"); if (!b) return;
    d.icon = b.dataset.ico || null;
    icoStrip.querySelectorAll("[data-ico]").forEach(x => x.setAttribute("aria-checked", String((x.dataset.ico || null) === d.icon)));
  });
  if (d.icon) setTimeout(() => icoStrip.querySelector(`[data-ico="${d.icon}"]`)?.scrollIntoView({ inline: "center", block: "nearest" }), 50);
  nameIn.addEventListener("input", refreshAuto);

  const setZone = z => { d.zone = z; form.querySelectorAll("[data-zone]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.zone === z))); refreshAuto(); };
  form.querySelectorAll("[data-zone]").forEach(b => b.addEventListener("click", () => { zoneTouched = true; setZone(b.dataset.zone); }));
  nameIn.addEventListener("input", () => { if (!zoneTouched) { const c = guessCat(nameIn.value); if (c) setZone(CAT_TO_ZONE[c]); } });
  form.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => {
    d.qty = Math.max(0, Math.min(999, (Number(d.qty) || 0) + Number(b.dataset.q)));
    form.querySelector("#ps-qty").textContent = d.qty;
  }));
  const applyScan = r => {
    d.barcode = r.code;
    form.querySelector("#ps-code").textContent = r.code;
    if (r.name && !nameIn.value.trim()) { nameIn.value = r.name; refreshAuto(); }
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
      // il disegno si salva solo se scelto a mano; tornando ad "Automatico" si toglie
      ...(d.icon ? { icon: d.icon } : item && item.icon ? { icon: deleteField() } : {}),
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
// SCONTRINI (per ora: Esselunga in PDF)
// ======================================================================
let receiptModP = null;
const receiptMod = () => (receiptModP ||= import("./receipt.js"));

$("pantry-receipt").innerHTML = `${I.receipt}<span>Scontrino</span>`;
$("pantry-receipt").addEventListener("click", openReceiptStart);

function openSheet(html) {
  closeSheet();
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.innerHTML = html;
  $("sheet-root").appendChild(scrim);
  document.body.style.overflow = "hidden";
  scrim.addEventListener("click", e => { if (e.target === scrim) closeSheet(); });
  addEventListener("keydown", escClose);
  return scrim.firstElementChild;
}

function openReceiptStart() {
  const sheet = openSheet(`
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rc-title">
      <div class="grab"></div>
      <h2 id="rc-title">Importa uno scontrino</h2>
      <p class="sheet-p">Per ora leggo gli <b>scontrini digitali Esselunga</b> in PDF. Nell’app Esselunga apri lo scontrino, tocca Condividi e salvalo su File, poi sceglilo qui.</p>
      <label class="btn scan-big" id="rc-pick">${I.receipt}<span>Scegli il PDF dello scontrino</span>
        <input type="file" accept="application/pdf,.pdf" class="file-in" id="rc-file"></label>
      <details class="rc-paste"><summary>Oppure incolla il testo dello scontrino</summary>
        <textarea id="rc-text" rows="6" placeholder="CUORI DI LATTUGA   *a   1,98&#10;…"></textarea>
        <button type="button" class="btn soft" id="rc-read">Leggi il testo</button>
      </details>
      <p class="notice error" id="rc-err" hidden></p>
      <button type="button" class="btn soft" data-cancel>Annulla</button>
    </div>`);
  const err = t => { $("rc-err").textContent = t; $("rc-err").hidden = !t; };
  sheet.querySelector("[data-cancel]").addEventListener("click", closeSheet);
  $("rc-file").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    err("");
    $("rc-pick").querySelector("span").textContent = "Leggo lo scontrino…";
    try {
      const m = await receiptMod();
      handleReceipt(m, m.parseEsselunga(await m.pdfLines(f)), err);
    } catch (ex) {
      console.error(ex);
      err("Non riesco a leggere questo PDF. È lo scontrino digitale originale? Se il problema resta, prova a incollare il testo.");
    } finally {
      const span = $("rc-pick")?.querySelector("span");
      if (span) span.textContent = "Scegli il PDF dello scontrino";
    }
  });
  $("rc-read").addEventListener("click", async () => {
    const t = $("rc-text").value;
    if (!t.trim()) { err("Incolla prima il testo dello scontrino."); return; }
    const m = await receiptMod();
    handleReceipt(m, m.parseEsselunga(t.split(/\r?\n/)), err);
  });
}

async function handleReceipt(m, parsed, err) {
  if (!parsed.items.length) {
    err(parsed.store
      ? "Ho riconosciuto uno scontrino Esselunga ma non trovo i prodotti. Mandami il PDF così aggiorno il lettore."
      : "Non sembra uno scontrino Esselunga: per ora leggo solo quelli.");
    return;
  }
  // correzioni salvate in passato e scontrino già importato?
  let learned = {}, already = null;
  try {
    const snap = await getDocs(collection(fs, "households", state.code, "receiptNames"));
    snap.forEach(d => { learned[d.id] = d.data(); });
  } catch (e) { console.warn("receiptNames", e); }
  const rid = m.receiptId(parsed);
  if (rid) { try { const s = await getDoc(doc(fs, "households", state.code, "receipts", rid)); if (s.exists()) already = s.data(); } catch (_) {} }

  const rows = parsed.items.map((it, i) => {
    const key = m.receiptKey(it.raw);
    const l = learned[key];
    const zone = l?.zone || m.guessZone(it.raw);
    return {
      i, key, raw: it.raw,
      name: l?.name || m.prettyName(it.raw),
      zone: zone === "skip" ? "credenza" : zone,
      include: l ? !l.skip : zone !== "skip",
      qty: it.qty, weightKg: it.weightKg, learned: !!l,
    };
  });
  openReceiptReview(m, parsed, rows, rid, already);
}

/** Trova le voci della lista della spesa "Casa" che corrispondono ai prodotti comprati. */
function matchShopping(rows) {
  const words = s => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  const open = state.data.casa.filter(i => i.status !== "ok");
  const out = [];
  for (const item of open) {
    const need = words(item.name);
    if (!need.length) continue;
    const hit = rows.find(r => {
      if (!r.include) return false;
      const have = words(r.name + " " + r.raw);
      const pItem = item.pantryId && state.data.pantry.find(p => p.id === item.pantryId);
      if (pItem && norm(pItem.name) === norm(r.name)) return true;
      // ogni parola della voce in lista deve iniziare una parola del prodotto (o viceversa, per parole abbreviate)
      return need.every(w => have.some(h => h.startsWith(w) || (h.length >= 4 && w.startsWith(h))));
    });
    if (hit) out.push({ item, row: hit });
  }
  return out;
}

function openReceiptReview(m, parsed, rows, rid, already) {
  const dateLabel = parsed.date
    ? new Date(parsed.date + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) + (parsed.time ? ` alle ${parsed.time}` : "")
    : "data non trovata";
  const money = v => v == null ? "" : v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const zoneOpts = z => ZONES.map(o => `<option value="${o.id}" ${o.id === z ? "selected" : ""}>${o.label}</option>`).join("");
  const sheet = openSheet(`
    <form class="sheet rc-sheet" role="dialog" aria-modal="true" aria-labelledby="rv-title" autocomplete="off">
      <div class="grab"></div>
      <h2 id="rv-title">Controlla lo scontrino</h2>
      <div class="rc-summary"><b>${esc(parsed.store || "Scontrino")}</b> · ${esc(dateLabel)}<br>${rows.length} prodotti · ${money(parsed.total)}</div>
      ${already ? `<div class="notice">Questo scontrino l’avete già importato${already.at ? ` ${ago(already.at)}` : ""}. Se lo importi di nuovo, le quantità in dispensa si sommano un’altra volta.</div>` : ""}
      <p class="sheet-p">Controlla nomi e zone. Le correzioni me le ricordo per i prossimi scontrini. Togli la spunta a ciò che non va in dispensa.</p>
      <div class="rc-list" id="rv-list">${rows.map(r => `
        <div class="rc-row${r.include ? "" : " off"}" data-i="${r.i}" data-z="${r.zone}">
          <input type="checkbox" class="rc-check" ${r.include ? "checked" : ""} aria-label="Aggiungi ${esc(r.name)} alla dispensa">
          <div class="rc-main">
            <input type="text" class="rc-name" value="${esc(r.name)}" maxlength="80" aria-label="Nome">
            <div class="rc-raw">${esc(r.raw)}${r.weightKg ? ` · ${String(r.weightKg).replace(".", ",")} kg` : ""}${r.learned ? " · ricordato" : ""}</div>
            <div class="rc-ctl">
              <span class="dot"></span>
              <select class="pillsel rc-zone" aria-label="Zona">${zoneOpts(r.zone)}</select>
              <div class="stepper"><button type="button" data-q="-1" aria-label="Meno">${I.minus}</button><output>${r.qty}</output><button type="button" data-q="1" aria-label="Più">${I.plus}</button></div>
            </div>
          </div>
        </div>`).join("")}
      </div>
      <div id="rv-shop"></div>
      <div class="rc-foot">
        <button type="submit" class="btn grow" id="rv-go"></button>
        <button type="button" class="btn soft" data-cancel>Annulla</button>
      </div>
    </form>`);
  const list = $("rv-list");
  const rowEl = i => list.querySelector(`.rc-row[data-i="${i}"]`);
  let shopMatches = [];
  const unticked = new Set();
  function refreshFoot() {
    const n = rows.filter(r => r.include).length;
    $("rv-go").textContent = `Aggiungi ${n} in dispensa`;
    $("rv-go").disabled = n === 0;
    shopMatches = matchShopping(rows);
    $("rv-shop").innerHTML = shopMatches.length ? `
      <div class="rc-shop"><h3>Comprati dalla lista della spesa</h3>
      <p class="sheet-p">Li segno come presi nella lista “Casa”.</p>
      ${shopMatches.map(({ item, row }) => `<label class="rc-match"><input type="checkbox" data-shop="${esc(item.id)}" ${unticked.has(item.id) ? "" : "checked"}>
        <span><b>${esc(item.name)}</b> <small>→ ${esc(row.name)}</small></span></label>`).join("")}</div>` : "";
  }
  refreshFoot();

  list.addEventListener("input", e => {
    const el = e.target.closest(".rc-row"); if (!el) return;
    const r = rows[+el.dataset.i];
    if (e.target.matches(".rc-name")) { r.name = e.target.value; }
  });
  list.addEventListener("change", e => {
    const el = e.target.closest(".rc-row"); if (!el) return;
    const r = rows[+el.dataset.i];
    if (e.target.matches(".rc-check")) { r.include = e.target.checked; el.classList.toggle("off", !r.include); }
    if (e.target.matches(".rc-zone")) { r.zone = e.target.value; el.dataset.z = r.zone; }
    if (e.target.matches(".rc-name")) { r.name = e.target.value.trim() || m.prettyName(r.raw); e.target.value = r.name; }
    refreshFoot();
  });
  list.addEventListener("click", e => {
    const b = e.target.closest("[data-q]"); if (!b) return;
    const el = b.closest(".rc-row"); const r = rows[+el.dataset.i];
    r.qty = Math.max(1, Math.min(99, r.qty + Number(b.dataset.q)));
    el.querySelector("output").textContent = r.qty;
  });
  $("rv-shop").addEventListener("change", e => {
    const c = e.target.closest("[data-shop]"); if (!c) return;
    if (c.checked) unticked.delete(c.dataset.shop); else unticked.add(c.dataset.shop);
  });
  sheet.querySelector("[data-cancel]").addEventListener("click", closeSheet);

  sheet.addEventListener("submit", e => {
    e.preventDefault();
    const now = Date.now();
    const batch = writeBatch(fs);
    const pantryCol = colFor("pantry");
    let added = 0, merged = 0;
    const plannedNew = new Map();   // nome+zona → riga già creata in questo scontrino
    for (const r of rows) {
      const name = r.name.trim().replace(/\s+/g, " ").slice(0, 80) || m.prettyName(r.raw);
      // ricorda nome, zona e se va saltato
      batch.set(doc(fs, "households", state.code, "receiptNames", r.key), { name, zone: r.zone, skip: !r.include, at: now });
      if (!r.include) continue;
      const k = norm(name) + "|" + r.zone;
      const existing = state.data.pantry.find(p => norm(p.name) === norm(name) && p.zone === r.zone);
      if (existing) {
        batch.update(doc(pantryCol, existing.id), { qty: increment(r.qty), updatedAt: now });
        r.pantryId = existing.id; merged++;
      } else if (plannedNew.has(k)) {
        batch.update(doc(pantryCol, plannedNew.get(k)), { qty: increment(r.qty), updatedAt: now });
        r.pantryId = plannedNew.get(k);
      } else {
        const ref = doc(pantryCol);
        batch.set(ref, {
          name, zone: r.zone, qty: r.qty, expiry: null,
          note: r.weightKg ? `${String(r.weightKg).replace(".", ",")} kg` : "",
          barcode: null, byUid: state.uid, byName: state.me, at: now, updatedAt: now,
        });
        plannedNew.set(k, ref.id); r.pantryId = ref.id; added++;
      }
    }
    for (const { item } of shopMatches) {
      if (unticked.has(item.id)) continue;
      batch.update(doc(colFor("casa"), item.id), { status: "ok", boughtUid: state.uid, boughtName: state.me, boughtAt: now });
    }
    if (rid) batch.set(doc(fs, "households", state.code, "receipts", rid), {
      store: parsed.store || "", date: parsed.date || "", time: parsed.time || "", docNumber: parsed.docNumber || "",
      total: parsed.total ?? null, products: rows.filter(r => r.include).length, byUid: state.uid, at: now,
    });
    const ticked = shopMatches.filter(x => !unticked.has(x.item.id)).length;
    const parts = [];
    if (added) parts.push(`${added} nuovi`);
    if (merged) parts.push(`${merged} aggiornati`);
    if (ticked) parts.push(`${ticked} spuntati dalla spesa`);
    const summary = parts.join(", ") || "nessun prodotto";
    batch.commit().then(() => showToast(`Scontrino importato: ${summary}`)).catch(err => {
      console.error(err);
      state.problems.pantry = err && err.code === "permission-denied"
        ? "Lo scontrino non è stato salvato: aggiorna le regole di Firestore con il nuovo firestore.rules (vedi README)."
        : "Lo scontrino non è stato salvato. Controlla la connessione e riprova.";
      renderData();
    });
    closeSheet();
    showToast(navigator.onLine ? "Salvo lo scontrino…" : `Senza rete: ${summary}. Lo sincronizzo appena torna la connessione.`);
    state.tab = "dispensa"; state.zone = "all"; render();
  });
}

// ======================================================================
// AVVIO, CONDIVISIONE, NAVIGAZIONE
// ======================================================================
updateMeButton();
$("ptr-icon").innerHTML = I.arrow;
$("tab-ico-spesa").innerHTML = I.tabBasket;
$("tab-ico-dispensa").innerHTML = I.tabPantry;
$("tab-ico-scan").innerHTML = I.tabScan;
document.querySelectorAll("#tabbar [data-tab]").forEach(b => b.addEventListener("click", () => {
  const t = b.dataset.tab;
  if (t === "casa") { state.view = "settings"; render(); scrollTo(0, 0); return; }
  if (state.view === "app" && state.tab === t && t === "dispensa") state.zone = "all";   // ritocco = torna alle zone
  if (state.view !== "app") { state.view = "app"; state.justCreated = false; }
  state.tab = t; store.set("onf-section", t);
  render(); scrollTo(0, 0);
}));
document.querySelector("#tabbar [data-action=scan]").addEventListener("click", () => {
  if (state.view !== "app") { state.view = "app"; state.justCreated = false; }
  state.tab = "dispensa"; store.set("onf-section", "dispensa");
  render();
  scanToPantry();
});

function pickerHtml() {
  return `<div class="av-grid" role="radiogroup" aria-label="Avatar">${AVATARS.map(a =>
      `<button type="button" class="av-opt" data-av="${a.id}" role="radio" aria-checked="${state.look.avatar === a.id}" aria-label="${a.label}">${avatarSvg(a.id, state.look.color)}</button>`).join("")}</div>
    <div class="swatches" role="radiogroup" aria-label="Colore di sfondo">${AVATAR_COLORS.map(c =>
      `<button type="button" class="sw" data-col="${c.id}" role="radio" aria-checked="${state.look.color === c.id}" aria-label="${c.label}" style="background:${c.value}"></button>`).join("")}</div>`;
}
function bindPicker(root) {
  if (root.dataset.picker) return;
  root.dataset.picker = "1";
  root.addEventListener("click", e => {
    const a = e.target.closest("[data-av]"), c = e.target.closest("[data-col]");
    if (!a && !c) return;
    if (a) state.look.avatar = a.dataset.av;
    if (c) state.look.color = c.dataset.col;
    store.set("onf-look", JSON.stringify(state.look));
    root.querySelector(".av-picker").innerHTML = pickerHtml();
    const big = root.querySelector(".big-av");
    if (big) big.innerHTML = avatarSvg(state.look.avatar, state.look.color);
    updateMeButton();
    if (state.view === "settings") renderMembers();
    syncMeSoon();
  });
}

const HERO_ART = `<svg viewBox="0 0 360 300" role="img" aria-label="Una borsa della spesa con pane, una bottiglia e verdure, accanto a una mensola con barattoli">
  <rect x="175" y="34" width="185" height="196" fill="#e7e7e7"/>
  <path d="M40 72C62 14 168 2 230 58c48 44 98 62 130 92v96c-80-10-158-16-220-6C72 252 22 206 26 142c2-30 5-52 14-70z" fill="#2f4a2c"/>
  <path d="M18 232c22-36 104-42 186-26 70 14 132 10 156 24v70H40c-26-10-36-44-22-68z" fill="#d8c07f"/>
  <circle cx="118" cy="84" r="32" fill="#a9c5d4"/>
  <path d="M118 84l-12 13M118 84l3-19" stroke="#141414" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="118" cy="84" r="26" fill="none" stroke="#141414" stroke-width="1.4" opacity=".5"/>
  <ellipse cx="236" cy="196" rx="60" ry="46" fill="#f3bab7"/>
  <ellipse cx="262" cy="118" rx="14" ry="26" fill="#f4ecc6"/>
  <ellipse cx="80" cy="182" rx="18" ry="16" fill="#a9c5d4"/>
  <ellipse cx="112" cy="176" rx="16" ry="22" fill="#f3bab7"/>
  <ellipse cx="80" cy="268" rx="26" ry="16" fill="#f3bab7"/>
  <g fill="none" stroke="#141414" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M180 150h112l-11 112h-90z"/>
    <path d="M212 150c0-30 46-30 46 0"/>
    <path d="M198 150c6-30 16-54 30-68 8-6 14 0 9 9-11 20-17 38-20 59"/>
    <path d="M214 104l8 5M209 118l8 4M205 132l7 4"/>
    <path d="M250 150v-36c0-8 6-12 6-20V82h10v12c0 8 6 12 6 20v36"/>
    <path d="M256 88h10"/>
    <path d="M276 150c4-30 24-46 38-52-4 22-14 40-28 52M284 150c8-18 22-26 34-28-6 14-16 22-26 28"/>
    <path d="M194 182h80M196 206h76" opacity=".4"/>
    <path d="M52 202h112"/>
    <rect x="62" y="168" width="24" height="34" rx="4"/><path d="M60 168h28"/>
    <rect x="96" y="156" width="28" height="46" rx="5"/><path d="M94 156h32"/>
    <rect x="134" y="176" width="20" height="26" rx="4"/><path d="M132 176h24"/>
    <path d="M60 252h42l-5 32H65z"/>
    <path d="M80 252c-2-16-12-26-24-30 6 14 14 24 24 30zM82 252c2-18 12-30 26-34-4 16-14 28-26 34zM81 250c0-14 2-26 0-38"/>
  </g>
</svg>`;

function renderSetup() {
  $("view-setup").innerHTML = `
    <div class="hero">
      <h1>Oh no,<br>è finito!</h1>
      <p>Cosa manca, cosa c’è in dispensa: la spesa di casa, da fare in due.</p>
      <div class="hero-art">${HERO_ART}</div>
    </div>
    <div class="panel" data-c="igiene">
      <h2>Chi sei?</h2>
      <div class="profile-head"><span class="big-av">${avatarSvg(state.look.avatar, state.look.color)}</span>
        <div class="field" style="flex:1"><label for="setup-name">Come ti chiami?</label>
        <input id="setup-name" type="text" maxlength="30" placeholder="es. Giulia" value="${esc(state.me)}" autocomplete="given-name"></div></div>
      <div class="field"><span class="lbl">Scegli il tuo avatar</span><div class="av-picker">${pickerHtml()}</div></div>
    </div>
    <div class="panel" data-c="pulizia">
      <h2>Nuova casa</h2>
      <p>Crei la lista e la dispensa, poi inviti l’altra persona con un link.</p>
      <button class="btn" id="setup-create" type="button">Crea una nuova casa</button>
    </div>
    <div class="or">oppure</div>
    <div class="panel" data-c="frigo">
      <h2>Ho un invito</h2>
      <div class="field"><label for="setup-code">Codice o link ricevuto</label>
        <input id="setup-code" type="text" placeholder="XXXX-XXXX-XXXX-XXXX" value="${esc(state.code || "")}" autocapitalize="characters" autocomplete="off" spellcheck="false"></div>
      <button class="btn" id="setup-join" type="button">Entra nella casa</button>
    </div>
    <p id="setup-err" class="notice error" hidden></p>`;
  bindPicker($("view-setup"));
  const err = t => { $("setup-err").textContent = t; $("setup-err").hidden = false; };
  const saveName = () => {
    const n = $("setup-name").value.trim();
    if (!n) { err("Scrivi il tuo nome: serve all’altra persona per sapere chi ha segnato cosa."); $("setup-name").focus(); return false; }
    state.me = n; store.set("onf-name", n); return true;
  };
  $("setup-create").addEventListener("click", () => {
    if (!saveName()) return;
    state.code = newCode(); store.set("onf-code", state.code);
    setDoc(doc(fs, "households", state.code), { createdAt: Date.now() }, { merge: true }).catch(e => console.warn("house", e));
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

function activeLabel(ts) {
  if (!ts) return "";
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const days = Math.floor((d0 - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return "attivo oggi";
  if (days === 1) return "attivo ieri";
  return `attivo ${days} giorni fa`;
}
let pendingRemove = null;
function renderMembers() {
  const el = document.getElementById("members-list");
  if (!el) return;
  const list = [...state.members];
  if (!list.some(m => m.id === state.uid)) list.push({ id: state.uid, name: state.me, ...state.look, lastSeen: Date.now() });
  list.sort((a, b) => (b.id === state.uid) - (a.id === state.uid) || (a.joinedAt || 0) - (b.joinedAt || 0));
  el.innerHTML = list.map(m => {
    const me = m.id === state.uid;
    const look = me ? state.look : m;
    const name = me ? state.me : (m.name || "Senza nome");
    const action = me ? "" : pendingRemove === m.id
      ? `<button class="confirm-del" data-remove-yes="${esc(m.id)}">Rimuovi</button>`
      : `<button class="icon-btn" data-remove="${esc(m.id)}" aria-label="Rimuovi ${esc(name)} dall’elenco">${I.trash}</button>`;
    return `<div class="member"><span class="m-av">${avatarSvg(look.avatar, look.color)}</span>
      <div class="m-body"><div class="m-name">${esc(name)}${me ? `<span class="you">tu</span>` : ""}</div>
      <div class="m-meta">${me ? "questo telefono" : activeLabel(m.lastSeen)}</div></div>${action}</div>`;
  }).join("");
  const n = list.length;
  $("members-count").textContent = n === 1 ? "1 persona" : `${n} persone`;
  $("invite-hint").hidden = n > 1;
}

function renderSettings() {
  const nMembers = Math.max(1, state.members.length);
  $("view-settings").innerHTML = `
    <div class="page-head">${headHtml({ title: houseName(), titleId: "house-title", sub: "La casa e chi ci abita", stats: [{ icon: I.people, n: nMembers, label: nMembers === 1 ? "1 persona" : `${nMembers} persone` }] })}</div>
    ${state.justCreated ? `<div class="notice">Casa creata! Ora invita l’altra persona con il link qui sotto.</div>` : ""}
    <div class="panel" data-c="igiene" id="profile-panel">
      <h2>Il tuo profilo</h2>
      <div class="profile-head"><span class="big-av">${avatarSvg(state.look.avatar, state.look.color)}</span>
        <div class="field" style="flex:1"><label for="set-name">Nome</label>
        <input id="set-name" type="text" maxlength="30" value="${esc(state.me)}" autocomplete="given-name"></div></div>
      <div class="field"><span class="lbl">Avatar</span><div class="av-picker">${pickerHtml()}</div></div>
    </div>

    <div class="panel" data-c="cibo" id="push-panel"><h3>Notifiche</h3></div>

    <div class="panel" data-c="pulizia">
      <div class="field"><label for="house-name">Nome della casa</label>
        <input id="house-name" type="text" maxlength="40" placeholder="La nostra casa" value="${esc(state.house?.name || "")}"></div>
      <div class="card-head" style="padding:0"><h3>Chi c’è</h3><small id="members-count"></small></div>
      <div class="members" id="members-list"></div>
      <p id="invite-hint" style="font-size:13.5px">Per ora ci sei solo tu. Invita l’altra persona qui sotto.</p>
    </div>

    <div class="panel" data-c="frigo">
      <h3>Invita in casa</h3>
      <p>Manda questo link all’altra persona. Chi ha il codice può vedere e modificare la lista “Casa” e la dispensa, quindi tenetelo tra voi.</p>
      <div class="code" id="invite-code">${esc(state.code)}</div>
      <div class="row">
        <button class="btn grow" id="copy-link" type="button">Copia link d’invito</button>
        <button class="btn soft grow" id="share-link" type="button" ${navigator.share ? "" : "hidden"}>Condividi…</button>
      </div>
      <ol class="steps">
        <li>Apre il link in Safari e tocca Condividi → <b>Aggiungi alla schermata Home</b>.</li>
        <li>Apre l’app dall’icona e, se lo chiede, incolla il codice.</li>
      </ol>
    </div>

    <button class="btn danger" id="leave" type="button">Esci da questa casa</button>
    <p id="leave-confirm" class="notice error" hidden>Uscendo, su questo telefono non vedrai più lista e dispensa di casa finché non reinserisci il codice. I dati restano salvati per gli altri. <button class="confirm-del" id="leave-yes" type="button">Esci</button></p>`;
  renderMembers();
  renderPushPanel();
  bindPicker($("profile-panel"));
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
    navigator.share({ title: "Oh no, è finito!", text: `Entra in “${houseName()}” su Oh no, è finito!`, url: inviteLink() }).catch(() => {});
  });
  $("set-name").addEventListener("change", e => {
    const n = e.target.value.trim();
    if (!n) { e.target.value = state.me; return; }
    state.me = n; store.set("onf-name", n); syncMe(); renderMembers(); showToast("Nome salvato");
  });
  $("house-name").addEventListener("change", e => {
    const n = e.target.value.trim().slice(0, 40);
    setDoc(doc(fs, "households", state.code), { name: n, updatedAt: Date.now() }, { merge: true })
      .then(() => showToast(n ? "Nome della casa salvato" : "Nome della casa tolto"))
      .catch(err => { console.warn(err); showToast("Non riesco a salvare: aggiorna le regole di Firestore (vedi README)"); });
  });
  $("members-list").addEventListener("click", e => {
    const r = e.target.closest("[data-remove]"), y = e.target.closest("[data-remove-yes]");
    if (r) {
      pendingRemove = r.dataset.remove; renderMembers();
      setTimeout(() => { if (pendingRemove === r.dataset.remove) { pendingRemove = null; renderMembers(); } }, 3500);
    } else if (y) {
      pendingRemove = null;
      deleteDoc(doc(fs, "households", state.code, "members", y.dataset.removeYes)).catch(err => console.warn(err));
      showToast("Rimosso dall’elenco. Con il codice potrà sempre rientrare.");
    }
  });
  $("leave").addEventListener("click", () => { $("leave-confirm").hidden = false; });
  $("leave-yes").addEventListener("click", () => {
    deleteDoc(doc(fs, "households", state.code, "members", state.uid)).catch(() => {});
    deleteDoc(doc(fs, "households", state.code, "push", state.uid)).catch(() => {});
    store.set("onf-joined-" + state.code, null);
    unsubs.forEach(u => u()); unsubs = [];
    state.code = null; store.set("onf-code", null);
    state.data = { casa: [], mio: [], pantry: [] }; state.loaded = { casa: false, mio: false, pantry: false };
    state.members = []; state.house = null; updateHouseName();
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
  document.querySelectorAll("#tabbar [data-tab]").forEach(b => b.setAttribute("aria-selected",
    String(b.dataset.tab === "casa" ? v === "settings" : v === "app" && b.dataset.tab === state.tab)));
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
    setSyncState("error");
  }
}, 10000);

onAuthStateChanged(auth, user => {
  if (!user) {
    signInAnonymously(auth).catch(e => {
      console.error(e);
      clearTimeout(bootTimer);
      $("view-boot").innerHTML = `<strong>Accesso non riuscito</strong>${esc(e.code || "errore")}. Controlla la connessione e riapri l’app.`;
      setSyncState("error");
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
