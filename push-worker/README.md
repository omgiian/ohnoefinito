# Servizio notifiche (Cloudflare Worker)

Indirizzo: https://ohnoefinito-push.ohnoefinito.workers.dev

- `POST /notify` con `{ subscriptions: [{ endpoint, keys: { p256dh, auth } }], title, body, url, tag }`:
  cifra il messaggio (RFC 8291, aes128gcm), lo firma con VAPID (RFC 8292) e lo consegna ai servizi push.
  Risponde `{ sent, gone, results }`; `gone` sono le iscrizioni scadute, che l'app cancella.
- `GET /vapid-public-key`: la chiave pubblica VAPID (la stessa scritta in `app.js`).

Accetta solo richieste dall'app (`ALLOWED_ORIGINS`) e solo verso i servizi push di Apple, Google, Mozilla e Microsoft.

La chiave **privata** VAPID non è nel repository: è salvata come segreto `VAPID_PRIVATE_JWK` del worker.
Se si cambia la coppia di chiavi, va aggiornata anche `VAPID_PUBLIC` in `app.js` e ognuno deve riattivare le notifiche.

Piano gratuito di Cloudflare: 100.000 richieste al giorno.
