// Scanner di codici a barre.
// 1. Fotocamera dal vivo: apriamo noi lo stream (impostazioni compatibili con iPhone),
//    controlliamo che arrivino davvero immagini e leggiamo i fotogrammi con
//    BarcodeDetector (se il browser lo ha) oppure con il decodificatore di ZXing.
// 2. "Scatta una foto": usa la fotocamera di sistema e legge il codice dalla foto.
// 3. Inserimento a mano delle cifre.

const ZXING_SRC = "vendor/zxing-0.21.3.min.js";
let zxingLoading = null;

function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingLoading) {
    zxingLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = ZXING_SRC;
      s.onload = () => resolve(window.ZXing);
      s.onerror = () => { zxingLoading = null; reject(new Error("zxing")); };
      document.head.appendChild(s);
    });
  }
  return zxingLoading;
}

export function validBarcode(code) {
  return /^\d{8}$|^\d{12,14}$/.test(code || "");
}

// Creiamo gli elementi direttamente nel documento (non da un <template>):
// in Safari un <video> nato in un template può restare nero anche se riceve lo stream.
function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- decodificatori ----------
let nativeDetector;          // undefined = non ancora controllato, null = non disponibile
async function getNativeDetector() {
  if (nativeDetector !== undefined) return nativeDetector;
  nativeDetector = null;
  if ("BarcodeDetector" in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      const want = ["ean_13", "ean_8", "upc_a", "upc_e"].filter(f => formats.includes(f));
      if (want.includes("ean_13")) nativeDetector = new window.BarcodeDetector({ formats: want });
    } catch (_) {}
  }
  return nativeDetector;
}

let zxReader = null;
async function getZxing() {
  const ZX = await loadZxing();
  if (!zxReader) {
    zxReader = new ZX.MultiFormatReader();
    const hints = new Map();
    hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
      ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E,
    ]);
    zxReader.setHints(hints);
  }
  return ZX;
}

/** Prova a leggere un codice dal contenuto di un canvas. */
async function decodeCanvas(canvas) {
  const native = await getNativeDetector();
  if (native) {
    try {
      const found = await native.detect(canvas);
      const hit = found.find(b => validBarcode(b.rawValue));
      if (hit) return hit.rawValue;
    } catch (_) {}
  }
  const ZX = await getZxing();
  for (const Bin of [ZX.HybridBinarizer, ZX.GlobalHistogramBinarizer]) {
    try {
      const src = new ZX.HTMLCanvasElementLuminanceSource(canvas);
      const text = zxReader.decodeWithState(new ZX.BinaryBitmap(new Bin(src))).getText();
      if (validBarcode(text)) return text;
    } catch (_) { /* nessun codice in questo fotogramma */ }
  }
  return null;
}

/** Disegna una sorgente (video o immagine) su un canvas, con ritaglio, scala e rotazione facoltativi. */
function drawTo(canvas, source, sw, sh, { crop = null, maxW = 1000, rotate = 0 } = {}) {
  const [cx, cy, cw, ch] = crop || [0, 0, sw, sh];
  const scale = Math.min(1, maxW / Math.max(cw, ch));
  const w = Math.round(cw * scale), h = Math.round(ch * scale);
  const rot = rotate % 180 !== 0;
  canvas.width = rot ? h : w; canvas.height = rot ? w : h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.save();
  if (rotate) { ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotate * Math.PI / 180); ctx.translate(-w / 2, -h / 2); }
  ctx.drawImage(source, cx, cy, cw, ch, 0, 0, w, h);
  ctx.restore();
}

/** Legge un codice da una foto (File). */
export async function decodeImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const canvas = document.createElement("canvas");
    const attempts = [
      { maxW: 1400 }, { maxW: 900 },
      { maxW: 1400, crop: [0, Math.round(H * 0.25), W, Math.round(H * 0.5)] },
      { maxW: 1400, rotate: 90 }, { maxW: 900, rotate: 90 },
    ];
    for (const a of attempts) {
      drawTo(canvas, img, W, H, a);
      const code = await decodeCanvas(canvas);
      if (code) return code;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- fotocamera dal vivo ----------
async function waitForFrames(video, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (video.readyState >= 2 && video.videoWidth > 0) return true;
    await sleep(100);
  }
  return false;
}

/** Apre la fotocamera posteriore e restituisce lo stream solo se il video mostra davvero immagini. */
async function openCamera(video) {
  const attempts = [
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: { facingMode: "environment" } },
    { audio: false, video: true },
  ];
  let lastError = null;
  for (const constraints of attempts) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastError = e;
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) throw e;
      continue;
    }
    // su iPhone il video deve essere muto e "inline" prima di collegare lo stream
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("muted", "");
    video.srcObject = stream;
    try { await video.play(); } catch (_) {}
    if (await waitForFrames(video, 3000)) return stream;
    // nessuna immagine: chiudiamo e riproviamo con impostazioni più semplici
    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
  if (lastError) throw lastError;
  return null;
}

/** Apre lo scanner e risolve con il codice letto, oppure null se si annulla. */
export function scanBarcode() {
  return new Promise(resolve => {
    const root = el(`
      <div class="scanner" role="dialog" aria-modal="true" aria-label="Scansiona codice a barre">
        <header class="sc-head">
          <div class="titles"><h1>Scansiona</h1><p class="sub">Inquadra il codice a barre del prodotto</p></div>
          <button class="pill" type="button" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>Chiudi</button>
        </header>
        <div class="stage">
          <canvas class="preview" aria-hidden="true"></canvas>
          <div class="frame"></div>
          <div class="msg"><span data-msg>Avvio la fotocamera…</span><small class="diag" data-diag></small></div>
        </div>
        <footer>
          <div class="row">
            <label class="btn grow" data-photo><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 4.5h6l1.5 2H20a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V8A1.5 1.5 0 0 1 4 6.5h3.5z"/><circle cx="12" cy="12.8" r="3.6" fill="#fff"/></svg>Scatta una foto al codice<input type="file" accept="image/*" capture="environment" class="file-in" data-file></label>
            <button class="pill" type="button" data-retry hidden>Riprova</button>
          </div>
          <div class="row">
            <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Oppure scrivi le cifre" aria-label="Codice a barre" maxlength="14" data-digits>
            <button class="btn soft" type="button" data-manual>Cerca</button>
          </div>
        </footer>
      </div>`);
    document.body.appendChild(root);
    const video = document.createElement("video");
    video.muted = true; video.defaultMuted = true; video.playsInline = true; video.autoplay = true;
    video.setAttribute("playsinline", ""); video.setAttribute("webkit-playsinline", ""); video.setAttribute("muted", "");
    root.querySelector(".stage").prepend(video);
    const preview = root.querySelector(".preview");
    const diag = root.querySelector("[data-diag]");
    const msg = root.querySelector("[data-msg]");
    const digits = root.querySelector("[data-digits]");
    const fileIn = root.querySelector("[data-file]");
    const retryBtn = root.querySelector("[data-retry]");
    const canvas = document.createElement("canvas");
    let stream = null, closed = false, runId = 0;

    // anteprima disegnata da noi su un canvas: si vede anche se Safari non mostra il <video>
    let previewRaf = 0;
    function drawPreview() {
      if (closed) return;
      const vw = video.videoWidth, vh = video.videoHeight;
      if (stream && vw && vh) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = Math.round(preview.clientWidth * dpr), ch = Math.round(preview.clientHeight * dpr);
        if (cw && ch) {
          if (preview.width !== cw || preview.height !== ch) { preview.width = cw; preview.height = ch; }
          const scale = Math.max(cw / vw, ch / vh);
          const sw = cw / scale, sh = ch / scale;
          try { preview.getContext("2d").drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cw, ch); } catch (_) {}
        }
      }
      previewRaf = requestAnimationFrame(drawPreview);
    }
    previewRaf = requestAnimationFrame(drawPreview);

    function brightness(c) {
      try {
        const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4 * 37) { sum += d[i] + d[i + 1] + d[i + 2]; n++; }
        return n ? Math.round(sum / n / 3) : -1;
      } catch (_) { return -1; }
    }
    function showDiag(extra) {
      const t = stream && stream.getVideoTracks()[0];
      const parts = [];
      if (video.videoWidth) parts.push(`${video.videoWidth}×${video.videoHeight}`);
      parts.push(`video ${video.readyState}${video.paused ? " in pausa" : ""}`);
      if (t) parts.push(`camera ${t.readyState}${t.muted ? " muta" : ""}`);
      if (extra != null) parts.push(extra);
      diag.textContent = parts.join(" · ");
    }

    function stopCamera() {
      runId++;
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
      video.srcObject = null;
    }
    function close(code) {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(previewRaf);
      stopCamera();
      root.remove();
      resolve(code || null);
    }
    function done(code) {
      if (closed) return;
      root.classList.add("hit");
      if (navigator.vibrate) navigator.vibrate(60);
      setTimeout(() => close(code), 150);
    }

    root.querySelector("[data-close]").addEventListener("click", () => close(null));
    root.querySelector("[data-manual]").addEventListener("click", () => {
      const v = digits.value.replace(/\D/g, "");
      if (validBarcode(v)) done(v);
      else { msg.textContent = "Il codice deve avere 8, 12, 13 o 14 cifre."; digits.focus(); }
    });
    digits.addEventListener("keydown", e => { if (e.key === "Enter") root.querySelector("[data-manual]").click(); });

    // foto: la fotocamera di sistema non può lavorare insieme allo stream, quindi lo chiudiamo prima
    root.querySelector("[data-photo]").addEventListener("click", () => {
      stopCamera();
      msg.textContent = "Scatta una foto ravvicinata e dritta al codice a barre.";
      retryBtn.hidden = false;
      fileIn.value = "";
    });
    fileIn.addEventListener("change", async () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      msg.textContent = "Leggo la foto…";
      try {
        const code = await decodeImageFile(f);
        if (code) return done(code);
        msg.textContent = "Non trovo il codice nella foto. Riprova più vicino e con più luce, oppure scrivi le cifre.";
      } catch (e) {
        console.error(e);
        msg.textContent = e && e.message === "zxing"
          ? "Non riesco a caricare il lettore (serve la rete la prima volta). Scrivi le cifre qui sotto."
          : "Non riesco a leggere la foto. Riprova o scrivi le cifre.";
      }
    });
    retryBtn.addEventListener("click", () => { retryBtn.hidden = true; startLive(); });

    async function startLive() {
      const myRun = ++runId;
      msg.textContent = "Avvio la fotocamera…";
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg.textContent = "Qui la fotocamera dal vivo non è disponibile: usa “Scatta una foto” o scrivi le cifre.";
        return;
      }
      try {
        // carichiamo il lettore in parallelo, così è pronto quando arrivano le immagini
        const ready = getNativeDetector().then(n => n || getZxing());
        const s = await openCamera(video);
        if (closed || myRun !== runId) { if (s) s.getTracks().forEach(t => t.stop()); return; }
        if (!s) {
          msg.textContent = "La fotocamera non mostra immagini. Usa “Scatta una foto al codice”.";
          retryBtn.hidden = false;
          return;
        }
        stream = s;
        video.addEventListener("pause", () => { if (stream) video.play().catch(() => {}); });
        await ready;
        msg.textContent = "Tieni il codice dentro il riquadro";
        let darkSince = 0, tick = 0;
        while (!closed && myRun === runId) {
          const vw = video.videoWidth, vh = video.videoHeight;
          if (video.paused) video.play().catch(() => {});
          if (vw && vh) {
            // la fascia centrale, dove sta il riquadro
            const band = Math.round(vh * 0.5);
            drawTo(canvas, video, vw, vh, { crop: [0, Math.round((vh - band) / 2), vw, band], maxW: 960 });
            const code = await decodeCanvas(canvas);
            if (code) return done(code);
            if (tick++ % 5 === 0) {
              const light = brightness(canvas);
              showDiag(`luce ${light}`);
              if (light >= 0 && light < 6) {
                darkSince ||= Date.now();
                if (Date.now() - darkSince > 3000) msg.textContent = "La fotocamera manda solo immagini nere. Usa “Scatta una foto al codice” e mandami una foto di questa schermata.";
              } else if (darkSince) { darkSince = 0; msg.textContent = "Tieni il codice dentro il riquadro"; }
            }
          } else if (tick++ % 5 === 0) showDiag("nessuna immagine");
          await sleep(120);
        }
      } catch (e) {
        console.error(e);
        if (closed || myRun !== runId) return;
        const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
        msg.textContent = denied
          ? "Accesso alla fotocamera negato. Su iPhone: Impostazioni › Safari › Fotocamera › Consenti. Intanto puoi scattare una foto o scrivere le cifre."
          : e && e.message === "zxing"
            ? "Non riesco a caricare il lettore (serve la rete la prima volta). Scrivi le cifre qui sotto."
            : "Non riesco ad avviare la fotocamera. Usa “Scatta una foto al codice” o scrivi le cifre.";
        retryBtn.hidden = false;
      }
    }
    startLive();
  });
}

// ---------- ricerca del prodotto nei database aperti ----------
const SOURCES = [
  ["https://world.openfoodfacts.org", "food"],
  ["https://world.openbeautyfacts.org", "beauty"],
  ["https://world.openproductsfacts.org", "products"],
];
const FIELDS = "product_name,product_name_it,generic_name_it,generic_name,brands,quantity,categories_tags,image_front_small_url";
const IMG_RE = /^https:\/\/images\.open(food|beauty|products)facts\.org\/[^\s"'<>]{1,250}$/;

async function fetchJson(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; } finally { clearTimeout(t); }
}

/** Cerca il prodotto su Open Food Facts, Open Beauty Facts e Open Products Facts. */
export async function lookupProduct(code) {
  for (const [base, kind] of SOURCES) {
    const j = await fetchJson(`${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, 7000);
    if (!j || j.status !== 1 || !j.product) continue;
    const p = j.product;
    const name = String(p.product_name_it || p.product_name || p.generic_name_it || p.generic_name || "").trim();
    if (!name) continue;
    const brand = String(p.brands || "").split(",")[0].trim();
    const quantity = String(p.quantity || "").trim();
    const img = IMG_RE.test(p.image_front_small_url || "") ? p.image_front_small_url : null;
    return { name, brand, quantity, tags: p.categories_tags || [], kind, img };
  }
  return null;
}

/** Indovina la zona della dispensa dalle categorie del prodotto. */
export function zoneFromProduct(p) {
  if (!p) return null;
  if (p.kind === "beauty") return "bagno";
  const t = (p.tags || []).join(" ");
  if (/frozen|surgel/.test(t)) return "freezer";
  if (/dair|chees|yogurt|milk|meat|fish|seafood|egg|ham|sausage|fresh|refrigerat|butter|cream/.test(t)) return "frigo";
  if (p.kind === "products") {
    if (/hygien|cosmetic|toothpaste|shampoo|soap|deodorant|diaper/.test(t)) return "bagno";
    return "pulizia";
  }
  if (/beverag|drink|water|food|snack|pasta|cereal|biscuit|sauce|conserve|plant-based/.test(t)) return "credenza";
  return null;
}
