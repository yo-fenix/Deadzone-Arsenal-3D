import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { build as viteBuild, createServer as createViteServer } from 'vite';
import type {
  CharacterConfig,
  MultiplayerSubMode,
  PlatformType,
  RemotePlayerState,
  RoomSummary,
  ServerZombieState,
  WeaponId,
  ZombieType,
} from './src/types/game';
import {
  CITY_ARENA_HALF,
  SURVIVAL_ARENA_COLLIDERS,
  hasLineOfSightXZ,
  resolveCircleAABBCollisions,
  steerAroundWalls,
} from './src/three/arenaColliders';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
}

interface ServerPlayer extends RemotePlayerState {
  lastBiteAt: number;
  respawnAt: number;
}

interface ServerRoom {
  code: string;
  name: string;
  subMode: MultiplayerSubMode;
  players: Map<string, ServerPlayer>;
  zombies: Map<string, ServerZombieState>;
  wave: number;
  zombiesRemainingToSpawn: number;
  nextWaveAt: number;
  lastSpawnAt: number;
  zombieSeq: number;
}

const PORT = 3000;
const clients = new Map<string, ConnectedClient>();
const rooms = new Map<string, ServerRoom>();

const ZOMBIE_SPAWN_POINTS: [number, number][] = [
  [-48, 0],
  [48, 0],
  [0, -48],
  [0, 48],
  [-56, -56],
  [56, -56],
  [-56, 56],
  [56, 56],
  [-90, 0],
  [90, 0],
  [0, -90],
  [0, 90],
];

function randomId(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(room: ServerRoom, payload: unknown, excludeId?: string) {
  const raw = JSON.stringify(payload);
  for (const [pid] of room.players) {
    if (excludeId && pid === excludeId) continue;
    const c = clients.get(pid);
    if (c && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(raw);
    }
  }
}

function getRoomSummaries(): RoomSummary[] {
  const list: RoomSummary[] = [];
  for (const r of rooms.values()) {
    list.push({
      code: r.code,
      name: r.name,
      subMode: r.subMode,
      playerCount: r.players.size,
      maxPlayers: 8,
      wave: r.wave,
    });
  }
  return list;
}

function broadcastRoomList() {
  const payload = JSON.stringify({ type: 'room_list', rooms: getRoomSummaries() });
  for (const c of clients.values()) {
    if (!c.roomCode && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(payload);
    }
  }
}

function createServerRoom(name: string, subMode: MultiplayerSubMode): ServerRoom {
  let code = randomId(4);
  while (rooms.has(code)) code = randomId(4);
  const room: ServerRoom = {
    code,
    name: (name || `Sala ${code}`).slice(0, 28),
    subMode,
    players: new Map(),
    zombies: new Map(),
    wave: 1,
    zombiesRemainingToSpawn: subMode === 'coop' ? 6 : 0,
    nextWaveAt: 0,
    lastSpawnAt: Date.now(),
    zombieSeq: 1,
  };
  rooms.set(code, room);
  return room;
}

function spawnZombieInRoom(room: ServerRoom) {
  const sp = ZOMBIE_SPAWN_POINTS[Math.floor(Math.random() * ZOMBIE_SPAWN_POINTS.length)];
  const r = Math.random();
  let type: ZombieType = 'walker';
  if (r > 0.45 && r <= 0.62) type = 'runner';
  else if (r > 0.62 && r <= 0.72) type = 'crawler';
  else if (room.wave >= 2 && r > 0.72 && r <= 0.81) type = 'hazmat';
  else if (room.wave >= 2 && r > 0.81 && r <= 0.88) type = 'spitter';
  else if (room.wave >= 3 && r > 0.88 && r <= 0.93) type = 'riot';
  else if (room.wave >= 3 && r > 0.93 && r <= 0.97) type = 'bloater';
  else if (room.wave >= 4 && r > 0.97) type = 'brute';

  const waveMult = 1 + (room.wave - 1) * 0.16;
  const baseHp =
    type === 'brute'
      ? 340
      : type === 'riot'
      ? 260
      : type === 'hazmat'
      ? 210
      : type === 'bloater'
      ? 160
      : type === 'spitter'
      ? 105
      : type === 'crawler'
      ? 75
      : type === 'runner'
      ? 85
      : 120;
  const speed =
    type === 'runner'
      ? 5.6
      : type === 'crawler'
      ? 3.7
      : type === 'brute'
      ? 2.4
      : type === 'bloater'
      ? 2.7
      : type === 'riot'
      ? 2.9
      : type === 'hazmat'
      ? 3.1
      : type === 'spitter'
      ? 3.3
      : 3.2;

  const id = `z_${room.zombieSeq++}`;
  const hp = Math.round(baseHp * waveMult);
  const spawnPos = {
    x: sp[0] + (Math.random() - 0.5) * 4,
    z: sp[1] + (Math.random() - 0.5) * 4,
  };
  resolveCircleAABBCollisions(spawnPos, 0.52, SURVIVAL_ARENA_COLLIDERS, CITY_ARENA_HALF - 2);

  room.zombies.set(id, {
    id,
    type,
    x: spawnPos.x,
    y: 0,
    z: spawnPos.z,
    yaw: 0,
    hp,
    maxHp: hp,
    speed: speed + Math.min(room.wave * 0.08, 1.2),
    isCrawling: type === 'crawler',
  });
}

function leaveCurrentRoom(client: ConnectedClient) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;
  const leaving = room.players.get(client.id);
  room.players.delete(client.id);
  if (leaving) {
    broadcastToRoom(room, {
      type: 'chat',
      message: {
        id: randomId(6),
        sender: 'Sistema',
        text: `${leaving.name} salió de la sala.`,
        timestamp: Date.now(),
        system: true,
      },
    });
  }
  if (room.players.size === 0) {
    rooms.delete(room.code);
  }
  broadcastRoomList();
}

function startGameLoop() {
  const TICK_MS = 50;
  setInterval(() => {
    const now = Date.now();
    const dt = TICK_MS / 1000;

    for (const room of rooms.values()) {
      if (room.players.size === 0) continue;

      // Handle dead player respawns
      for (const p of room.players.values()) {
        if (p.hp <= 0 && p.respawnAt > 0 && now >= p.respawnAt) {
          p.hp = p.maxHp;
          p.respawnAt = 0;
          p.x = (Math.random() - 0.5) * 10;
          p.z = (Math.random() - 0.5) * 10;
          const client = clients.get(p.id);
          if (client) {
            sendJson(client.ws, { type: 'respawn', x: p.x, z: p.z, hp: p.hp });
          }
        }
      }

      if (room.subMode === 'coop') {
        // Wave progression & zombie spawning
        if (room.nextWaveAt > 0) {
          if (now >= room.nextWaveAt) {
            room.wave += 1;
            room.nextWaveAt = 0;
            room.zombiesRemainingToSpawn = 5 + room.wave * 3;
            broadcastToRoom(room, { type: 'wave_start', wave: room.wave });
          }
        } else {
          if (room.zombiesRemainingToSpawn > 0 && room.zombies.size < 18 && now - room.lastSpawnAt > 900) {
            spawnZombieInRoom(room);
            room.zombiesRemainingToSpawn -= 1;
            room.lastSpawnAt = now;
          } else if (room.zombiesRemainingToSpawn === 0 && room.zombies.size === 0) {
            room.nextWaveAt = now + 4000;
            broadcastToRoom(room, { type: 'wave_cleared', wave: room.wave });
          }
        }

        // Move zombies toward nearest alive player
        const alivePlayers = Array.from(room.players.values()).filter((p) => p.hp > 0);
        if (alivePlayers.length > 0) {
          for (const z of room.zombies.values()) {
            let nearest = alivePlayers[0];
            let bestDistSq = Infinity;
            for (const p of alivePlayers) {
              const dx = p.x - z.x;
              const dz = p.z - z.z;
              const dSq = dx * dx + dz * dz;
              if (dSq < bestDistSq) {
                bestDistSq = dSq;
                nearest = p;
              }
            }
            const dist = Math.sqrt(bestDistSq) || 0.001;
            const dx = nearest.x - z.x;
            const dz = nearest.z - z.z;
            const effectiveSpeed = z.isCrawling ? z.speed * 0.34 : z.speed;

            if (dist > 1.35) {
              const steer = steerAroundWalls(z.x, z.z, nearest.x, nearest.z, SURVIVAL_ARENA_COLLIDERS, 1.4, CITY_ARENA_HALF - 2);
              z.yaw = Math.atan2(-steer.dirX, -steer.dirZ);
              const zPos = { x: z.x + steer.dirX * effectiveSpeed * dt, z: z.z + steer.dirZ * effectiveSpeed * dt };
              resolveCircleAABBCollisions(zPos, 0.5, SURVIVAL_ARENA_COLLIDERS, CITY_ARENA_HALF - 2);
              z.x = zPos.x;
              z.z = zPos.z;
            } else if (now - nearest.lastBiteAt > 950 && hasLineOfSightXZ(z.x, z.z, nearest.x, nearest.z, SURVIVAL_ARENA_COLLIDERS, 1.2)) {
              z.yaw = Math.atan2(-dx, -dz);
              nearest.lastBiteAt = now;
              const biteDmg = z.type === 'brute' ? 24 : z.type === 'spitter' ? 16 : 12;
              nearest.hp = Math.max(0, nearest.hp - biteDmg);
              const client = clients.get(nearest.id);
              if (client) {
                sendJson(client.ws, { type: 'player_damaged', hp: nearest.hp, damage: biteDmg });
              }
              if (nearest.hp <= 0) {
                nearest.deaths += 1;
                nearest.respawnAt = now + 4500;
                broadcastToRoom(room, {
                  type: 'chat',
                  message: {
                    id: randomId(6),
                    sender: 'Sistema',
                    text: `${nearest.name} cayó abatido. Reaparece en 4.5s.`,
                    timestamp: now,
                    system: true,
                  },
                });
              }
            }
          }
        }
      }

      // Broadcast synchronized room state snapshot
      broadcastToRoom(room, {
        type: 'state',
        wave: room.wave,
        players: Array.from(room.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          platform: p.platform,
          character: p.character,
          weaponId: p.weaponId,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          pitch: p.pitch,
          hp: p.hp,
          maxHp: p.maxHp,
          kills: p.kills,
          deaths: p.deaths,
          isMoving: p.isMoving,
        })),
        zombies: Array.from(room.zombies.values()),
      });
    }
  }, TICK_MS);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, players: clients.size });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: getRoomSummaries() });
  });

  app.get('/api/download-singlefile', async (_req, res) => {
    try {
      const filePath = path.resolve(__dirname, 'dist-singlefile', 'Deadzone-Arsenal-3D.html');
      if (!fs.existsSync(filePath)) {
        await viteBuild({ configFile: path.resolve(__dirname, 'vite.singlefile.config.ts') });
      }
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'No se pudo generar el archivo único.' });
        return;
      }
      res.download(filePath, 'Deadzone-Arsenal-3D.html');
    } catch (err) {
      console.error('Error serving single-file HTML:', err);
      res.status(500).json({ error: 'Error al generar el archivo único HTML.' });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const id = randomId(10);
    const client: ConnectedClient = { id, ws, roomCode: null };
    clients.set(id, client);

    sendJson(ws, { type: 'welcome', playerId: id, rooms: getRoomSummaries() });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'list_rooms') {
        sendJson(ws, { type: 'room_list', rooms: getRoomSummaries() });
        return;
      }

      if (type === 'create_room' || type === 'join_room') {
        leaveCurrentRoom(client);
        let room: ServerRoom | undefined;
        if (type === 'create_room') {
          const subMode: MultiplayerSubMode = msg.subMode === 'pvp' ? 'pvp' : 'coop';
          room = createServerRoom(String(msg.roomName || 'Zona Cero'), subMode);
        } else {
          const code = String(msg.code || '').toUpperCase().trim();
          room = rooms.get(code);
          if (!room) {
            sendJson(ws, { type: 'error', message: `No se encontró la sala ${code}.` });
            return;
          }
          if (room.players.size >= 8) {
            sendJson(ws, { type: 'error', message: 'La sala está llena (máx. 8 jugadores).' });
            return;
          }
        }

        const pInfo = (msg.player || {}) as {
          name?: string;
          platform?: PlatformType;
          character?: CharacterConfig;
          weaponId?: WeaponId;
          maxHp?: number;
        };
        const maxHp = typeof pInfo.maxHp === 'number' ? Math.max(80, Math.min(200, pInfo.maxHp)) : 100;
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnDist = 4 + Math.random() * 5;

        const serverPlayer: ServerPlayer = {
          id,
          name: (pInfo.name || `Operador-${id.slice(0, 3)}`).slice(0, 20),
          platform: pInfo.platform || 'desktop',
          character: pInfo.character as CharacterConfig,
          weaponId: (pInfo.weaponId || 'm4_centinela') as WeaponId,
          x: Math.cos(spawnAngle) * spawnDist,
          y: 0,
          z: Math.sin(spawnAngle) * spawnDist,
          yaw: 0,
          pitch: 0,
          hp: maxHp,
          maxHp,
          kills: 0,
          deaths: 0,
          isMoving: false,
          lastBiteAt: 0,
          respawnAt: 0,
        };

        room.players.set(id, serverPlayer);
        client.roomCode = room.code;

        sendJson(ws, {
          type: 'joined_room',
          room: {
            code: room.code,
            name: room.name,
            subMode: room.subMode,
            wave: room.wave,
          },
          spawn: { x: serverPlayer.x, z: serverPlayer.z, hp: serverPlayer.hp, maxHp: serverPlayer.maxHp },
        });

        broadcastToRoom(room, {
          type: 'chat',
          message: {
            id: randomId(6),
            sender: 'Sistema',
            text: `${serverPlayer.name} se unió desde ${serverPlayer.platform === 'mobile' ? 'Móvil' : serverPlayer.platform === 'tablet' ? 'Tablet' : 'PC'}.`,
            timestamp: Date.now(),
            system: true,
          },
        });

        broadcastRoomList();
        return;
      }

      if (type === 'leave_room') {
        leaveCurrentRoom(client);
        return;
      }

      const room = client.roomCode ? rooms.get(client.roomCode) : undefined;
      if (!room) return;
      const me = room.players.get(id);
      if (!me) return;

      if (type === 'player_update') {
        if (typeof msg.x === 'number') me.x = msg.x;
        if (typeof msg.y === 'number') me.y = msg.y;
        if (typeof msg.z === 'number') me.z = msg.z;
        if (typeof msg.yaw === 'number') me.yaw = msg.yaw;
        if (typeof msg.pitch === 'number') me.pitch = msg.pitch;
        if (typeof msg.isMoving === 'boolean') me.isMoving = msg.isMoving;
        if (msg.weaponId) me.weaponId = String(msg.weaponId) as WeaponId;
        if (msg.character) me.character = msg.character as CharacterConfig;
        return;
      }

      if (type === 'player_shoot') {
        broadcastToRoom(
          room,
          {
            type: 'remote_shot',
            playerId: id,
            origin: msg.origin,
            target: msg.target,
            color: msg.color,
            weaponId: msg.weaponId,
          },
          id
        );
        return;
      }

      if (type === 'hit_zombie') {
        const zId = String(msg.zombieId || '');
        const z = room.zombies.get(zId);
        if (!z) return;
        const isHeadshot = Boolean(msg.headshot);
        const isLegShotgun = Boolean(msg.legShotgun);
        const dmg = isHeadshot ? z.hp + 10 : Math.max(1, Math.min(800, Number(msg.damage) || 20));
        z.hp -= dmg;
        if (isLegShotgun && z.hp > 0) {
          z.isCrawling = true;
        }
        if (z.hp <= 0) {
          room.zombies.delete(zId);
          me.kills += 1;
          broadcastToRoom(room, {
            type: 'zombie_killed',
            zombieId: zId,
            killerId: id,
            killerName: me.name,
            headshot: isHeadshot,
          });
        }
        return;
      }

      if (type === 'hit_player' && room.subMode === 'pvp') {
        const targetId = String(msg.targetId || '');
        const target = room.players.get(targetId);
        if (!target || target.hp <= 0 || targetId === id) return;
        const dmg = Math.max(1, Math.min(400, Number(msg.damage) || 20));
        target.hp = Math.max(0, target.hp - dmg);
        const targetClient = clients.get(targetId);
        if (targetClient) {
          sendJson(targetClient.ws, { type: 'player_damaged', hp: target.hp, damage: dmg, attacker: me.name });
        }
        if (target.hp <= 0) {
          me.kills += 1;
          target.deaths += 1;
          target.respawnAt = Date.now() + 3500;
          broadcastToRoom(room, {
            type: 'chat',
            message: {
              id: randomId(6),
              sender: 'Combate',
              text: `${me.name} eliminó a ${target.name}`,
              timestamp: Date.now(),
              system: true,
            },
          });
        }
        return;
      }

      if (type === 'chat') {
        const text = String(msg.text || '').trim().slice(0, 140);
        if (!text) return;
        broadcastToRoom(room, {
          type: 'chat',
          message: {
            id: randomId(6),
            sender: me.name,
            text,
            timestamp: Date.now(),
          },
        });
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(client);
      clients.delete(id);
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  startGameLoop();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Deadzone Arsenal 3D server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
