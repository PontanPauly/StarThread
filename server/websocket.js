import { WebSocketServer } from 'ws';
import { pool } from './db/index.js';
import cookie from 'cookie';

const clients = new Map();

export function setupWebSocket(server, sessionStore) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const sid = cookies['connect.sid'];
      if (!sid) {
        ws.close(4001, 'No session');
        return;
      }

      const rawSid = sid.startsWith('s:') ? sid.slice(2).split('.')[0] : sid;

      const personId = await new Promise((resolve, reject) => {
        sessionStore.get(rawSid, async (err, session) => {
          if (err || !session || !session.userId) {
            return resolve(null);
          }
          try {
            const { rows } = await pool.query(
              'SELECT id FROM people WHERE user_id = $1 LIMIT 1',
              [session.userId]
            );
            resolve(rows[0]?.id || null);
          } catch (e) {
            resolve(null);
          }
        });
      });

      if (!personId) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      ws.personId = personId;
      ws.isAlive = true;

      if (!clients.has(personId)) {
        clients.set(personId, new Set());
      }
      clients.get(personId).add(ws);

      ws.on('pong', () => { ws.isAlive = true; });

      ws.on('close', () => {
        const set = clients.get(personId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) clients.delete(personId);
        }
      });

    } catch (err) {
      console.error('WebSocket connection error:', err);
      ws.close(4000, 'Server error');
    }
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}

export function broadcastToConversation(participantIds, event, data) {
  const payload = JSON.stringify({ event, data });
  for (const pid of participantIds) {
    const sockets = clients.get(pid);
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === 1) {
          ws.send(payload);
        }
      }
    }
  }
}
