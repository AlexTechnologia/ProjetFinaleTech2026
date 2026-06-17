// network.js — Couche réseau WebRTC P2P via PeerJS
// Utilise les serveurs STUN de Google pour la traversée NAT
// @authors Eric Villeneuve & Alex Musial — ICS3U 2026

'use strict';

// Serveurs ICE (STUN) pour traversée NAT — fournis gratuitement par Google
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:3478' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:3478' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Types de messages réseau
const MSG = {
  PLAYER_UPDATE: 'PLAYER_UPDATE',
  WORLD_SYNC: 'WORLD_SYNC',
  ENTITY_UPDATE: 'ENTITY_UPDATE',
  RESOURCE_DESTROYED: 'RESOURCE_DESTROYED',
  ITEM_DROPPED: 'ITEM_DROPPED',
  ITEM_PICKED: 'ITEM_PICKED',
  CRAFTED: 'CRAFTED',
  WAVE_START: 'WAVE_START',
  WAVE_END: 'WAVE_END',
  CHAT: 'CHAT',
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  WORKSTATION_PLACED: 'WORKSTATION_PLACED',
  PING: 'PING',
  PONG: 'PONG',
  HOST_MIGRATE: 'HOST_MIGRATE',
};

class Network {
  constructor() {
    this.peer = null;          // Instance PeerJS locale
    this.roomId = null;        // Code de la salle (ID PeerJS de l'hôte)
    this.mode = 'solo';        // 'solo', 'host', 'join'
    this.connections = new Map(); // peerId -> DataConnection
    this.playerOrder = [];     // Ordre de connexion (pour migration d'hôte)
    this.isHost = false;
    this.myId = null;
    this.latencies = new Map(); // peerId -> latence en ms
    this.pingTimers = new Map();
    
    // Callbacks — définis par main.js
    this.onMessage = null;       // (type, data, fromId) => void
    this.onPlayerJoined = null;  // (peerId) => void
    this.onPlayerLeft = null;    // (peerId) => void
    this.onConnected = null;     // () => void
    this.onError = null;         // (err) => void
  }

  // Initialise la connexion selon le mode
  async init(mode, roomId) {
    this.mode = mode;
    this.roomId = roomId;

    if (mode === 'solo') {
      this.isHost = true;
      this.myId = 'solo_' + Math.random().toString(36).substr(2, 8);
      if (this.onConnected) this.onConnected();
      return;
    }

    // Créer l'instance PeerJS avec config STUN
    const peerId = (mode === 'host') ? 'vc_' + roomId : undefined;
    
    this.peer = new Peer(peerId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      config: { iceServers: ICE_SERVERS },
      debug: 1,
    });

    this.peer.on('open', (id) => {
      this.myId = id;
      console.log('[Network] PeerJS connecté, ID:', id);
      
      if (mode === 'host') {
        this.isHost = true;
        this.playerOrder.push(id);
        if (this.onConnected) this.onConnected();
      } else {
        // Rejoindre: se connecter à l'hôte
        this._connectToPeer('vc_' + roomId, true);
      }
    });

    // L'hôte accepte les connexions entrantes
    this.peer.on('connection', (conn) => {
      this._setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('[Network] Erreur PeerJS:', err.type, err);
      if (this.onError) this.onError(err);
    });

    this.peer.on('disconnected', () => {
      console.warn('[Network] Déconnecté du serveur PeerJS, tentative de reconnexion...');
      setTimeout(() => {
        if (this.peer && !this.peer.destroyed) this.peer.reconnect();
      }, 2000);
    });
  }

  // Établit une connexion avec un pair et configure les événements
  _connectToPeer(peerId, isHost = false) {
    const conn = this.peer.connect(peerId, {
      reliable: true,
      serialization: 'json',
    });
    this._setupConnection(conn, isHost);
  }

  // Configure une connexion DataChannel (entrant ou sortant)
  _setupConnection(conn, isHostConn = false) {
    conn.on('open', () => {
      console.log('[Network] Connexion ouverte avec:', conn.peer);
      this.connections.set(conn.peer, conn);
      this.playerOrder.push(conn.peer);
      
      if (this.onPlayerJoined) this.onPlayerJoined(conn.peer);
      
      // Si on est l'hôte, envoyer la synchro du monde au nouveau joueur
      if (this.isHost && this.onMessage) {
        this.onMessage('__REQUEST_WORLD_SYNC__', {}, conn.peer);
      }
      
      // Si c'est la connexion avec l'hôte, signaler qu'on est connecté
      if (isHostConn && this.onConnected) {
        this.myId = this.peer.id;
        this.onConnected();
      }

      // Démarrer le ping périodique pour mesurer la latence
      this._startPing(conn.peer);
    });

    conn.on('data', (data) => {
      this._handleMessage(data, conn.peer);
    });

    conn.on('close', () => {
      console.log('[Network] Connexion fermée avec:', conn.peer);
      this.connections.delete(conn.peer);
      this.latencies.delete(conn.peer);
      const idx = this.playerOrder.indexOf(conn.peer);
      if (idx > -1) this.playerOrder.splice(idx, 1);
      
      if (this.onPlayerLeft) this.onPlayerLeft(conn.peer);
      
      // Si l'hôte est parti et qu'on est le prochain dans l'ordre, on devient hôte
      if (!this.isHost && this.playerOrder.length > 0 && 
          this.playerOrder[0] === this.myId) {
        this._becomeHost();
      }
    });

    conn.on('error', (err) => {
      console.error('[Network] Erreur connexion:', err);
    });
  }

  // Traite un message reçu
  _handleMessage(data, fromId) {
    if (!data || !data.type) return;
    
    // Gérer PING/PONG pour la latence
    if (data.type === MSG.PING) {
      this.send(fromId, MSG.PONG, { timestamp: data.data.timestamp });
      return;
    }
    if (data.type === MSG.PONG) {
      const rtt = Date.now() - data.data.timestamp;
      this.latencies.set(fromId, Math.round(rtt / 2));
      return;
    }

    // Si on est l'hôte, relayer le message aux autres clients
    if (this.isHost && data.relay !== false) {
      this.connections.forEach((conn, peerId) => {
        if (peerId !== fromId) {
          conn.send({ ...data, relay: false, originalSender: fromId });
        }
      });
    }

    if (this.onMessage) {
      this.onMessage(data.type, data.data, fromId, data.originalSender);
    }
  }

  // Envoie un message à un pair spécifique
  send(peerId, type, data) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send({ type, data, timestamp: Date.now() });
    }
  }

  // Diffuse un message à tous les pairs connectés
  broadcast(type, data, excludeId = null) {
    const msg = { type, data, timestamp: Date.now() };
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludeId && conn.open) {
        conn.send(msg);
      }
    });
  }

  // Démarre le ping périodique vers un pair
  _startPing(peerId) {
    const timer = setInterval(() => {
      if (!this.connections.has(peerId)) {
        clearInterval(timer);
        return;
      }
      this.send(peerId, MSG.PING, { timestamp: Date.now() });
    }, 3000);
    this.pingTimers.set(peerId, timer);
  }

  // Migration d'hôte: ce client devient le nouvel hôte
  _becomeHost() {
    console.log('[Network] Migration d\'hôte — je deviens l\'hôte');
    this.isHost = true;
    this.broadcast(MSG.HOST_MIGRATE, { newHostId: this.myId });
    if (this.onMessage) {
      this.onMessage(MSG.HOST_MIGRATE, { newHostId: this.myId }, this.myId);
    }
  }

  // Retourne la latence vers un pair (en ms)
  getLatency(peerId) {
    return this.latencies.get(peerId) || 0;
  }

  // Retourne le nombre de joueurs connectés
  getPlayerCount() {
    return this.connections.size + 1; // +1 pour soi-même
  }

  // Déconnexion propre
  disconnect() {
    this.pingTimers.forEach((timer) => clearInterval(timer));
    this.connections.forEach((conn) => conn.close());
    if (this.peer) this.peer.destroy();
  }
}

// Instance globale du réseau
const network = new Network();
