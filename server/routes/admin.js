import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { getBetaStatus } from '../betaConfig.js';
import { sendDatabaseWipeCode } from '../email.js';

const router = Router();

const supportActivateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  validate: { xForwardedForHeader: false },
});

async function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { rows } = await pool.query(
    `SELECT role FROM users WHERE id = $1`, [req.session.userId]
  );
  if (rows.length === 0 || rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.session.userId = user.id;
    req.session.isAdmin = true;
    res.json({ id: user.id, email: user.email, full_name: user.full_name, role: user.role });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, created_at FROM users WHERE id = $1`,
      [req.session.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Admin me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });
    res.json({ success: true });
  });
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [users, people, households, activeTokens, recentUsers, subscriptions] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM users`),
      pool.query(`SELECT COUNT(*) as count FROM people`),
      pool.query(`SELECT COUNT(*) as count FROM households`),
      pool.query(`SELECT COUNT(*) as count FROM support_access_tokens WHERE status IN ('pending', 'active') AND expires_at > NOW()`),
      pool.query(`SELECT id, email, full_name, created_at FROM users ORDER BY created_at DESC LIMIT 10`),
      pool.query(`SELECT subscription_tier, COUNT(*) as count FROM users GROUP BY subscription_tier`),
    ]);

    const tableStats = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM relationships`),
      pool.query(`SELECT COUNT(*) as count FROM trips`),
      pool.query(`SELECT COUNT(*) as count FROM moments`),
      pool.query(`SELECT COUNT(*) as count FROM love_notes`),
      pool.query(`SELECT COUNT(*) as count FROM family_stories`),
      pool.query(`SELECT COUNT(*) as count FROM conversations`),
      pool.query(`SELECT COUNT(*) as count FROM messages`),
      pool.query(`SELECT COUNT(*) as count FROM calendar_events`),
      pool.query(`SELECT COUNT(*) as count FROM rituals`),
    ]);

    res.json({
      total_users: parseInt(users.rows[0].count),
      total_people: parseInt(people.rows[0].count),
      total_households: parseInt(households.rows[0].count),
      active_support_tokens: parseInt(activeTokens.rows[0].count),
      recent_users: recentUsers.rows,
      subscriptions: subscriptions.rows,
      content_stats: {
        relationships: parseInt(tableStats[0].rows[0].count),
        trips: parseInt(tableStats[1].rows[0].count),
        moments: parseInt(tableStats[2].rows[0].count),
        love_notes: parseInt(tableStats[3].rows[0].count),
        stories: parseInt(tableStats[4].rows[0].count),
        conversations: parseInt(tableStats[5].rows[0].count),
        messages: parseInt(tableStats[6].rows[0].count),
        calendar_events: parseInt(tableStats[7].rows[0].count),
        traditions: parseInt(tableStats[8].rows[0].count),
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT u.id, u.email, u.full_name, u.role, u.subscription_tier, u.created_at,
             p.id as person_id, p.name as person_name, p.role_type, p.photo_url,
             p.household_id, h.name as household_name
      FROM users u
      LEFT JOIN people p ON p.user_id = u.id
      LEFT JOIN households h ON h.id = p.household_id
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE u.email ILIKE $1 OR u.full_name ILIKE $1 OR p.name ILIKE $1`;
    }
    query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await pool.query(query, params);

    const countQuery = search
      ? `SELECT COUNT(*) FROM users u LEFT JOIN people p ON p.user_id = u.id WHERE u.email ILIKE $1 OR u.full_name ILIKE $1 OR p.name ILIKE $1`
      : `SELECT COUNT(*) FROM users`;
    const countParams = search ? [`%${search}%`] : [];
    const { rows: countRows } = await pool.query(countQuery, countParams);

    res.json({ users: rows, total: parseInt(countRows[0].count) });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: userRows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.subscription_tier, u.created_at,
              p.id as person_id, p.name, p.nickname, p.photo_url, p.birth_date, p.role_type,
              p.household_id, p.about, p.address, p.city, p.state, p.privacy_level,
              p.is_deceased, p.is_memorial, p.guardian_ids, p.parental_controls,
              p.onboarding_complete
       FROM users u
       LEFT JOIN people p ON p.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRows[0];

    const { rows: relationships } = await pool.query(
      `SELECT r.*, p.name as related_name
       FROM relationships r
       LEFT JOIN people p ON p.id = r.related_person_id
       WHERE r.person_id = $1`,
      [user.person_id]
    );

    const { rows: household } = user.household_id
      ? await pool.query(`SELECT * FROM households WHERE id = $1`, [user.household_id])
      : { rows: [] };

    res.json({ ...user, relationships, household: household[0] || null });
  } catch (err) {
    console.error('Admin user detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ['role', 'subscription_tier', 'full_name'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const columns = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE users SET ${setClause} WHERE id = $${values.length} RETURNING id, email, full_name, role, subscription_tier`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }
    const { rows: personRows } = await pool.query(
      `SELECT id FROM people WHERE user_id = $1`, [id]
    );
    const personId = personRows[0]?.id;

    if (personId) {
      await pool.query(`DELETE FROM relationships WHERE person_id = $1 OR related_person_id = $1`, [personId]);
      await pool.query(`DELETE FROM trip_participants WHERE person_id = $1`, [personId]);
      await pool.query(`DELETE FROM packing_items WHERE person_id = $1`, [personId]);
      await pool.query(`DELETE FROM trusted_contacts WHERE person_id = $1 OR trusted_person_id = $1`, [personId]);
      await pool.query(`DELETE FROM memorial_confirmations WHERE person_id = $1 OR confirmed_by_person_id = $1`, [personId]);
      await pool.query(`DELETE FROM love_notes WHERE from_person_id = $1 OR to_person_id = $1`, [personId]);
      await pool.query(`DELETE FROM moments WHERE author_person_id = $1`, [personId]);
      await pool.query(`DELETE FROM family_stories WHERE author_person_id = $1`, [personId]);
      await pool.query(`DELETE FROM people WHERE id = $1`, [personId]);
    }

    await pool.query(`DELETE FROM support_access_tokens WHERE user_id = $1`, [id]);
    await pool.query(`UPDATE support_access_tokens SET used_by_admin_id = NULL WHERE used_by_admin_id = $1`, [id]);
    await pool.query(`DELETE FROM relationship_visibility WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM person_match_suggestions WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM family_plan_members WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM family_plans WHERE owner_user_id = $1`, [id]);
    await pool.query(`UPDATE invite_links SET used_by_user_id = NULL WHERE used_by_user_id = $1`, [id]);
    await pool.query(`UPDATE merge_conflicts SET reported_by_user_id = NULL WHERE reported_by_user_id = $1`, [id]);
    await pool.query(`UPDATE merge_history SET merged_by_user_id = NULL WHERE merged_by_user_id = $1`, [id]);
    await pool.query(`UPDATE people SET created_by_user_id = NULL WHERE created_by_user_id = $1`, [id]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/households', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT h.*, COUNT(p.id) as member_count
      FROM households h
      LEFT JOIN people p ON p.household_id = h.id
      GROUP BY h.id
      ORDER BY h.name
    `);
    res.json(rows);
  } catch (err) {
    console.error('Admin households error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/support-tokens', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sat.*, u.email as user_email, u.full_name as user_name,
             admin.email as admin_email, admin.full_name as admin_name
      FROM support_access_tokens sat
      JOIN users u ON u.id = sat.user_id
      LEFT JOIN users admin ON admin.id = sat.used_by_admin_id
      WHERE sat.status IN ('pending', 'active') AND sat.expires_at > NOW()
      ORDER BY sat.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Admin support tokens error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/support-tokens/activate', supportActivateLimiter, requireAdmin, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Support code is required' });
  }
  try {
    await pool.query(`
      UPDATE support_access_tokens SET status = 'expired'
      WHERE status IN ('pending', 'active') AND expires_at <= NOW()
    `);

    const { rows } = await pool.query(`
      SELECT sat.*, u.id as uid, u.email, u.full_name, u.subscription_tier, u.created_at as user_created,
             p.id as person_id, p.name, p.photo_url, p.birth_date, p.role_type, p.about,
             p.address, p.city, p.state, p.household_id, p.privacy_level
      FROM support_access_tokens sat
      JOIN users u ON u.id = sat.user_id
      LEFT JOIN people p ON p.user_id = u.id
      WHERE sat.token = $1 AND sat.status = 'pending' AND sat.expires_at > NOW()
    `, [code.trim()]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired support code' });
    }
    const token = rows[0];

    await pool.query(`
      UPDATE support_access_tokens
      SET status = 'active', used_by_admin_id = $1
      WHERE id = $2
    `, [req.session.userId, token.id]);

    const { rows: relationships } = await pool.query(`
      SELECT r.*, p.name as related_name
      FROM relationships r
      LEFT JOIN people p ON p.id = r.related_person_id
      WHERE r.person_id = $1
    `, [token.person_id]);

    res.json({
      token_id: token.id,
      expires_at: token.expires_at,
      user: {
        id: token.uid,
        email: token.email,
        full_name: token.full_name,
        subscription_tier: token.subscription_tier,
        created_at: token.user_created,
      },
      person: token.person_id ? {
        id: token.person_id,
        name: token.name,
        photo_url: token.photo_url,
        birth_date: token.birth_date,
        role_type: token.role_type,
        about: token.about,
        address: token.address,
        city: token.city,
        state: token.state,
        household_id: token.household_id,
        privacy_level: token.privacy_level,
      } : null,
      relationships,
    });
  } catch (err) {
    console.error('Admin activate support token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/support-tokens/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`
      UPDATE support_access_tokens
      SET status = 'resolved', resolved_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'active')
      RETURNING *
    `, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Token not found or already resolved' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Admin resolve token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    const { rows } = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email`,
      [hash, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, email: rows[0].email });
  } catch (err) {
    console.error('Admin reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/beta-stats', requireAdmin, async (req, res) => {
  try {
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE beta_participant = true) as active_participants,
        COUNT(*) FILTER (WHERE beta_participant = true AND beta_discount_applied = true) as discounts_applied,
        MIN(beta_joined_at) FILTER (WHERE beta_participant = true) as earliest_join,
        MAX(beta_joined_at) FILTER (WHERE beta_participant = true) as latest_join
      FROM users
      WHERE role != 'admin'
    `);

    const { rows: participants } = await pool.query(`
      SELECT u.id, u.email, u.full_name, u.beta_joined_at, u.subscription_tier
      FROM users u
      WHERE u.beta_participant = true AND u.role != 'admin'
      ORDER BY u.beta_joined_at DESC
    `);

    const betaStatus = getBetaStatus();

    res.json({
      ...stats[0],
      beta: betaStatus,
      participants,
    });
  } catch (error) {
    console.error('Beta stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const wipeStore = new Map();

const wipeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Please try again later.' },
  validate: { xForwardedForHeader: false },
});

router.post('/database-wipe/request-code', requireAuth, requireAdmin, wipeLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
    const email = rows[0]?.email;
    if (!email || email.toLowerCase() !== 'support@starthread.app') {
      return res.status(403).json({ error: 'Only the primary admin can perform this action' });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    wipeStore.set(req.session.userId, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    const sent = await sendDatabaseWipeCode(email, code);
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send verification email. Check SMTP configuration.' });
    }

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Wipe code request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/database-wipe/execute', requireAuth, requireAdmin, wipeLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
    const email = rows[0]?.email;
    if (!email || email.toLowerCase() !== 'support@starthread.app') {
      return res.status(403).json({ error: 'Only the primary admin can perform this action' });
    }

    const stored = wipeStore.get(req.session.userId);
    if (!stored) {
      return res.status(400).json({ error: 'No verification code requested. Please start over.' });
    }

    if (Date.now() > stored.expiresAt) {
      wipeStore.delete(req.session.userId);
      return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }

    stored.attempts += 1;
    if (stored.attempts > 5) {
      wipeStore.delete(req.session.userId);
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' });
    }

    if (stored.code !== code.trim()) {
      return res.status(400).json({ error: `Invalid code. ${5 - stored.attempts} attempts remaining.` });
    }

    wipeStore.delete(req.session.userId);

    const adminId = req.session.userId;

    const tablesToClear = [
      'support_access_tokens',
      'memorial_confirmations',
      'merge_conflicts',
      'merge_history',
      'person_match_suggestions',
      'relationship_visibility',
      'packing_items',
      'shared_trip_items',
      'expenses',
      'meals',
      'trip_comments',
      'trip_participants',
      'activities',
      'trips',
      'messages',
      'conversations',
      'love_notes',
      'moments',
      'family_stories',
      'rituals',
      'calendar_events',
      'rooms',
      'invite_links',
      'join_requests',
      'trusted_contacts',
      'password_reset_tokens',
      'family_plan_members',
      'family_plans',
      'family_settings',
      'relationships',
      'people',
      'households',
      'session',
    ];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const table of tablesToClear) {
        await client.query(`DELETE FROM ${table}`);
      }

      await client.query('DELETE FROM users WHERE id != $1', [adminId]);

      await client.query('COMMIT');

      console.log(`[ADMIN] Database wipe executed by ${email} at ${new Date().toISOString()}`);
      res.json({ success: true, message: 'Database cleared successfully. Only admin account remains.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database wipe error:', error);
    res.status(500).json({ error: 'Database wipe failed. Please try again or contact support.' });
  }
});

export default router;
