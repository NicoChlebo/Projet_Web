# Salon Temps Réel — Version v1 (WebSocket)

Application de discussion et de travail collaboratif en temps réel développée dans le cadre du module **Web Temps Réel**.

## 🚀 Démarrage rapide

### Prérequis
- Node.js (version 18+ LTS recommandée)
- npm

### 1. Démarrer le serveur (Port 3000)
```bash
cd server
npm install
npm run dev
# ou depuis la racine : npm --prefix server run dev
```
Le serveur Express et WebSocket démarre sur `http://localhost:3000` et écoute sur `ws://localhost:3000/api/ws`.

Pour lancer les tests automatisés du protocole :
```bash
npm --prefix server test
```

### 2. Démarrer le client Vue / Vite (Port 5173)
```bash
cd client
npm install
npm run dev
# ou depuis la racine : npm --prefix client run dev
```
L'application client est accessible sur `http://localhost:5173`. Le proxy de développement Vite redirige les requêtes `/api/*` et assure le relais WebSocket (`ws: true`).

---

## 📋 Fonctionnalités de la v1 (Séance 4)

- **Communication WebSocket pure** : Suppression intégrale de SSE et des requêtes HTTP POST pour les messages au profit d'un canal unique bidirectionnel sur `/api/ws`.
- **Identification par socket** : L'utilisateur s'identifie à la connexion avec `user:identify` et reçoit la confirmation `user:welcome`.
- **Diffusion temps réel** : Les messages `message:send` sont validés par le serveur puis diffusés sous forme `message:broadcast` à tous les clients connectés et identifiés.
- **Composable Vue `useWebSocket`** : Encapsule la gestion du cycle de vie du socket natif, gère l'état réactif de la connexion et ferme proprement la connexion au démontage du composant (`onUnmounted`).
- **Détection des connexions mortes (*Heartbeat*)** : Minuterie serveur envoyant des trames de contrôle `ping` toutes les 30 secondes et résiliant les sockets inactives ne renvoyant pas de trame `pong`.
- **Gestion stricte des erreurs** : Messages applicatifs `server:error` en cas d'erreur de saisie, et codes de fermeture WebSocket standards (1002, 1003, 1009, 4001) en cas de violation de protocole.
- **Documentation & Spécifications** :
  - Spécification du protocole : [`docs/protocole-messages.md`](docs/protocole-messages.md)
  - Analyse comparative des technologies : [`docs/choix-technologiques.md`](docs/choix-technologiques.md)
  - Notes d'implémentation et préparation séance 5 : [`docs/notes-v1.md`](docs/notes-v1.md)
