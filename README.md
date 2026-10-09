# Salon Temps Réel — Version v0

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
Le serveur Express démarre sur `http://localhost:3000`.

### 2. Démarrer le client Vue / Vite (Port 5173)
```bash
cd client
npm install
npm run dev
# ou depuis la racine : npm --prefix client run dev
```
L'application client est accessible sur `http://localhost:5173`. Le proxy de développement Vite redirige automatiquement toutes les requêtes relatives `/api/*` vers `http://localhost:3000`.

---

## 📋 Fonctionnalités de la v0 (Séance 2)

- **Diffusion temps réel** : Les messages envoyés via `POST /api/messages` sont diffusés à tous les clients connectés via le flux SSE `GET /api/stream`.
- **Indicateur de connexion** : L'interface affiche en temps réel le statut (« Connecté », « En cours de reconnexion... », « Déconnecté »).
- **Reprise après coupure réseau** : À la reconnexion, l'en-tête `Last-Event-ID` permet au serveur de rejouer les messages manqués dans l'ordre sans doublon.
- **Accusés d'envoi & validation** : Statut HTTP `201 Created` en cas de succès, `400 Bad Request` si les champs `author` ou `text` sont manquants ou vides. Conservation du texte dans le formulaire en cas d'erreur réseau.
- **Documentation technique** : Analyse des besoins et justification technologique consignées dans [`docs/choix-technologiques.md`](docs/choix-technologiques.md).
