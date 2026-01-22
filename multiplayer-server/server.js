const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3001);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const app = express();
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();
const clients = new Map();

const defaultPlayers = {
  ddz: 3,
  guandan: 4,
  mahjong: 4
};

const sha256 = (input) => crypto.createHash('sha256').update(input).digest('hex');
const now = () => Date.now();

function shortCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function makeRoom({ ownerId, gameType, maxPlayers, rules, isPrivate }) {
  const id = shortCode();
  return {
    id,
    gameType,
    maxPlayers,
    rules: rules || {},
    isPrivate: Boolean(isPrivate),
    createdAt: now(),
    hostId: ownerId,
    players: new Map(),
    status: 'waiting',
    round: null,
    history: []
  };
}

function broadcastRoom(room, payload) {
  const message = JSON.stringify(payload);
  room.players.forEach((player) => {
    if (player.ws.readyState === 1) {
      player.ws.send(message);
    }
  });
}

function listRooms() {
  const list = [];
  rooms.forEach((room) => {
    if (room.isPrivate) return;
    list.push({
      id: room.id,
      gameType: room.gameType,
      maxPlayers: room.maxPlayers,
      playerCount: room.players.size,
      status: room.status
    });
  });
  return list;
}

function ensureOriginAllowed(origin) {
  if (!ALLOWED_ORIGINS.length) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function setHostIfNeeded(room) {
  if (room.hostId && room.players.has(room.hostId)) return;
  const next = room.players.keys().next().value;
  room.hostId = next || null;
}

function removeClientFromRoom(clientId) {
  const client = clients.get(clientId);
  if (!client || !client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room) return;
  room.players.delete(clientId);
  setHostIfNeeded(room);
  broadcastRoom(room, {
    type: 'room_update',
    roomId: room.id,
    hostId: room.hostId,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      ready: p.ready
    }))
  });
  if (room.players.size === 0) {
    rooms.delete(room.id);
  }
  client.roomId = null;
}

wss.on('connection', (ws, req) => {
  if (!ensureOriginAllowed(req.headers.origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }

  const clientId = crypto.randomUUID();
  clients.set(clientId, { id: clientId, ws, roomId: null });

  ws.send(JSON.stringify({ type: 'welcome', clientId, rooms: listRooms() }));

  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const client = clients.get(clientId);
    if (!client) return;

    if (message.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', ts: now() }));
      return;
    }

    if (message.type === 'list_rooms') {
      ws.send(JSON.stringify({ type: 'room_list', rooms: listRooms() }));
      return;
    }

    if (message.type === 'hello') {
      client.name = message.name || 'Player';
      client.address = message.address || '';
      ws.send(JSON.stringify({ type: 'hello_ack', id: clientId }));
      return;
    }

    if (message.type === 'create_room') {
      if (client.roomId) removeClientFromRoom(clientId);
      const gameType = message.gameType || 'ddz';
      const maxPlayers = message.maxPlayers || defaultPlayers[gameType] || 4;
      const room = makeRoom({
        ownerId: clientId,
        gameType,
        maxPlayers,
        rules: message.rules,
        isPrivate: message.isPrivate
      });
      rooms.set(room.id, room);
      room.players.set(clientId, {
        id: clientId,
        name: client.name || 'Player',
        address: client.address || '',
        ready: false,
        ws
      });
      client.roomId = room.id;
      ws.send(JSON.stringify({ type: 'room_created', roomId: room.id }));
      broadcastRoom(room, {
        type: 'room_update',
        roomId: room.id,
        hostId: room.hostId,
        players: Array.from(room.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          ready: p.ready
        }))
      });
      return;
    }

    if (message.type === 'join_room') {
      const room = rooms.get(message.roomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
      }
      if (room.players.size >= room.maxPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room full' }));
        return;
      }
      if (client.roomId && client.roomId !== room.id) {
        removeClientFromRoom(clientId);
      }
      room.players.set(clientId, {
        id: clientId,
        name: client.name || 'Player',
        address: client.address || '',
        ready: false,
        ws
      });
      client.roomId = room.id;
      broadcastRoom(room, {
        type: 'room_update',
        roomId: room.id,
        hostId: room.hostId,
        players: Array.from(room.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          ready: p.ready
        }))
      });
      return;
    }

    if (message.type === 'leave_room') {
      removeClientFromRoom(clientId);
      ws.send(JSON.stringify({ type: 'left_room' }));
      return;
    }

    const room = client.roomId ? rooms.get(client.roomId) : null;
    if (!room) return;

    if (message.type === 'ready') {
      const player = room.players.get(clientId);
      if (!player) return;
      player.ready = Boolean(message.ready);
      broadcastRoom(room, {
        type: 'room_update',
        roomId: room.id,
        hostId: room.hostId,
        players: Array.from(room.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          ready: p.ready
        }))
      });
      return;
    }

    if (message.type === 'start_match') {
      if (room.hostId !== clientId) return;
      const allReady = Array.from(room.players.values()).every((p) => p.ready);
      if (!allReady) {
        ws.send(JSON.stringify({ type: 'error', message: 'Players not ready' }));
        return;
      }
      room.status = 'committing';
      const roundId = crypto.randomUUID();
      const serverNonce = crypto.randomBytes(16).toString('hex');
      room.round = {
        id: roundId,
        serverCommit: sha256(serverNonce),
        serverNonce,
        commits: new Map(),
        reveals: new Map()
      };
      broadcastRoom(room, {
        type: 'round_start',
        roundId,
        serverCommit: room.round.serverCommit
      });
      return;
    }

    if (message.type === 'commit') {
      if (!room.round || room.status !== 'committing') return;
      room.round.commits.set(clientId, message.commit);
      if (room.round.commits.size === room.players.size) {
        room.status = 'revealing';
        broadcastRoom(room, { type: 'reveal_start', roundId: room.round.id });
      }
      return;
    }

    if (message.type === 'reveal') {
      if (!room.round || room.status !== 'revealing') return;
      const expected = room.round.commits.get(clientId);
      const actual = sha256(message.reveal || '');
      if (expected && expected !== actual) {
        ws.send(JSON.stringify({ type: 'error', message: 'Reveal mismatch' }));
        return;
      }
      room.round.reveals.set(clientId, message.reveal);
      if (room.round.reveals.size === room.players.size) {
        const revealConcat = Array.from(room.round.reveals.values()).join('|');
        const seed = sha256(`${room.round.serverNonce}|${revealConcat}`);
        room.status = 'playing';
        broadcastRoom(room, {
          type: 'round_seed',
          roundId: room.round.id,
          serverReveal: room.round.serverNonce,
          seed
        });
      }
      return;
    }

    if (message.type === 'action') {
      room.history.push({
        ts: now(),
        by: clientId,
        action: message.action,
        payload: message.payload || {}
      });
      broadcastRoom(room, {
        type: 'action',
        by: clientId,
        action: message.action,
        payload: message.payload || {}
      });
      return;
    }

    if (message.type === 'request_settle') {
      room.status = 'settling';
      room.lastSettle = {
        hash: message.resultHash,
        ts: now(),
        by: clientId
      };
      broadcastRoom(room, {
        type: 'settle_requested',
        by: clientId,
        resultHash: message.resultHash
      });
      return;
    }

    if (message.type === 'arbitrate') {
      room.status = 'arbitration';
      broadcastRoom(room, {
        type: 'arbitration_requested',
        by: clientId,
        evidenceHash: message.evidenceHash,
        note: message.note || ''
      });
    }
  });

  ws.on('close', () => {
    removeClientFromRoom(clientId);
    clients.delete(clientId);
  });
});

server.listen(PORT, () => {
  console.log(`[multiplayer] listening on ${PORT}`);
});
