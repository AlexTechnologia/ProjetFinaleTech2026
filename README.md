# VeilCraft 🌲⚔️

**Un jeu de survie multijoueur en navigateur** — récoltez des ressources, craftez des outils, et survivez aux vagues nocturnes avec vos amis.

[![GitHub Pages](https://img.shields.io/badge/Jouer-GitHub%20Pages-brightgreen)](https://alextechnologia.github.io/ProjetFinaleTech2026/)

---

## 🎮 Fonctionnalités

- **Multijoueur P2P** via WebRTC + PeerJS (STUN/TURN pour traversée NAT)
- **Génération procédurale** de l'île basée sur une seed déterministe
- **Cycle jour/nuit** avec vagues d'ennemis nocturnes qui s'intensifient
- **Récolte de ressources** : bois, roche, minerai de fer, silex, champignons
- **Système de craft** : 20+ recettes, 5 établis différents
- **Sauvegarde** du monde dans le localStorage
- **Lobby** avec code de salle partageable
- **Mode Solo** sans connexion requise
- **Audio procédural** généré via Web Audio API

## 🚀 Comment jouer

### En ligne (GitHub Pages)
Visitez : `https://alextechnologia.github.io/ProjetFinaleTech2026/`

### En local
1. Clonez le repo : `git clone https://alextechnologia.github.io/ProjetFinaleTech2026.git`
2. Ouvrez `index.html` dans un serveur local (Live Server, npx serve, etc.)
3. Partagez votre code de salle avec vos amis !

## 🕹️ Contrôles

| Touche | Action |
|--------|--------|
| WASD | Déplacement |
| Souris | Regarder |
| Clic gauche | Attaquer / Récolter |
| Shift | Sprinter |
| Espace | Sauter |
| E | Ouvrir inventaire / Interagir |
| 1-0 | Sélectionner slot de hotbar |
| Molette | Changer de slot |
| Q | Jeter l'objet |
| T | Chat |
| Tab | Liste des joueurs |
| M | Muter le son |
| ESC | Pause |

## 🔧 Technologies utilisées

- **[Three.js](https://threejs.org/)** — Rendu 3D WebGL
- **[PeerJS](https://peerjs.com/)** — Abstraction WebRTC pour le multijoueur P2P
- **WebRTC** — Communication en temps réel peer-to-peer
- **STUN Servers (Google)** — Traversée NAT pour connecter les pairs
- **Web Audio API** — Effets sonores procéduraux (aucun fichier audio)
- **HTML5 Canvas + CSS3** — Interface utilisateur
- **localStorage** — Sauvegarde des mondes

## 📡 Architecture réseau

```
Joueur 1 (Hôte) <--WebRTC DataChannel--> Joueur 2
        ^                                       
        |--WebRTC DataChannel--> Joueur 3
        
Signalisation via PeerJS Cloud + STUN Google
Topologie: étoile (l'hôte relaie entre les pairs)
```

L'hôte génère une seed de monde et la partage avec tous les joueurs rejoignants. La génération procédurale étant déterministe, tous les clients obtiennent un monde identique sans transférer les données de terrain.

## 🗂️ Structure du projet

```
island-survivor/
├── index.html          # Menu principal + lobby
├── game.html           # Page de jeu
├── css/
│   └── game.css        # Styles du jeu
├── js/
│   ├── main.js         # Orchestrateur principal + boucle de jeu
│   ├── network.js      # Couche réseau WebRTC/PeerJS
│   ├── world.js        # Génération procédurale du monde
│   ├── player.js       # Contrôleur joueur + stats
│   ├── entities.js     # Ressources, ennemis, objets au sol
│   ├── crafting.js     # Système de craft + recettes
│   ├── ui.js           # Gestion de l'interface
│   ├── audio.js        # Audio procédural (Web Audio API)
│   └── save.js         # Sauvegarde/chargement localStorage
└── README.md
```

## 📓 Journal de développement

Voir [journal.html](journal.html) pour le journal de bord complet (8 jours de développement).

## 🎓 Contexte académique

Ce projet a été réalisé dans le cadre du cours **ICS3U — Informatique et programmation** comme projet final valant 30% de la note finale. Développé en équipe de 2 sur une période de 8 jours.
Ce projet a été réalisé dans le cadre du cours **ICS4U — Informatique et programmation** comme projet final valant 30% de la note finale. Développé en équipe de 2 sur une période de 8 jours.

### Concepts démontrés
- Programmation orientée objet (classes ES6)
- Architecture client-serveur / P2P
- Protocoles réseau (WebRTC, STUN, TURN)
- Génération procédurale algorithmique
- Gestion d'état distribué
- Cycle de développement agile

---

*Projet ICS4U — École secondaire — Juin 2026*
