// Lettura degli scontrini. Per ora: scontrino digitale Esselunga in PDF (o il suo testo incollato).
// Le funzioni di analisi sono pure (niente DOM), così si possono provare anche fuori dal browser.

const PDFJS_DIR = "vendor/pdfjs-4.10.38/";
let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    const base = new URL(PDFJS_DIR, document.baseURI);
    pdfjsPromise = import(new URL("pdf.min.js", base).href).then(lib => {
      lib.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", base).href;
      return lib;
    }).catch(e => { pdfjsPromise = null; throw e; });
  }
  return pdfjsPromise;
}

/** Ricostruisce le righe di testo di una pagina a partire dai frammenti di pdf.js. */
export function linesFromTextItems(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    const h = Math.abs(it.transform[3]) || it.height || 8;
    let row = rows.find(r => Math.abs(r.y - y) < h * 0.45);
    if (!row) { row = { y, h, parts: [] }; rows.push(row); }
    row.parts.push({ x, w: it.width || 0, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(r => {
    r.parts.sort((a, b) => a.x - b.x);
    let out = "", end = null;
    for (const p of r.parts) {
      if (end != null && p.x - end > r.h * 0.15 && !out.endsWith(" ")) out += " ";
      out += p.s;
      end = p.x + p.w;
    }
    return out.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

/** Estrae tutte le righe di testo da un PDF (File/Blob). */
export async function pdfLines(file) {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await lib.getDocument({
    data, isEvalSupported: false,
    standardFontDataUrl: new URL(PDFJS_DIR + "standard_fonts/", document.baseURI).href,
  }).promise;
  const lines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    lines.push(...linesFromTextItems(tc.items));
  }
  await pdf.destroy();
  return lines;
}

// ---------- analisi dello scontrino Esselunga ----------
const num = s => parseFloat(String(s).replace(/\./g, "").replace(",", "."));

/**
 * Trasforma le righe dello scontrino in prodotti.
 * Riconosce: riga prodotto ("NOME  *a  1,98"), riga peso ("KG. 0,22  29,90", che sugli
 * scontrini Esselunga sta PRIMA del prodotto a cui si riferisce: 0,22 kg × 29,90 = prezzo della riga dopo),
 * sconti ("SCONTO ... 0,94-S"), totale, data e numero del documento.
 */
export function parseEsselunga(lines) {
  const text = lines.join("\n");
  const isEsselunga = /ESSELUNGA/i.test(text);
  const out = { store: isEsselunga ? "Esselunga" : null, date: null, time: null, docNumber: null, total: null, items: [] };

  const d = text.match(/\b(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2})\b/);
  if (d) { out.date = `${d[3]}-${d[2]}-${d[1]}`; out.time = d[4]; }
  const doc = text.match(/DOCUMENTO\s+N\.?\s*([\d-]+)/i);
  if (doc) out.docNumber = doc[1];
  const tot = text.match(/TOTALE\s+EURO\s+([\d.]+,\d{2})/i);
  if (tot) out.total = num(tot[1]);

  const ITEM = /^(.+?)\s+\*\s?([A-Z]{1,2})\s+(\d{1,4}(?:\.\d{3})*,\d{2})$/i;
  const WEIGHT = /^KG\.?\s*(\d+,\d+)\s+(\d+(?:\.\d{3})*,\d{2})$/i;
  const DISCOUNT = /^SCONTO\b.*?(\d+,\d{2})\s*-\s*S$/i;
  const QTYMULT = /^(\d+)\s*[Xx]\s+(\d+,\d{2})$/;   // "2 X 1,59" (scontrini con quantità)
  let started = false, last = null, pendingWeight = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!started) {
      if (/\bIVA\b.*\bEURO\b/i.test(line)) { started = true; continue; }
      if (ITEM.test(line)) started = true; else continue;
    }
    if (/^TOTALE\b/i.test(line)) break;
    let m;
    if ((m = line.match(ITEM))) {
      last = { raw: m[1].trim(), vat: m[2].toLowerCase(), price: num(m[3]), units: 1, weightKg: null, discount: 0 };
      if (pendingWeight) {
        // controllo: peso × prezzo al kg deve somigliare al prezzo della riga
        const expected = pendingWeight.kg * pendingWeight.perKg;
        if (Math.abs(expected - last.price) <= Math.max(0.6, last.price * 0.08)) last.weightKg = pendingWeight.kg;
        pendingWeight = null;
      }
      out.items.push(last);
    } else if ((m = line.match(WEIGHT))) {
      pendingWeight = { kg: num(m[1]), perKg: num(m[2]) };
    } else if ((m = line.match(DISCOUNT)) && last) {
      last.discount += num(m[1]);
    } else if ((m = line.match(QTYMULT)) && last) {
      last.units = parseInt(m[1], 10);
    }
  }

  // stessi prodotti ripetuti → una riga sola con la quantità
  const merged = new Map();
  for (const it of out.items) {
    const key = receiptKey(it.raw) + (it.weightKg ? "|" + it.weightKg : "");
    const prev = merged.get(key);
    if (prev && !it.weightKg) { prev.qty += it.units; prev.spent += it.price - it.discount; }
    else merged.set(prev ? key + "|" + merged.size : key, { raw: it.raw, qty: it.units, weightKg: it.weightKg, spent: it.price - it.discount, notTaxed: it.vat === "ns" });
  }
  out.lines = out.items.length;
  out.items = [...merged.values()].map(it => ({ ...it, spent: Math.round(it.spent * 100) / 100 }));
  return out;
}

/** Chiave stabile di un nome da scontrino (per ricordare le correzioni). */
export function receiptKey(raw) {
  return String(raw).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "x";
}

/** Identificativo dello scontrino, per non importarlo due volte. */
export function receiptId(r) {
  if (!r.date || !r.docNumber) return null;
  return `${(r.store || "scontrino").toLowerCase()}-${r.date.replace(/-/g, "")}-${r.docNumber}`.replace(/[^a-z0-9-]/g, "-");
}

// ---------- nomi leggibili ----------
const ABBR = [
  [/\bPROSC\./g, "PROSCIUTTO "], [/\bMOZZ\./g, "MOZZARELLA "], [/\bPOM\./g, "POMODORI "],
  [/^PAT\b/g, "PATATE"], [/\bSALM\./g, "SALMONE "], [/\bNORV\./g, "NORVEGESE "],
  [/\bESSE\.TOP\b/g, "ESSELUNGA TOP"], [/\bESSEL\./g, "ESSELUNGA "], [/\bESSE\./g, "ESSELUNGA "], [/\bES$/g, "ESSELUNGA"],
  [/\bDET\b\.?/g, "DETERGENTE"], [/\bKETCH\./g, "KETCHUP "], [/\bDIG\.?$/g, "DIGERIBILE"], [/\bG\.GOURM\./g, "GARDEN GOURMET "],
  [/\bSUP\.PRE\b/g, "SUPERFICI PREGIATE"], [/\bSUP\./g, "SUPERFICI "], [/\bPIAD\./g, "PIADINA "], [/\bANTIBATTER\b/g, "ANTIBATTERICO"],
  [/\bCAFFELAT\b/g, "CAFFELATTE"], [/\bBOCON\b/g, "BOCCONCINI"], [/\bSALS\b/g, "SALSICCIA"], [/^MB\b/g, "MULINO BIANCO"],
  [/^NP\s+/g, ""], [/\bSVR\b/g, "SVR"],
  [/\bFORMAG\./g, "FORMAGGIO "], [/\bPICC\./g, "PICCANTI "], [/\bBISC\./g, "BISCOTTI "], [/\bCIOCC\./g, "CIOCCOLATO "],
  [/\bVERD\./g, "VERDURE "], [/\bSURG\./g, "SURGELATI "], [/\bCONF\./g, "CONFEZIONE "], [/\bINS\./g, "INSALATA "],
  [/\bPOLL\./g, "POLLO "], [/\bTACC\./g, "TACCHINO "], [/\bCARC\./g, "CARCIOFI "], [/\bFAG\./g, "FAGIOLI "],
];
const KEEP_UPPER = new Set(["DOP", "IGP", "BIO", "UHT", "IGT", "DOC", "DOCG", "STG", "WC", "XL", "XXL", "SVR"]);
const SMALL = new Set(["di", "e", "a", "al", "alla", "alle", "allo", "agli", "ai", "con", "in", "da", "del", "della", "dei", "per"]);

export function prettyName(raw) {
  let s = String(raw).toUpperCase().trim();
  for (const [re, rep] of ABBR) s = s.replace(re, rep);
  s = s
    .replace(/\bGR?\.?\s?(\d+)\b/g, " $1 G ")             // G150, GR700 → 150 g
    .replace(/(\d+)\s?ML?\b/g, " $1 ML ")
    .replace(/(\d+(?:,\d+)?)\s?LT?X(\d+)\b/g, " $1 L X$2 ")  // 1LTX2 → 1 l x2
    .replace(/\bKG\.\s?(\d+)/g, " $1 KG ")
    .replace(/\b(\d+)\s?G\b/g, " $1 G ")
    .replace(/\bX\s?(\d+)\b/g, " x$1 ")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ").trim();
  return s.split(" ").map((w, i) => {
    if (KEEP_UPPER.has(w)) return w;
    if (/^\d/.test(w) || /^x\d+$/i.test(w)) return w.toLowerCase();
    if (["G", "ML", "L", "KG"].includes(w)) return w.toLowerCase();
    const lw = w.toLowerCase();
    if (i > 0 && SMALL.has(lw)) return lw;
    return lw.charAt(0).toUpperCase() + lw.slice(1);
  }).join(" ").replace(/\s+'/g, "'");
}

// ---------- dove va in casa ----------
// Regole in ordine: la prima che corrisponde vince. "skip" = non è un prodotto da dispensa.
const RULES = [
  ["skip", /\bNP\b|GIORNAL|RIVIST|SHOPPER|BORSA|SACCHETTO SPESA|BUONO|RICARICA|CAUZIONE|SERVIZIO|GIFT ?CARD|SCONTO/],
  ["bagno", /CHILLY|INTIM|SAPONE|SAPONETT|SHAMPOO|BALSAMO CAP|BAGNOSCHIUM|DOCCIA ?SCHIUMA|DENTIFRIC|SPAZZOLIN|COLLUTOR|DEODOR|\bDEO\b|ASSORBENT|LINES|NUVENIA|RASOI|SCHIUMA BARBA|GEL BARBA|COTTON|DISCHETTI|SALVIETT|FAZZOLETT|CARTA IGIEN|CEROTT|\bSVR\b|NIVEA|GARNIER|L'?OREAL|DOVE|NEUTRO ROBERTS|INFASIL|MIL MIL|BOROTALCO|PANNOLIN|PAMPERS|CREMA (VISO|CORPO|MANI)|STRUCCANT|LACCA|TINTA/],
  ["pulizia", /DETERS|DETERG(?!ENTE INTIM)|\bDET\b|SGRASS|ANTICALC|CANDEGG|AMMORB|LAVATRIC|LAVASTOV|LAVAPIATT|PIATTI|PAVIMENT|VETRI|SPUGN|PANNO|STROFIN|CARTA CUCINA|SCOTTEX|ASCIUGATUTTO|TOILET|\bWC\b|ANATRA|SACCHI|SACCHETTI|PELLICOL|ALLUMINIO|CARTA FORNO|DOMESTOS|SVELTO|DIXAN|NELSEN|\bCIF\b|AJAX|SWIFFER|CHANTE CLAIR|SMAC|NAPISAN|LEGNO E SUP|SUPERFICI|INSETTICID|ZAMPIRONI|PROFUMA ?BIANCHERIA|BRILLANTANTE|PASTIGLIE LAV|FINISH|CALGON|DECALCIFIC|GUANTI/],
  // prodotti da credenza che contengono parole "da frigo" (caffelatte, polpa di pomodoro, tonno in scatola…)
  ["credenza", /NESCAFE|CAFF?E'?LATTE|CAFFE|\bORZO|CAMOMILL|TISAN|BISCOTT|CRACKER|GRISSIN|FETTE BISC|CEREALI|MUESLI|CORN ?FLAKES|FARINA|ZUCCHERO|PASSATA|PELATI|POLPA (DI )?POMOD|SUGO PRONTO|TONNO(?! FRESCO)|SGOMBRO|LEGUMI|\bCECI\b|LENTICCH|FAGIOLI (BORLOTTI|CANNELLINI)|\bOLIO\b|ACETO|MAIONESE|MAYO|KETCH|SENAPE|\bBIRRA|\bVINO|ACQUA|COCA|PEPSI|ESTATHE|\bSUCCO|BIBITA|CHIPS|PATATINE|MERENDIN|GOCCIOLE|NUTELLA|MARMELLAT|CONFETTUR|MIELE|\bRISO\b|ORECCHIETTE|PENNE|SPAGHETTI|FUSILLI|RIGATONI|FARFALLE|RUOTE|GAROFALO|BARILLA|DE CECCO|RUMMO|LATTE (A LUNGA|UHT|DI COCCO|DI SOIA|DI MANDORLA|D'AVENA|DI AVENA)|PIADELLE|PIADIN|\bPANE\b|FILONE|FOCACC|TARALL|FRISK|MENTINE|CARAMELL|GOMME/],
  ["freezer", /SURG|GELAT|FROZEN|CONGEL|FINDUS|BASTONCIN|SOFFICIN|CORNETTO|MAGNUM|GHIACCIO|SORBETT|MINESTRONE SURG|PIZZA SURG|ORANSODA GHIACC|4 SALTI IN PADELLA|CAPITAN/],
  ["frigo", /ZYMIL|LATTE(?! DI COCCO)|\bLATT\b|YOG|SKYR|KEFIR|BURRO|PANNA|FORMAG|MOZZ|BURRAT|RICOTT|STRACCH|STRACCIAT|CRESCENZ|MASCARP|PARMIG|GRANA|ASIAGO|PRIMOSALE|LEERDAM|EMMENT|GORGONZ|PROVOL|SCAMORZ|\bBRIE\b|FONTINA|TALEGG|PECORIN|CAPRINO|FETA|PHILADELPHIA|SOTTILETT|PROSC|BRESAOL|MORTADEL|SALAME|SALAMIN|SPECK|COTTO|CRUDO|WURST|PANCETT|GUANCIAL|COPPA|SALM|SALMONE|POLLO|SUINO|MAIALE|MANZO|BOVIN|VITELL|TACCHIN|CARNE|MACINAT|POLPA TRITA|HAMBURG|BURGER|POLPETT|SALSICC|ROLAT|COTOLET|SCALOPP|SPIEDIN|ARROSTO|PESCE|MERLUZZ|ORATA|BRANZIN|GAMBER|TONNO FRESCO|UOVA|\bUOVO|LATTUG|ICEBERG|CATALANA|INSALAT|RUCOLA|VALERIANA|SPINACI|ZUCCHIN|POMOD|PACHINO|DATTERIN|CILIEGIN|FAGIOLIN|CIMA DI RAPA|BROCCOL|CAVOL|VERZA|CAROT|FINOCCH|PEPERON|MELANZ|SEDANO|ASPARAG|FUNGHI|CETRIOL|RAVANELL|AVOCADO|FRAGOL|MIRTILL|LAMPON|UVA\b|KIWI|LIMON|ARANC|MANDARIN|MELE\b|MELA\b|PERE\b|PESCHE|ALBICOCC|CILIEGIE|GNOCCHI|LASAGNE|TORTELL|RAVIOL|PASTA FRESCA|PASTA SFOGLIA|PASTA BRISE|HUMMUS|TOFU|SEITAN|SOIA|VALDOSTANA|SPICCHIO FORNO|ALI POLLO|ROSTICC|PRONTO|SUGO FRESCO|PESTO FRESCO|BUDINO|TIRAMISU|PANNA COTTA|LIEVITO DI BIRRA|ORO ROSSO|SPREMUTA|CENTRIFUGA|VAPORE/],
  ["credenza", /.*/],
];

/** Indovina la zona di un prodotto dal nome sullo scontrino. */
export function guessZone(raw) {
  const s = " " + String(raw).toUpperCase() + " ";
  for (const [zone, re] of RULES) if (re.test(s)) return zone;
  return "credenza";
}
