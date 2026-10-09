# Notes d'implémentation v1 — Préparation de la Séance 5

> Analyse des fonctionnalités développées « à la main » en v1 (WebSocket brut avec `ws` et `useWebSocket`), classées selon leur niveau d'abstraction (Couche Transport vs Couche Application).
> Ce document sert de point de départ pour évaluer ce que la bibliothèque **Socket.IO** prend en charge nativement.

---

## 1. Inventaire des composants écrits manuellement

| Fonctionnalité développée | Description de l'implémentation en v1 | Couche (Transport ou Application) | Justification |
| :--- | :--- | :--- | :--- |
| **Validation du format des trames** | Vérification que les données reçues sont du texte UTF-8, parsage JSON sécurisé avec `try/catch`, rejet des trames binaires (code 1003). | **Transport / Protocole** | Concerne la conformité des données brutes reçues avant tout traitement métier. |
| **Enveloppe commune & Aiguillage par type** | Définition des champs `{ v, type, payload }`, extraction du type et aiguillage via conditions / `switch`. | **Transport / Protocole** | WebSocket ne fournissant qu'un flux de messages sans sémantique d'événements nommés, le multiplexage applicatif doit être inventé. |
| **Introduction de la connexion (Session)** | Message `user:identify`, association de l'identité `ws.user` à l'instance socket pour éviter de renvoyer l'auteur à chaque message. | **Application** | Concerne la gestion de l'état de session utilisateur et le contexte métier de la conversation. |
| **Diffusion ciblée (*Broadcast*)** | Boucle manuelle sur `wss.clients` pour filtrer les sockets prêtes (`readyState === OPEN`) et identifiées (`client.user !== null`). | **Transport / Application** | WebSocket pur n'offre pas de concept de groupe ou de diffusion native (*rooms/broadcast* inexistants). |
| **Détection des connexions mortes (*Heartbeat*)** | Gestion des trames de contrôle `ping`/`pong`, minuterie `setInterval(30s)`, flag `isAlive`, et fermeture brutale `ws.terminate()`. | **Transport** | Détection au niveau réseau/socket de la défaillance des liaisons TCP silencieuses. |
| **États de connexion côté client** | Suivi réactif de l'état du socket (`connecting`, `connected`, `identified`, `disconnected`, `error`), codes de fermeture (`closeCode`, `closeReason`). | **Transport / Application** | L'état brut provient de l'API transport (`readyState`), mais l'état « identifié » est un état applicatif. |
| **Gestion et formatage des erreurs** | Codes machines standardisés (`UNIDENTIFIED`, `VALIDATION_ERROR`, etc.) encapsulés dans un message `server:error`. | **Application** | Sémantique métier pour informer le client sans clore la connexion. |

---

## 2. Conclusion pour la transition vers Socket.IO (Séance 5 & 6)

L'implémentation en WebSocket brut a nécessité beaucoup de code d'infrastructure (heartbeat, enveloppe, dispatch par événement nommé, broadcast manuel).
Ces éléments relèvent presque tous de la plomberie protocolaire que des solutions comme **Socket.IO** fournissent nativement via :
- Les événements nommés (`socket.emit('event', data)` et `socket.on('event', cb)`).
- Les salons (*rooms*) et le broadcast intégré (`io.emit(...)`, `socket.to(room).emit(...)`).
- La reconnexion automatique avec mise en mémoire tampon.
- Le heartbeat applicatif et la détection d'absence de réponse intégrés.
