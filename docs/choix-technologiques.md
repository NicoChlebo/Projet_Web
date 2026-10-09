# Projet fil rouge — Séance 1 : Cahier des charges et choix technologiques

## 1. Synthèse du Cahier des charges (« Salon temps réel »)

L'application est une plateforme web collaborative et de messagerie instantanée en temps réel :
- **Utilisateurs & Accès** : Comptes de démonstration prédéfinis (`alice`, `bob`, `carol`), gestion d'un rôle `staff` donnant accès à un salon réservé. Multi-connexions / multi-onglets autorisés pour un même utilisateur.
- **Salons fixes** : `general`, `tech`, `random` (publics) et `staff` (restreint).
- **Messagerie** : Messages de 1 à 2 000 caractères, horodatés et numérotés par le serveur, avec identifiant client pour le dédoublonnage et accusé de réception (accepté / refusé).
- **Présence & Saisie** : Liste des présents par salon sans doublons d'onglets (mise à jour à chaque arrivée / départ / déconnexion brutale) ; indicateur « en train d'écrire » non intrusif.
- **Note partagée** : Note textuelle collaborative par salon, gérée par concurrence optimiste (numéro de version, horodatage, auteur) pour prévenir les écrasements involontaires.
- **Résilience réseau** : Reconnexion automatique après coupure avec reprise ordonnée des messages manqués sans doublon via un curseur d'historique.
- **Sécurité & Contrôle** : Authentification requise, validation des schémas de données, limitation de débit (rate limiting), protection contre les injections XSS.
- **Architecture cible** : Docker Compose, multi-instances Node.js, cache/mémoire Redis, répartiteur de charge (Load Balancer).

---

## 2. Étape 1 — Caractériser chaque besoin

| Besoin | Sens des échanges | Fréquence | Latence tolérée | Perte tolérée | Données (texte, binaire) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Messages et accusés** | **Bidirectionnel**<br>(Client $\rightarrow$ Serveur : envoi)<br>(Serveur $\rightarrow$ Client : accusé + diffusion) | **Moyenne**<br>(ponctuelle, par rafales humaines lors des conversations) | **Faible**<br>($< 1\text{ s}$) | **Nulle**<br>(aucun message ne doit être perdu ni dupliqué) | **Texte**<br>(JSON : id, author, text, date, salon, clientId) |
| **2. Présence et saisie** | **Bidirectionnel**<br>(Client $\rightarrow$ Serveur : signalement/typing)<br>(Serveur $\rightarrow$ Clients : diffusion d'état) | **Mixte** :<br>- Présence : faible/événementielle<br>- Saisie : élevée (pendant la frappe) | **Faible**<br>($< 500\text{ ms}$ pour la saisie) | **Mixte** :<br>- Présence : **Nulle** (état critique)<br>- Saisie : **Élevée** (indicateur éphémère) | **Texte**<br>(JSON : userId, action, salon, timestamp) |
| **3. Note partagée** | **Bidirectionnel**<br>(Client $\rightarrow$ Serveur : soumission modif)<br>(Serveur $\rightarrow$ Clients : diffusion état/conflit) | **Faible à moyenne**<br>(quelques modifications par minute) | **Moyenne**<br>($1\text{ à }2\text{ s}$, concurrence optimiste) | **Nulle**<br>(intégrité du document et de ses versions) | **Texte**<br>(JSON : salon, version, texte, auteur, date) |
| **5. Reprise après coupure** | **Bidirectionnel**<br>(Client $\rightarrow$ Serveur : dernier ID reçu)<br>(Serveur $\rightarrow$ Client : rattrapage des messages) | **Très faible**<br>(uniquement lors d'une reconnexion après rupture) | **Faible**<br>($< 1\text{ à }2\text{ s}$ pour rattraper le retard) | **Nulle**<br>(reprise exhaustive et ordonnée sans doublon) | **Texte**<br>(En-tête Last-Event-ID / JSON de messages) |

### Pistes d'orientation :
- **Présence vs Saisie (Besoin 2)** : La présence est un état persistant nécessitant une fiabilité absolue (perte non tolérée, sous peine de laisser des utilisateurs "fantômes"). La saisie en cours est une notification volatile et fréquente : perdre un événement "en train d'écrire" n'a aucun impact fonctionnel car le prochain événement ou le message final corrigera l'état.
- **Concurrence sur la note (Besoin 3)** : Plusieurs utilisateurs peuvent soumettre un texte simultanément. L'application utilisant un verrouillage optimiste avec numéro de version, si l'utilisateur B valide sa version 7 avant l'utilisateur A, la requête de A est rejetée avec un conflit (HTTP 409). A reçoit la version courante du serveur sans écraser son brouillon local.
- **Rattrapage d'historique (Besoin 5)** : Le serveur doit conserver en mémoire (ou dans Redis) un tampon ordonné des derniers messages émis (ex. ring buffer de 50 à 100 messages avec IDs croissants) indexé par salon pour rejouer les messages dont l'ID est supérieur à celui envoyé par le client reconnecté.

---

## 3. Étape 2 — Choisir une technologie par besoin

Pour chaque besoin, une technologie est retenue parmi : **Polling**, **Long Polling**, **Server-Sent Events (SSE)**, **WebSocket**.

### 1. Messages et accusés
- **Technologie retenue** : **Server-Sent Events (SSE) pour la diffusion + POST HTTP pour l'envoi** *(ou WebSocket bidirectionnel complet)*.
- **Justification** : L'envoi par POST HTTP fournit immédiatement un accusé de réception synchrone (HTTP 201 avec ID attribué, ou 400/403/429 avec motif clair), tandis que le flux SSE permet une diffusion descendante immédiate à faible surcoût sans interrogation inutile.
- **Principale limite** : Asymétrie architecturale imposant deux tuyaux de communication distincts (POST REST pour l'émission, stream SSE pour la réception).

### 2. Présence et saisie en cours
- **Technologie retenue** : **WebSocket** *(ou SSE pour la diffusion avec debounce + POST HTTP/heartbeat pour l'émission)*.
- **Justification** : L'indicateur de saisie génère des rafales d'événements fréquents et légers qui nécessitent un surcoût d'en-tête minimal (frames WebSocket de 2 à 14 octets contre plusieurs centaines d'octets pour chaque requête HTTP).
- **Principale limite** : La détection des connexions mortes ou départs brutaux nécessite d'implémenter soi-même un mécanisme applicatif de battement de cœur (*heartbeat* / ping-pong).

### 3. Note partagée
- **Technologie retenue** : **POST/PUT HTTP (transactionnel avec contrôle optimiste) + SSE (pour la diffusion)**.
- **Justification** : La mise à jour de la note repose sur une comparaison de version atomique où les codes de statut HTTP standard (200 OK ou 409 Conflict) expriment nativement le résultat au client émetteur, avant de diffuser l'état validé aux autres membres via le flux temps réel.
- **Principale limite** : Non adapté à de la co-édition au caractère près (type Google Docs) ; les conflits fréquents en cas d'éditions rapprochées obligent l'utilisateur à fusionner manuellement.

### 5. Reprise après coupure
- **Technologie retenue** : **Server-Sent Events (SSE)**.
- **Justification** : Le protocole SSE intègre nativement la reconnexion automatique côté navigateur avec transmission standardisée de l'en-tête `Last-Event-ID`, permettant au serveur de rejouer immédiatement le delta sans logique client complexe.
- **Principale limite** : Si la déconnexion dure plus longtemps que la taille du tampon d'historique en mémoire du serveur, le mécanisme de reprise échoue et impose un rechargement complet de l'état du salon.

---

## 4. Étape 3 — Repérer les contraintes des autres besoins

Pour préparer les séances ultérieures, voici les interrogations majeures soulevées par nos choix :

1. **Besoin 4 — Authentification, validation, limitation de débit** :
   * *Question clé* : Comment authentifier le flux de streaming (SSE ou WebSocket) sachant que les API standard du navigateur (`new EventSource(...)` ou `new WebSocket(...)`) ne permettent pas d'ajouter des en-têtes HTTP personnalisés (`Authorization: Bearer <token>`) ? Devra-t-on passer par un cookie de session HttpOnly ou un jeton éphémère transmis en paramètre de requête (`query string`) ?

2. **Besoin 6 — Déploiement multi-instances avec Redis et répartiteur de charge** :
   * *Question clé* : Lorsque deux clients connectés à un même salon sont aiguillés par le répartiteur de charge sur deux conteneurs Node.js distincts, comment synchroniser la diffusion des messages et maintenir un état de présence cohérent sans état partagé dans la mémoire locale de chaque processus (nécessité d'un bus Redis Pub/Sub) ?

3. **Besoin 7 — Tests automatisés et test de charge** :
   * *Question clé* : Comment instrumenter un banc de test de charge (ex. k6, Artillery ou scripts Node.js) capable d'émuler simultanément des milliers de connexions persistantes (SSE / WS) tout en mesurant précisément le débit réel (messages/sec) et la latence de bout en bout ?

---

## 5. Étape 4 — Relire et confronter

### Comparaison avec une architecture alternative (« Tout-WebSocket ») :
- **Points de divergence** :
  - Dans une approche **Tout-WebSocket**, l'ensemble des communications (envois, réceptions, typing, note, présence) passe par un unique canal bidirectionnel persistant.
  - Cela élimine l'asymétrie SSE + HTTP POST et réduit drastiquement l'overhead réseau pour la saisie et les accusés de réception.
- **Arguments pour et contre** :
  - *Avantages du modèle SSE + REST (v0)* : Simplicité de mise en place au démarrage, utilisation des méthodes et statuts HTTP conventionnels (REST), reconnexion et reprise d'ID gérées automatiquement par le navigateur, traversée transparente des proxys et pare-feux.
  - *Limites face à WebSocket / Socket.IO* : En cas de forte activité de saisie ("alice tape..."), la multiplication des requêtes POST HTTP sature inutilement l'Event Loop et le réseau avec des en-têtes volumineux. De plus, la reconnexion SSE ne s'applique qu'au flux descendant, pas aux requêtes d'envoi échouées.
- **Décision d'évolution** :
  - Adopter l'approche **SSE + HTTP POST** pour la première itération (**v0**, séance 2), puis faire évoluer l'architecture vers **WebSocket pur (v1)** puis **Socket.IO (v2)**, comme prévu par la progression pédagogique du module.

---

## 6. Pour aller plus loin

- **Besoin le moins adapté à SSE + HTTP** : **L'indicateur de saisie en cours** (besoin 2).
- **Raison** : Envoyer un POST HTTP à chaque séquence de frappe (même avec débouncing) crée une surcharge importante (connexion TCP/TLS ou requêtes HTTP répétées avec plusieurs centaines d'octets d'en-têtes pour un simple booléen).
- **Ce qui ferait basculer le choix vers WebSocket dès le départ** :
  - Une augmentation significative du nombre d'utilisateurs simultanés actifs dans les salons.
  - Une exigence de communication bidirectionnelle haute fréquence (jeux en ligne, co-écriture lettre par lettre, audio/vidéo).

---

## 7. Observations sur la première version (v0)

- **Latence mesurée** :
  - Flux descendant SSE : quasi instantané ($< 20\text{ ms}$ en local). Le message est écrit dans le flux des clients connectés dans la même itération de l'Event Loop que la complétion de la requête POST.
- **Nombre de requêtes et overhead** :
  - Une seule connexion persistante `GET /api/stream` par onglet client.
  - Une requête ponctuelle `POST /api/messages` par émission.
  - Aucun polling inutile en période d'inactivité (0 requête).
- **Comportement à la coupure réseau** :
  - Côté client : la coupure déclenche immédiatement `onerror` sur l'objet `EventSource`. L'interface bascule en état visuel d'avertissement (« Connexion interrompue, tentative de reconnexion... »).
  - Reconnexion automatique : le navigateur réessaye automatiquement de se reconnecter selon la directive `retry: 3000` sans recharger la page.
  - Reprise avec `Last-Event-ID` : à la reconnexion, le navigateur transmet automatiquement le dernier identifiant reçu. Le serveur rejoue alors fidèlement les messages émis pendant la coupure avant d'inscrire le client dans les abonnés actifs.
  - **Limite critique observée** : La mémoire vive étant volatile, un redémarrage complet du serveur Express réinitialise le tableau de messages et le compteur d'IDs (`nextId = 1`). Si un client envoie un `Last-Event-ID` supérieur aux nouveaux IDs, la reprise échoue silencieusement. Cette limite justifie pleinement l'utilisation future de Redis (séance 9) pour persister l'historique et l'ordonnancement.
