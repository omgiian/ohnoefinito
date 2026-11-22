# Oh no, è finito!

Lista condivisa di ciò che è finito in casa (cibo, prodotti per la pulizia, igiene…), da usare in due sull'iPhone come un'app.

- **Casa**: lista condivisa, la vede e la modifica chi ha il *codice di casa*.
- **Solo mio**: lista personale, visibile solo sul tuo telefono.

Funziona anche senza rete: le modifiche si sincronizzano quando la connessione torna.

## Come è fatta

- `index.html`: tutta l'app (HTML, CSS, JS), pubblicata con GitHub Pages.
- Dati su **Firebase Firestore** (piano gratuito Spark), accesso anonimo con Firebase Auth.
- `firestore.rules`: regole di sicurezza da incollare nella console Firebase.
- `manifest.webmanifest`, `sw.js`, icone: per installarla sulla schermata Home e aprirla offline.
- `claude-artifact.html`: la prima versione, che gira solo dentro claude.ai.

## Configurazione (una volta sola)

1. **Firestore → Regole**: incolla il contenuto di `firestore.rules` e premi *Pubblica*.
2. **Authentication → Metodo di accesso**: *Anonimo* attivo.
3. **Authentication → Impostazioni → Domini autorizzati**: aggiungi `omgiian.github.io`.
4. **GitHub → Settings → Pages**: *Deploy from a branch*, ramo `claude/amazing-heisenberg-bpyhd5` (o `main` dopo il merge), cartella `/ (root)`.

L'app sarà su https://omgiian.github.io/ohnoefinito/

## Uso sugli iPhone

1. Apri il link in **Safari** → Condividi → **Aggiungi alla schermata Home**.
2. Apri l'app dall'icona, scrivi il tuo nome e tocca **Crea una nuova lista di casa**.
3. Manda il link d'invito (o il codice) all'altra persona: lei fa lo stesso passo 1, poi **Entra nella lista** con il codice.

Il codice di casa è l'unica "chiave" della lista condivisa: tienilo tra voi.
La lista "Solo mio" è legata al telefono: se cancelli l'app o i dati di Safari, va persa.
