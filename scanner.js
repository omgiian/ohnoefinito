// Scanner di codici a barre: fotocamera posteriore, lettura con BarcodeDetector
// (se il browser lo ha) oppure con ZXing (iPhone), più inserimento manuale delle cifre.

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

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Apre la fotocamera e risolve con il codice letto, oppure null se si annulla. */
export function scanBarcode() {
  return new Promise(resolve => {
    const root = el(`
      <div class="scanner" role="dialog" aria-modal="true" aria-label="Scansiona codice a barre">
        <header><h2>Inquadra il codice a barre</h2><button class="btn soft" type="button" data-close>Chiudi</button></header>
        <div class="stage">
          <video playsinline muted autoplay></video>
          <div class="frame"></div>
          <div class="msg" data-msg>Avvio la fotocamera…</div>
        </div>
        <footer>
          <div class="row">
            <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Oppure scrivi le cifre sotto le barre" aria-label="Codice a barre" maxlength="14">
            <button class="btn" type="button" data-manual>OK</button>
          </div>
        </footer>
      </div>`);
    document.body.appendChild(root);
    const video = root.querySelector("video");
    const msg = root.querySelector("[data-msg]");
    const input = root.querySelector("input");
    let stream = null, reader = null, stopped = false, rafId = 0;

    function stop() {
      stopped = true;
      cancelAnimationFrame(rafId);
      try { reader && reader.reset(); } catch (_) {}
      if (stream) stream.getTracks().forEach(t => t.stop());
      const vs = video.srcObject;
      if (vs && vs.getTracks) vs.getTracks().forEach(t => t.stop());
      root.remove();
    }
    function done(code) {
      if (stopped) return;
      root.classList.add("hit");
      if (navigator.vibrate) navigator.vibrate(60);
      setTimeout(() => { stop(); resolve(code); }, 150);
    }
    root.querySelector("[data-close]").addEventListener("click", () => { stop(); resolve(null); });
    root.querySelector("[data-manual]").addEventListener("click", () => {
      const v = input.value.replace(/\D/g, "");
      if (validBarcode(v)) done(v);
      else { msg.textContent = "Il codice deve avere 8, 12, 13 o 14 cifre."; input.focus(); }
    });
    input.addEventListener("keydown", e => { if (e.key === "Enter") root.querySelector("[data-manual]").click(); });

    const constraints = { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } };

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg.textContent = "Questo browser non può usare la fotocamera. Scrivi le cifre qui sotto.";
        return;
      }
      try {
        let native = null;
        if ("BarcodeDetector" in window) {
          try {
            const formats = await window.BarcodeDetector.getSupportedFormats();
            if (formats.includes("ean_13")) native = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"].filter(f => formats.includes(f)) });
          } catch (_) {}
        }
        if (native) {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stopped) return stream.getTracks().forEach(t => t.stop());
          video.srcObject = stream;
          await video.play().catch(() => {});
          msg.textContent = "Tieni il codice dentro il riquadro";
          const tick = async () => {
            if (stopped) return;
            try {
              if (video.readyState >= 2) {
                const found = await native.detect(video);
                const hit = found.find(b => validBarcode(b.rawValue));
                if (hit) return done(hit.rawValue);
              }
            } catch (_) {}
            rafId = requestAnimationFrame(tick);
          };
          tick();
        } else {
          const ZXing = await loadZxing();
          if (stopped) return;
          const hints = new Map();
          hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
            ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E,
          ]);
          reader = new ZXing.BrowserMultiFormatReader(hints, 150);
          await reader.decodeFromConstraints(constraints, video, (result) => {
            if (result && validBarcode(result.getText())) done(result.getText());
          });
          if (!stopped) msg.textContent = "Tieni il codice dentro il riquadro";
        }
      } catch (e) {
        console.error(e);
        if (stopped) return;
        const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
        msg.textContent = denied
          ? "Accesso alla fotocamera negato. Su iPhone: Impostazioni › Safari › Fotocamera › Consenti. Intanto puoi scrivere le cifre qui sotto."
          : e && e.message === "zxing"
            ? "Non riesco a caricare il lettore (serve la rete la prima volta). Scrivi le cifre qui sotto."
            : "Non riesco ad avviare la fotocamera. Scrivi le cifre qui sotto.";
      }
    }
    start();
  });
}

// ---------- ricerca del prodotto nei database aperti ----------
const SOURCES = [
  ["https://world.openfoodfacts.org", "food"],
  ["https://world.openbeautyfacts.org", "beauty"],
  ["https://world.openproductsfacts.org", "products"],
];
const FIELDS = "product_name,product_name_it,generic_name_it,generic_name,brands,quantity,categories_tags";

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
    return { name, brand, quantity, tags: p.categories_tags || [], kind };
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
