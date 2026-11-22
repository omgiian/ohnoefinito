# Oh no, è finito!

Lista della spesa e dispensa condivise per la casa, da usare in due sull'iPhone come un'app.

- **Spesa → Casa**: lista condivisa, la vede e la modifica chi ha il *codice di casa*.
- **Spesa → Solo mio**: lista personale, visibile solo sul tuo telefono.
- **Dispensa**: cosa c'è in casa, diviso tra Frigo, Freezer, Credenza, Pulizia casa, Bagno e cura. Con quantità, scadenze e avviso per le cose da consumare presto. Quando una quantità arriva a 0, il prodotto va da solo nella lista della spesa; quando lo spunti come comprato, in dispensa torna +1.
- **Codice a barre**: scansiona con la fotocamera per aggiungere un prodotto. Il nome viene cercato su Open Food Facts, Open Beauty Facts e Open Products Facts; i prodotti che nominate voi vengono ricordati per la volta dopo.
- **Scontrini Esselunga**: dalla Dispensa carichi il PDF dello scontrino digitale. L'app legge i prodotti (pesi e sconti compresi, ripetizioni sommate), propone nome e zona, e li aggiunge alla dispensa dopo che li hai controllati. Le correzioni vengono ricordate per i prossimi scontrini; le voci della lista della spesa comprate vengono spuntate; lo stesso scontrino non viene importato due volte per sbaglio.
- **Aggiorna**: tira giù la pagina o tocca il pulsante in alto.
- **Casa e profilo** (tocca il tuo avatar in alto): nome della casa, chi ne fa parte, il tuo nome e il tuo avatar (10 animaletti, 6 colori di sfondo), link d'invito.

Funziona anche senza rete: le modifiche si sincronizzano quando la connessione torna.

## File

- `index.html`, `styles.css`, `app.js`: l'app.
- `receipt.js`: lettura degli scontrini (PDF con [pdf.js](https://mozilla.github.io/pdf.js/), licenza Apache 2.0, in `vendor/`), nomi leggibili e zona.
- `avatars.js`: gli avatar, disegnati in SVG.
- `scanner.js`: fotocamera e ricerca dei prodotti. Usa `BarcodeDetector` dove c'è, altrimenti [ZXing](https://github.com/zxing-js/library) (`vendor/`, licenza Apache 2.0).
- `firestore.rules`: regole di sicurezza da incollare nella console Firebase.
- `manifest.webmanifest`, `sw.js`, icone: installazione sulla schermata Home e uso offline.
- `claude-artifact.html`: la prima versione, che gira solo dentro claude.ai.

## Configurazione

1. **Firestore → Regole**: incolla il contenuto di `firestore.rules` e premi *Pubblica*. Va rifatto ogni volta che il file cambia (l'ultima volta: scontrini).
2. **Authentication → Metodo di accesso**: *Anonimo* attivo.
3. **Authentication → Impostazioni → Domini autorizzati**: `omgiian.github.io`.
4. **GitHub → Settings → Pages**: *Deploy from a branch*, cartella `/ (root)`.

App: https://omgiian.github.io/ohnoefinito/

## Uso sugli iPhone

1. Apri il link in **Safari** → Condividi → **Aggiungi alla schermata Home**.
2. Apri l'app dall'icona, scrivi il tuo nome e tocca **Crea una nuova lista di casa**.
3. Manda il link d'invito all'altra persona: lei fa il passo 1, poi **Entra nella lista** con il codice.

La prima volta che scansioni, l'iPhone chiede il permesso per la fotocamera.
Il codice di casa è l'unica chiave della lista condivisa: tienilo tra voi.
La lista "Solo mio" è legata al telefono: se cancelli l'app, va persa.
