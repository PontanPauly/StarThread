import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { pool } from './db/index.js';
import { runMigrations, tryCreateTrigram } from './db/migrate.js';
import { seedFamilyData } from './db/seed.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import uploadRoutes from './routes/upload.js';
import functionsRoutes from './routes/functions.js';
import relationshipsRoutes from './routes/relationships.js';
import memorialRoutes from './routes/memorial.js';
import calendarRoutes from './routes/calendar.js';
import googleAuthRoutes from './routes/googleAuth.js';
import subscriptionRoutes from './routes/subscription.js';
import adminRoutes from './routes/admin.js';
import identityRoutes from './routes/identity.js';
import { registerObjectStorageRoutes } from './replit_integrations/object_storage/routes.js';
import http from 'http';
import { setupWebSocket, broadcastToConversation } from './websocket.js';
import { periodicRescore } from './scoringTriggers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || (isProduction ? 5000 : 3001);

if (isProduction && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is required in production.');
  process.exit(1);
}

const allowedOrigins = isProduction
  ? [process.env.FRONTEND_URL, `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`].filter(Boolean)
  : true;

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool: pool,
  tableName: 'session',
  createTableIfMissing: true
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'fallback-secret-for-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

if (isProduction) {
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    const origin = req.get('Origin') || req.get('Referer');
    if (!origin) {
      return res.status(403).json({ error: 'Missing Origin header' });
    }
    const allowed = allowedOrigins.some(o => o && origin.startsWith(o));
    if (!allowed) {
      return res.status(403).json({ error: 'Invalid Origin' });
    }
    next();
  });
}

app.use('/uploads', requireAuth, express.static(path.join(__dirname, '..', 'uploads')));

registerObjectStorageRoutes(app, requireAuth);

app.use('/api/auth', authRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/functions', functionsRoutes);
app.use('/api/relationships', relationshipsRoutes);
app.use('/api/family', relationshipsRoutes);
app.use('/api/memorial', memorialRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/identity', identityRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/my-data/export', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { rows: userRows } = await pool.query(
      `SELECT id, email, full_name, created_at FROM users WHERE id = $1`, [userId]
    );

    const { rows: personRows } = await pool.query(
      `SELECT id FROM people WHERE user_id = $1`, [userId]
    );
    const personId = personRows[0]?.id || null;

    const result = { user: userRows[0], exported_at: new Date().toISOString() };

    if (personId) {
      const { rows: person } = await pool.query(`SELECT * FROM people WHERE id = $1`, [personId]);
      result.person = person[0] || null;

      const { rows: relationships } = await pool.query(
        `SELECT * FROM relationships WHERE person_id = $1 OR related_person_id = $1`, [personId]
      );
      result.relationships = relationships;

      const { rows: events } = await pool.query(
        `SELECT * FROM calendar_events WHERE created_by = $1`, [personId]
      );
      result.calendar_events = events;

      const { rows: moments } = await pool.query(
        `SELECT * FROM moments WHERE author_person_id = $1`, [personId]
      );
      result.moments = moments;

      const { rows: loveNotesSent } = await pool.query(
        `SELECT * FROM love_notes WHERE from_person_id = $1`, [personId]
      );
      const { rows: loveNotesReceived } = await pool.query(
        `SELECT * FROM love_notes WHERE to_person_id = $1`, [personId]
      );
      result.love_notes_sent = loveNotesSent;
      result.love_notes_received = loveNotesReceived;

      const { rows: stories } = await pool.query(
        `SELECT * FROM family_stories WHERE author_person_id = $1`, [personId]
      );
      result.family_stories = stories;

      const { rows: tripParticipations } = await pool.query(
        `SELECT tp.*, t.name as trip_name, t.location, t.start_date, t.end_date 
         FROM trip_participants tp 
         JOIN trips t ON t.id = tp.trip_id 
         WHERE tp.person_id = $1`, [personId]
      );
      result.trip_participations = tripParticipations;

      const { rows: packingItems } = await pool.query(
        `SELECT * FROM packing_items WHERE person_id = $1`, [personId]
      );
      result.packing_items = packingItems;
    }

    res.json(result);
  } catch (err) {
    console.error('Data export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await runMigrations();
  } catch (error) {
    console.error('Migration warning (non-fatal):', error.message);
  }

  tryCreateTrigram().catch(() => {});

  if (process.env.NODE_ENV !== 'production' && process.env.REPL_DEPLOYMENT !== '1') {
    try {
      await seedFamilyData();
    } catch (error) {
      console.error('Seed warning (non-fatal):', error.message);
    }
  }

  const server = http.createServer(app);
  setupWebSocket(server, sessionStore);
  app.set('broadcastToConversation', broadcastToConversation);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    if (fs.existsSync(distPath)) {
      console.log('Serving static files from dist/');
    }
  });

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    periodicRescore().catch(err => console.error('[PeriodicRescore] error:', err.message));
  }, SIX_HOURS);
}

start();
