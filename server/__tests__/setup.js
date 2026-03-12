import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import http from 'http';
import { pool } from '../db/index.js';
import authRoutes from '../routes/auth.js';
import entityRoutes from '../routes/entities.js';
import subscriptionRoutes from '../routes/subscription.js';
import adminRoutes from '../routes/admin.js';
import identityRoutes from '../routes/identity.js';
import relationshipRoutes from '../routes/relationships.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  }));

  app.post('/api/__test__/login', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    req.session.userId = userId;
    res.json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/entities', entityRoutes);
  app.use('/api/subscription', subscriptionRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/identity', identityRoutes);
  app.use('/api/relationships', relationshipRoutes);

  return app;
}

let _server = null;
let _app = null;
let _baseUrl = null;

export async function getTestServer() {
  if (_server) return { app: _app, server: _server, baseUrl: _baseUrl };
  _app = createApp();
  _server = http.createServer(_app);
  await new Promise((resolve) => {
    _server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = _server.address();
  _baseUrl = `http://127.0.0.1:${addr.port}`;
  return { app: _app, server: _server, baseUrl: _baseUrl };
}

export async function closeTestServer() {
  if (_server) {
    await new Promise((resolve) => _server.close(resolve));
    _server = null;
    _app = null;
    _baseUrl = null;
  }
}

export async function createTestUser(email, password, fullName, role) {
  const passwordHash = await bcrypt.hash(password, 4);
  const { rows: userRows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, passwordHash, fullName, role || 'user']
  );
  const userId = userRows[0].id;

  const nameParts = fullName.trim().split(/\s+/);
  let firstName, middleName, lastName;
  if (nameParts.length === 1) {
    firstName = nameParts[0]; middleName = null; lastName = null;
  } else if (nameParts.length === 2) {
    firstName = nameParts[0]; middleName = null; lastName = nameParts[1];
  } else {
    firstName = nameParts[0]; lastName = nameParts[nameParts.length - 1]; middleName = nameParts.slice(1, -1).join(' ');
  }

  const { rows: personRows } = await pool.query(
    `INSERT INTO people (name, first_name, middle_name, last_name, user_id, linked_user_email, role_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [fullName, firstName, middleName, lastName, userId, email, 'adult']
  );

  return { userId, personId: personRows[0].id, email };
}

export async function authenticatedAgent(baseUrl, userId) {
  const ag = supertest.agent(baseUrl);
  await ag.post('/api/__test__/login').send({ userId });
  return ag;
}

import supertest from 'supertest';

export async function cleanupTestData(prefix) {
  const tag = prefix || 'test_';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: users } = await client.query(
      `SELECT id FROM users WHERE email LIKE $1`, [`${tag}%`]
    );
    const userIds = users.map(u => u.id);

    if (userIds.length > 0) {
      const { rows: people } = await client.query(
        `SELECT id FROM people WHERE user_id = ANY($1)`, [userIds]
      );
      const personIds = people.map(p => p.id);

      if (personIds.length > 0) {
        try { await client.query(`DELETE FROM merge_history WHERE keep_person_id = ANY($1) OR merged_person_id = ANY($1)`, [personIds]); } catch {}
        try { await client.query(`DELETE FROM merge_conflicts WHERE person_a_id = ANY($1) OR person_b_id = ANY($1)`, [personIds]); } catch {}
        await client.query(`DELETE FROM relationships WHERE person_id = ANY($1) OR related_person_id = ANY($1)`, [personIds]);
        await client.query(`DELETE FROM love_notes WHERE from_person_id = ANY($1) OR to_person_id = ANY($1)`, [personIds]);
        await client.query(`DELETE FROM moments WHERE author_person_id = ANY($1)`, [personIds]);
        await client.query(`DELETE FROM family_stories WHERE author_person_id = ANY($1)`, [personIds]);
        await client.query(`DELETE FROM trusted_contacts WHERE person_id = ANY($1) OR trusted_person_id = ANY($1)`, [personIds]);
        await client.query(`DELETE FROM trip_participants WHERE person_id = ANY($1)`, [personIds]);
        await client.query(`DELETE FROM packing_items WHERE person_id = ANY($1)`, [personIds]);
        await client.query(`DELETE FROM invite_links WHERE created_by_person_id = ANY($1)`, [personIds]);
        try { await client.query(`UPDATE people SET merged_into_id = NULL WHERE merged_into_id = ANY($1)`, [personIds]); } catch {}
        await client.query(`DELETE FROM people WHERE id = ANY($1)`, [personIds]);
      }

      try { await client.query(`DELETE FROM person_match_suggestions WHERE user_id = ANY($1)`, [userIds]); } catch {}
      await client.query(`DELETE FROM support_access_tokens WHERE user_id = ANY($1)`, [userIds]);
      await client.query(`DELETE FROM password_reset_tokens WHERE user_id = ANY($1)`, [userIds]);
      await client.query(`DELETE FROM family_plan_members WHERE user_id = ANY($1)`, [userIds]);
      await client.query(`DELETE FROM family_plans WHERE owner_user_id = ANY($1)`, [userIds]);
      await client.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cleanup error:', err.message);
  } finally {
    client.release();
  }
}

export { pool };
