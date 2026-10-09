# Spécification du protocole WebSocket (v1)

> Document de référence pour l'implémentation du serveur WebSocket (`ws`) et du client Vue (`useWebSocket`) pour la version **v1** du projet Salon temps réel.

---

## 1. Transport et connexion

- **Protocole de transport** : WebSocket (`ws://` en développement, `wss://` en production chiffrée).
- **Point d'entrée serveur** : Port `3000` (exposé par le serveur Node.js).
- **URL de connexion** : `ws://localhost:3000/api/ws`
- **Format d'échange** : Uniquement des trames textuelles encodées en UTF-8 contenant une chaîne JSON sérialisée. Les trames binaires ne sont pas acceptées en v1.
- **Taille maximale des trames (`maxPayload`)** : **16 384 octets (16 Ko)**. Toute trame excédant cette taille est rejetée immédiatement au niveau transport.

---

## 2. Enveloppe commune des messages

Tous les messages échangés entre le client et le serveur (sans exception) partagent une structure JSON racine commune composée de trois champs :

```json
{
  "v": 1,
  "type": "<domaine>:<action>",
  "payload": { ... }
}
```

### Description des champs :
| Champ | Type | Présence | Description |
| :--- | :--- | :--- | :--- |
| `v` | Entier | Obligatoire | Version majeure du protocole (vaut `1` en v1). Permet le contrôle immédiat de compatibilité. |
| `type` | Chaîne | Obligatoire | Identifiant unique de l'action ou de l'événement, respectant la convention `<emetteur_ou_domaine>:<action>`. |
| `payload` | Objet JSON | Obligatoire | Charge utile spécifique au type de message. Isole les données métier pour éviter les collisions avec les métadonnées de l'enveloppe. |

### Règle d'extensibilité :
- Tout champ additionnel présent dans l'enveloppe ou dans un `payload` mais non reconnu par le récepteur doit être **ignoré silencieusement** (règle de robustesse).

---

## 3. Inventaire et cycle de vie des échanges

### Comparaison avec la v0 :
- En **v0**, chaque envoi `POST /api/messages` transmettait `{ author, text }`. Le serveur n'avait aucun état de session lié au client.
- En **v1**, l'identité de l'utilisateur est déclarée **une seule fois** à l'ouverture de la connexion via le message `user:identify`. Le serveur associe cet utilisateur à l'instance de socket (`ws`). Les envois ultérieurs de messages ne transportent que le champ `text`, et le serveur injecte l'auteur validé lors de la diffusion.
- En cas de message invalide, seul l'émetteur reçoit un message d'erreur `server:error` sans perturber la connexion des autres clients.

### Tableau récapitulatif des types de messages :

| Type | Sens | Rôle | Charge utile (`payload`) |
| :--- | :--- | :--- | :--- |
| `user:identify` | Client $\rightarrow$ Serveur | Identification de l'utilisateur sur la connexion | `{ username }` |
| `user:welcome` | Serveur $\rightarrow$ Client | Confirmation de l'identification et acquittement | `{ username, serverTime }` |
| `message:send` | Client $\rightarrow$ Serveur | Envoi d'un message textuel dans le salon unique | `{ text }` |
| `message:broadcast` | Serveur $\rightarrow$ Client | Diffusion d'un message à tous les clients identifiés | `{ id, author, text, at }` |
| `server:error` | Serveur $\rightarrow$ Client | Notification d'erreur applicative récupérable | `{ code, message, details? }` |

---

## 4. Spécification détaillée des charges utiles (`payload`)

### 4.1. `user:identify` (Client $\rightarrow$ Serveur)
Premier message obligatoire envoyé par le client après le handshake WebSocket. Aucun message applicatif n'est traité tant que ce message n'a pas été validé.
- `username` *(Chaîne, obligatoire)* : Nom de l'utilisateur.
  - Contraintes : 1 à 30 caractères, lettres, chiffres, tirets et underscores (`^[a-zA-Z0-9_-]{1,30}$`), non vide après suppression des espaces.

### 4.2. `user:welcome` (Serveur $\rightarrow$ Client)
Émis par le serveur en réponse à un `user:identify` valide.
- `username` *(Chaîne, obligatoire)* : Nom d'utilisateur confirmé par le serveur.
- `serverTime` *(Chaîne, obligatoire)* : Horodatage ISO 8601 UTC de la validation (`YYYY-MM-DDTHH:mm:ss.sssZ`).

### 4.3. `message:send` (Client $\rightarrow$ Serveur)
Envoyé par un client identifié pour poster un message.
- `text` *(Chaîne, obligatoire)* : Contenu du message.
  - Contraintes : 1 à 2 000 caractères UTF-8, non vide après `trim()`.

### 4.4. `message:broadcast` (Serveur $\rightarrow$ Client)
Diffusé par le serveur à l'ensemble des clients actuellement connectés et identifiés (y compris l'émetteur).
- `id` *(Entier positif, obligatoire)* : Numéro unique séquentiel croissant attribué par le serveur (`1, 2, 3...`).
- `author` *(Chaîne, obligatoire)* : Nom d'utilisateur associé à la socket émettrice.
- `text` *(Chaîne, obligatoire)* : Texte du message.
- `at` *(Chaîne, obligatoire)* : Horodatage ISO 8601 UTC attribué par le serveur lors de la réception.

### 4.5. `server:error` (Serveur $\rightarrow$ Client)
Envoyé au client responsable d'une opération erronée mais n'exigeant pas la fermeture immédiate de la connexion.
- `code` *(Chaîne, obligatoire)* : Code d'erreur machine standardisé (voir section 5).
- `message` *(Chaîne, obligatoire)* : Description lisible de l'erreur en français ou anglais.
- `details` *(Objet / Chaîne, facultatif)* : Informations complémentaires (ex. champ incriminé).

---

## 5. Gestion des erreurs et codes de fermeture

### 5.1. Erreurs applicatives récupérables (Connexion maintenue)
Le serveur répond par un message de type `server:error`. Le client reste connecté et peut corriger sa requête.

| Code d'erreur | Situation déclenchante |
| :--- | :--- |
| `UNIDENTIFIED` | Réception de `message:send` avant validation de `user:identify`. |
| `ALREADY_IDENTIFIED` | Réception multiple de `user:identify` sur une même socket déjà liée à un utilisateur. |
| `VALIDATION_ERROR` | Champ obligatoire manquant, type incorrect, ou chaîne vide. |
| `TEXT_TOO_LONG` | Contenu de `text` dépassant 2 000 caractères. |
| `USERNAME_INVALID` | Nom d'utilisateur ne respectant pas les contraintes de format (1-30 caractères). |
| `UNKNOWN_TYPE` | Type de message non géré par la version 1 du protocole. |

### 5.2. Erreurs fatales de protocole (Fermeture immédiate)
Le serveur interrompt immédiatement la connexion avec un code de fermeture standardisé (RFC 6455) ou applicatif (4000-4999) :

| Code WebSocket | Cause | Action client attendue |
| :--- | :--- | :--- |
| **`1002`** (Protocol Error) | Enveloppe JSON invalide : JSON malformé, ou objet racine ne contenant pas `v`, `type` ou `payload`. | Ne pas reconnecter immédiatement ; corriger le code client. |
| **`1003`** (Unsupported Data) | Réception d'une trame binaire (Buffer / Blob). | Basculer en trames textuelles UTF-8. |
| **`1008`** (Policy Violation) | Violation flagrante des règles de sécurité (ex. tentative d'usurpation, inondation). | Arrêt de la session. |
| **`1009`** (Message Too Big) | Taille de la trame dépassant la limite `maxPayload` (16 Ko). | Réduire la taille des données envoyées. |
| **`4001`** (Unsupported Version) | Champ `v` différent de `1`. | Mettre à jour la version du client. |

---

## 6. Stratégie de versionnage

- **Indicateur de version** : Champ `v: 1` dans l'enveloppe commune de chaque trame.
- **Règles d'évolution sans rupture (reste v1)** :
  - Ajout d'un champ facultatif dans `payload` existant.
  - Ajout d'un nouveau type de message non bloquant pour les clients actuels (ex. `client:typing`).
- **Règles de rupture nécessitant le passage en v2 (`v: 2`)** :
  - Modification de la structure de l'enveloppe racine.
  - Modification du type ou du sens d'un champ obligatoire.
  - Suppression d'un champ ou d'un type existant.
- **Politique serveur face à une version inconnue** : Rejet immédiat avec le code de fermeture `4001` et raison `"Unsupported protocol version"`.

---

## 7. Limites connues de la version v1

1. **Absence de reprise après coupure** : Contrairement à la v0 qui s'appuyait sur l'en-tête `Last-Event-ID` de SSE, la v1 ne conserve pas d'historique de reconnexion. Si un client est déconnecté, il ne reçoit pas les messages émis pendant la coupure (la reprise sera introduite en séance 8).
2. **Salon unique** : Tous les clients identifiés partagent le même espace de discussion global (les salons multiples arriveront en v2).
3. **Pas d'authentification par mot de passe** : L'identification repose uniquement sur un nom déclaré sans vérification de mot de passe ni token (l'authentification sera traitée en séance 7).

---

## 8. Exemples complets de messages

### 8.1. Échanges normaux

#### Étape 1 : Identification du client
*Client $\rightarrow$ Serveur :*
```json
{
  "v": 1,
  "type": "user:identify",
  "payload": {
    "username": "alice"
  }
}
```

*Serveur $\rightarrow$ Client (Confirmation) :*
```json
{
  "v": 1,
  "type": "user:welcome",
  "payload": {
    "username": "alice",
    "serverTime": "2026-10-09T18:00:00.123Z"
  }
}
```

#### Étape 2 : Envoi et diffusion d'un message
*Client $\rightarrow$ Serveur (Envoi) :*
```json
{
  "v": 1,
  "type": "message:send",
  "payload": {
    "text": "Bonjour à tous !"
  }
}
```

*Serveur $\rightarrow$ Tous les clients identifiés (Diffusion) :*
```json
{
  "v": 1,
  "type": "message:broadcast",
  "payload": {
    "id": 1,
    "author": "alice",
    "text": "Bonjour à tous !",
    "at": "2026-10-09T18:00:05.456Z"
  }
}
```

---

### 8.2. Cas d'erreur récupérables

#### Cas 1 : Envoi de message avant identification
*Client $\rightarrow$ Serveur :*
```json
{
  "v": 1,
  "type": "message:send",
  "payload": {
    "text": "Message envoyé trop tôt"
  }
}
```
*Serveur $\rightarrow$ Client :*
```json
{
  "v": 1,
  "type": "server:error",
  "payload": {
    "code": "UNIDENTIFIED",
    "message": "Vous devez vous identifier avec user:identify avant d'envoyer un message."
  }
}
```

#### Cas 2 : Message avec texte vide ou manquant
*Client $\rightarrow$ Serveur :*
```json
{
  "v": 1,
  "type": "message:send",
  "payload": {
    "text": "   "
  }
}
```
*Serveur $\rightarrow$ Client :*
```json
{
  "v": 1,
  "type": "server:error",
  "payload": {
    "code": "VALIDATION_ERROR",
    "message": "Le champ 'text' ne peut pas être vide.",
    "details": { "field": "text" }
  }
}
```

#### Cas 3 : Type de message inconnu
*Client $\rightarrow$ Serveur :*
```json
{
  "v": 1,
  "type": "unknown:action",
  "payload": {}
}
```
*Serveur $\rightarrow$ Client :*
```json
{
  "v": 1,
  "type": "server:error",
  "payload": {
    "code": "UNKNOWN_TYPE",
    "message": "Type de message inconnu : 'unknown:action'."
  }
}
```

---

## 9. Extensions futures (Pour aller plus loin)

### Indicateur de saisie en cours (`typing`) :
L'enveloppe permet d'ajouter ce type sans impacter les messages existants :
- `typing:status` (Client $\rightarrow$ Serveur) :
  ```json
  {
    "v": 1,
    "type": "typing:status",
    "payload": { "isTyping": true }
  }
  ```
- `typing:broadcast` (Serveur $\rightarrow$ Clients) :
  ```json
  {
    "v": 1,
    "type": "typing:broadcast",
    "payload": { "username": "alice", "isTyping": true }
  }
  ```

### Reprise après coupure (Reconnexion) :
Pour permettre à un client de rattraper les messages manqués, un type `message:sync` sera introduit :
```json
{
  "v": 1,
  "type": "message:sync",
  "payload": { "lastReceivedId": 42 }
}
```
Le serveur renverra alors une collection ordonnée des messages ayant un `id > 42`.
