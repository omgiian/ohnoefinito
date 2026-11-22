// Disegni dei prodotti: tratto nero e campiture pastello, nello stile dell'illustrazione di benvenuto.
// Ogni disegno è in un riquadro 64×64, con una macchia chiara dietro come le illustrazioni "cozy".

const W = "#fffdf8", P = "#f3bab7", B = "#a9c5d4", Y = "#f2dc8c", G = "#aacfa7", O = "#f7c2a5",
  R = "#e8776b", BR = "#e3bc8a", L = "#cfc6e8", K = "#1f2b1d";

const ICONS = {
  latte: ["Latte", `<path d="M20 26h24v28H20z" fill="${W}"/><path d="M20 26l6-10h12l6 10z" fill="${W}"/><path d="M33 10h6v6h-6z" fill="${B}"/><path d="M20 36h24v10H20z" fill="${B}"/><path d="M26 16v10"/>`],
  yogurt: ["Yogurt", `<path d="M18 27h28l-4 26H22z" fill="${W}"/><path d="M16 22h32v6H16z" fill="${P}"/><path d="M19.3 35h25.4l-1.3 9H20.6z" fill="${P}"/>`],
  formaggio: ["Formaggio", `<path d="M12 38h40v14H12z" fill="${Y}"/><path d="M12 38l28-16 12 16z" fill="${Y}"/><circle cx="22" cy="45" r="3" fill="${W}"/><circle cx="34" cy="47" r="2" fill="${W}"/><circle cx="44" cy="43" r="2.5" fill="${W}"/>`],
  mozzarella: ["Mozzarella", `<circle cx="32" cy="38" r="15" fill="${W}"/><path d="M27 23.5c2-5 8-5 10 0"/><path d="M40 20c5-3 9 0 9 4-4 1-7 0-9-4z" fill="${G}"/><path d="M24 40c3 3 8 4 12 2" opacity=".5"/>`],
  uova: ["Uova", `<ellipse cx="25" cy="38" rx="9" ry="12" fill="${W}"/><ellipse cx="40" cy="40" rx="9" ry="12" fill="${O}"/>`],
  salumi: ["Salumi", `<circle cx="42" cy="33" r="11" fill="${P}"/><circle cx="27" cy="40" r="13" fill="${P}"/><circle cx="23" cy="36" r="1.8" fill="${W}" stroke="none"/><circle cx="31" cy="38" r="1.8" fill="${W}" stroke="none"/><circle cx="25" cy="45" r="1.8" fill="${W}" stroke="none"/><circle cx="32" cy="46" r="1.4" fill="${W}" stroke="none"/><circle cx="44" cy="29" r="1.6" fill="${W}" stroke="none"/>`],
  carne: ["Carne", `<path d="M14 36c0-11 11-17 23-15 11 2 15 11 13 19-2 9-13 14-23 12-8-2-13-8-13-16z" fill="${P}"/><circle cx="39" cy="32" r="4.5" fill="${W}"/><path d="M20 40c6 4 14 5 22 1" opacity=".5"/>`],
  pollo: ["Pollo", `<path d="M14 28c5-11 23-11 27 0 3 9-5 16-13 16-8 0-17-8-14-16z" fill="${O}"/><path d="M34 41l11 11"/><circle cx="47" cy="50" r="3.2" fill="${W}"/><circle cx="44" cy="54" r="3.2" fill="${W}"/>`],
  pesce: ["Pesce", `<path d="M11 36c8-12 28-12 36 0-8 12-28 12-36 0z" fill="${B}"/><path d="M47 36l9-8v16z" fill="${B}"/><circle cx="20" cy="34" r="1.8" fill="${K}"/><path d="M30 30c2 4 2 8 0 12"/>`],
  verdura: ["Verdura", `<path d="M32 53c-18-6-20-26-6-38 4 8 8 8 12 0 14 12 12 32-6 38z" fill="${G}"/><path d="M32 53V26M32 44l-7-6M32 36l7-6"/>`],
  pomodoro: ["Pomodoro", `<circle cx="32" cy="39" r="15" fill="${R}"/><path d="M24 26l8 4 8-4-3 6h-10z" fill="${G}"/><path d="M32 26v-5"/>`],
  carota: ["Ortaggi", `<path d="M17 50l22-27c5-5 11 1 7 6L20 53z" fill="${O}"/><path d="M42 22c0-5 2-8 5-9M44 25c4-3 8-3 10-2M40 21c-2-4-1-8 1-10"/><path d="M27 38l4 3M23 44l3 2M33 31l3 3"/>`],
  frutta: ["Frutta", `<path d="M32 25c-10-6-20 2-16 15 3 10 10 14 16 11 6 3 13-1 16-11 4-13-6-21-16-15z" fill="${P}"/><path d="M32 25c0-5 1-8 3-10"/><path d="M35 18c4-4 10-3 11 0-4 3-8 3-11 0z" fill="${G}"/>`],
  pane: ["Pane", `<path d="M10 42c0-13 44-13 44 0l-2 10H12z" fill="${BR}"/><path d="M22 34l4 6M31 32l4 6M40 33l4 6"/>`],
  pasta: ["Pasta", `<path d="M10 36h44c0 11-10 18-22 18S10 47 10 36z" fill="${W}"/><path d="M14 43h36" stroke="${B}" stroke-width="4"/><path d="M18 36c2-8 6-8 6-2s4 6 6-2 6-8 6-2 4 6 6-2" fill="none" stroke="${Y}" stroke-width="3.2"/><path d="M10 36h44"/>`],
  conserva: ["Barattolo", `<path d="M22 16h20v7H22z" fill="${G}"/><rect x="18" y="23" width="28" height="31" rx="6" fill="${W}"/><path d="M18 33h28v12H18z" fill="${R}"/>`],
  scatoletta: ["Scatoletta", `<path d="M20 24v24c0 3 5 5 12 5s12-2 12-5V24" fill="${B}"/><ellipse cx="32" cy="24" rx="12" ry="4.5" fill="${W}"/><path d="M20 33c0 3 5 5 12 5s12-2 12-5" fill="none" opacity=".6"/>`],
  olio: ["Olio", `<path d="M28 18h8v7c6 4 8 8 8 14v15H20V39c0-6 2-10 8-14z" fill="#dfd58a"/><path d="M27 11h10v7H27z" fill="${G}"/><path d="M20 40h24v8H20z" fill="${W}"/>`],
  bevanda: ["Bevanda", `<path d="M27 10h10v6H27z" fill="${P}"/><path d="M26 16h12c0 4 6 5 6 12v26H20V28c0-7 6-8 6-12z" fill="${B}"/><path d="M20 34h24v10H20z" fill="${W}"/>`],
  caffe: ["Caffè", `<path d="M14 54h34" stroke-width="3"/><path d="M16 30h28v12c0 7-6 11-14 11s-14-4-14-11z" fill="${W}"/><path d="M44 33c7 0 7 9 0 9" fill="none"/><path d="M24 23c-2-3 2-5 0-8M32 23c-2-3 2-5 0-8" opacity=".6"/><path d="M16 34h28" stroke="${BR}" stroke-width="3"/>`],
  biscotti: ["Biscotti", `<circle cx="32" cy="36" r="16" fill="${BR}"/><circle cx="26" cy="31" r="2.2" fill="${K}" stroke="none"/><circle cx="37" cy="30" r="2" fill="${K}" stroke="none"/><circle cx="33" cy="40" r="2.2" fill="${K}" stroke="none"/><circle cx="24" cy="41" r="1.8" fill="${K}" stroke="none"/><circle cx="41" cy="39" r="1.8" fill="${K}" stroke="none"/>`],
  surgelato: ["Surgelato", `<rect x="14" y="20" width="36" height="32" rx="4" fill="${B}"/><rect x="21" y="27" width="22" height="18" rx="3" fill="${W}"/><path d="M32 30v12M27 33l10 6M37 33l-10 6"/>`],
  gelato: ["Gelato", `<path d="M24 34l8 21 8-21z" fill="${BR}"/><circle cx="32" cy="27" r="10" fill="${P}"/><path d="M27 38l8 6M29 34l8 6" opacity=".5"/>`],
  detersivo: ["Detersivo", `<path d="M18 24h24l4 6v24H14V30z" fill="${B}"/><path d="M34 14h8v10h-8z" fill="${P}"/><path d="M18 24c-6 2-6 12 0 14" fill="none"/><path d="M20 38h22v8H20z" fill="${W}"/>`],
  spray: ["Spray", `<path d="M22 30h18v24H22z" fill="${G}"/><path d="M26 30v-6h10v6" fill="${W}"/><path d="M24 24v-6h14l8 4v4h-8" fill="${W}"/><path d="M50 21l4-2M50 25h4M50 29l4 2" opacity=".6"/><path d="M22 38h18v8H22z" fill="${W}"/>`],
  spugna: ["Spugna", `<rect x="12" y="32" width="40" height="16" rx="4" fill="${Y}"/><rect x="12" y="25" width="40" height="8" rx="3" fill="${G}"/><circle cx="21" cy="40" r="1.6" fill="${K}" stroke="none"/><circle cx="31" cy="42" r="1.6" fill="${K}" stroke="none"/><circle cx="42" cy="39" r="1.6" fill="${K}" stroke="none"/>`],
  carta: ["Carta", `<path d="M16 24h26v26H16z" fill="${W}"/><ellipse cx="42" cy="37" rx="5" ry="13" fill="${W}"/><ellipse cx="42" cy="37" rx="1.8" ry="4" fill="${K}" stroke="none"/><ellipse cx="16" cy="37" rx="5" ry="13" fill="${W}"/><path d="M16 50v6h14" fill="none"/>`],
  sacchetti: ["Sacchetti", `<path d="M14 28h36l-4 26H18z" fill="${L}"/><path d="M24 28c0-10 16-10 16 0" fill="none"/><path d="M20 38h24" opacity=".5"/>`],
  sapone: ["Sapone", `<rect x="19" y="28" width="26" height="26" rx="6" fill="${P}"/><path d="M28 28v-6h8v6" fill="${W}"/><path d="M26 22v-5h16v4" fill="none"/><path d="M19 38h26v8H19z" fill="${W}"/>`],
  dentifricio: ["Dentifricio", `<path d="M12 36l32-9 5 10-32 9z" fill="${W}"/><path d="M44 27l7-2 3 9-5 3z" fill="${B}"/><path d="M20 34l16-4.5 2 4-16 4.5z" fill="${P}"/>`],
  deodorante: ["Deodorante", `<rect x="24" y="22" width="16" height="32" rx="5" fill="${L}"/><rect x="26" y="12" width="12" height="10" rx="3" fill="${W}"/><path d="M24 34h16" opacity=".6"/>`],
  cura: ["Cura", `<rect x="10" y="29" width="44" height="14" rx="7" fill="${O}" transform="rotate(-25 32 36)"/><rect x="24" y="30" width="16" height="12" rx="2" fill="${W}" transform="rotate(-25 32 36)"/>`],
  scatola: ["Confezione", `<path d="M14 26h36v26H14z" fill="${BR}"/><path d="M14 26l6-8h24l6 8" fill="${W}"/><path d="M28 26v10h8V26" fill="${W}"/>`],
};

// parole del nome → disegno (la prima che corrisponde vince)
const MATCH = [
  ["gelato", /GELAT|CORNETTO|MAGNUM|SORBETT|GHIACCIOL/],
  ["dentifricio", /DENTIFRIC|SPAZZOLIN|COLLUTOR|FILO INTERDENT/],
  ["deodorante", /DEODOR|\bDEO\b|\bSVR\b|PROFUMO|LACCA/],
  ["sapone", /SAPON|BAGNOSCHIUM|DOCCIA|SHAMPOO|BALSAMO|INTIM|CHILLY|CREMA (VISO|CORPO|MANI)|STRUCCANT/],
  ["carta", /CARTA IGIEN|SCOTTEX|CARTA CUCINA|ASCIUGATUTTO|TOVAGLIOL|FAZZOLETT|ROTOL/],
  ["cura", /COTTON|DISCHETT|CEROTT|ASSORBENT|RASOI|PANNOLIN|SALVIETT|LINES/],
  ["spray", /SGRASS|SPRAY|ANTICALC|VETRI|LEGNO E SUP|SUPERFIC|\bCIF\b|AJAX|CHANTE|SMAC|INSETTICID|DOMESTOS|CANDEGG|ANATRA|WC NET/],
  ["spugna", /SPUGN|PIATTI|SVELTO|PANNO|STROFIN|GUANTI|LAVAPIATT|NELSEN/],
  ["detersivo", /DETERS|LAVATRIC|LAVASTOV|AMMORB|BUCATO|DIXAN|NAPISAN|FINISH|PASTIGLIE|DETERG/],
  ["sacchetti", /SACCH|PELLICOL|ALLUMINIO|CARTA FORNO|SHOPPER/],
  ["surgelato", /SURG|FROZEN|BASTONCIN|SOFFICIN|FINDUS|PISELLI|MINESTRONE|4 SALTI|PIZZA/],
  ["caffe", /CAFF|NESCAFE|ESPRESSO|CAPSUL|\bORZO\b|CAMOMILL|TISAN|\bTE\b|\bTÈ\b|INFUSO/],
  ["yogurt", /YOG|SKYR|KEFIR|BUDINO|DESSERT|PANNA COTTA|TIRAMISU/],
  ["latte", /LATTE|ZYMIL|PANNA|\bLATT\b|BEVANDA (DI )?(SOIA|AVENA|MANDORL|RISO)/],
  ["mozzarella", /MOZZ|BURRAT|RICOTT|MASCARP|STRACCIAT|BOCCONCIN/],
  ["formaggio", /FORMAG|PARMIG|GRANA|ASIAGO|EMMENT|LEERDAM|\bBRIE\b|GORGONZ|PECORIN|PROVOL|SCAMORZ|FONTINA|TALEG|PRIMOSALE|SOTTILET|FETA|STRACCH|CRESCENZ|CAPRINO|PHILADELPHIA|BURRO/],
  ["uova", /\bUOV/],
  ["salumi", /PROSC|BRESAOL|MORTADEL|SALAM|SPECK|COTTO|CRUDO|PANCETT|GUANCIAL|COPPA|WURST|AFFETTAT/],
  ["pollo", /POLLO|TACCHIN|\bALI\b|ROLATIN|COSCE|PETTO/],
  ["pesce", /PESCE|SALM|MERLUZZ|ORATA|BRANZIN|GAMBER|TONNO FRESCO|SPIGOL|CALAMAR|COZZE|VONGOL/],
  ["conserva", /PASSATA|PELATI|POLPA (DI )?POMOD|SUGO|PESTO|RAGU|MARMELL|CONFETTUR|MIELE|NUTELLA|CREMA SPALM|MAIONESE|MAYO|KETCH|SENAPE|OLIVE|SOTTACET|CAPPERI|SALSA|HUMMUS/],
  ["scatoletta", /TONNO|SGOMBRO|\bMAIS\b|LEGUMI|\bCECI\b|LENTICCH|FAGIOLI|SCATOL|SIMMENTHAL/],
  ["carne", /CARNE|MANZO|BOVIN|VITELL|SUINO|MAIALE|MACINAT|HAMBURG|BURGER|POLPETT|SALSICC|COTOLET|SCALOPP|ARROSTO|POLPA TRITA|SPIEDIN|BISTECC|LONZA/],
  ["olio", /\bOLIO\b|ACETO/],
  ["bevanda", /ACQUA|COCA|PEPSI|ARANCIATA|BIBITA|SUCCO|ESTATHE|BIRRA|VINO|SPREMUTA|SPRITE|FANTA|LIMONATA|THE |TONIC|SODA/],
  ["biscotti", /BISCOTT|GOCCIOLE|MERENDIN|BROWNIE|TORTA|BARCHETTE|CEREALI|MUESLI|SNACK|PATATINE|CHIPS|CIOCCOL|CARAMELL|FRISK|GOMME|WAFER|CROSTAT|PLUMCAKE|CORNFLAKES|KELLOGG/],
  ["pane", /\bPANE\b|FILONE|BAGUETTE|FOCACC|PIADIN|PIADEL|CRACKER|GRISSIN|FETTE BISC|TARALL|PANCARRE|TOAST|FRESELL|SFIZIOSO/],
  ["pasta", /PASTA|SPAGHETT|PENNE|FUSILL|RIGATON|ORECCHIETT|RUOTE|FARFALL|LASAGN|GNOCCHI|TORTELL|RAVIOL|\bRISO\b|RISOTTO|COUSCOUS|FARRO|ORZO PERLATO|LINGUINE|TAGLIATELL|NOODLE|RAMEN/],
  ["pomodoro", /POMOD|PACHINO|DATTERIN|CILIEGIN/],
  ["verdura", /LATTUG|INSALAT|ICEBERG|CATALANA|RUCOLA|SPINAC|CIMA DI RAPA|BROCCOL|CAVOL|VERZA|BIETOL|VALERIANA|BASILICO|PREZZEMOL|ERBE|INDIVIA|RADICCH/],
  ["carota", /CAROT|ZUCCHIN|MELANZ|PEPERON|FINOCCH|SEDANO|ASPARAG|FAGIOLIN|CETRIOL|PATAT|CIPOLL|AGLIO|FUNGHI|ZUCCA|PORRI|CARCIOF/],
  ["frutta", /\bMELE?\b|\bPERE?\b|BANAN|ARANC|LIMON|KIWI|FRAGOL|\bUVA\b|PESCHE|ALBICOC|FRUTTA|AVOCADO|MIRTILL|LAMPON|ANANAS|MANGO|MELONE|ANGURIA|CILIEGIE|MANDARIN|CLEMENTIN|SUSIN|PRUGN/],
];
const ZONE_ICON = { frigo: "latte", freezer: "surgelato", credenza: "scatola", pulizia: "spray", bagno: "sapone" };

export const PRODUCT_ICONS = Object.entries(ICONS).map(([id, [label]]) => ({ id, label }));

/** Il disegno adatto a un prodotto: scelto a mano, dal nome o dalla zona. */
export function iconIdFor(name, zone, chosen) {
  if (chosen && ICONS[chosen]) return chosen;
  const s = " " + String(name || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + " ";
  for (const [id, re] of MATCH) if (re.test(s)) return id;
  return ZONE_ICON[zone] || "scatola";
}

/** SVG del disegno. */
export function productIconSvg(id, label = "") {
  const icon = ICONS[id] || ICONS.scatola;
  const a11y = label ? `role="img" aria-label="${String(label).replace(/[&<>"]/g, "")}"` : `aria-hidden="true"`;
  return `<svg class="prod-ico" viewBox="0 0 64 64" ${a11y}><circle cx="34" cy="36" r="25" fill="#ffffff" opacity=".5"/><g stroke="${K}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${icon[1]}</g></svg>`;
}
