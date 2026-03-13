import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../email.js';

const router = express.Router();

function formatProperName(name) {
  if (!name || typeof name !== 'string') return name;
  return name.trim().split(/\s+/).map(word => {
    if (/^[A-Z][a-z]+[A-Z]/.test(word)) return word;
    if (word.includes('-')) {
      return word.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-');
    }
    if (word.includes("'") || word.includes("\u2019")) {
      return word.split(/('+|\u2019+)/).map(part => {
        if (part === "'" || part === "\u2019" || !part) return part;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join('');
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 10 minutes.' },
  validate: { xForwardedForHeader: false }
});

const RECIPROCAL_TYPES = {
  parent: 'child',
  child: 'parent',
  sibling: 'sibling',
  partner: 'partner',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  aunt_uncle: 'niece_nephew',
  niece_nephew: 'aunt_uncle',
  cousin: 'cousin',
  in_law: 'in_law',
  step_parent: 'step_child',
  step_child: 'step_parent',
  step_sibling: 'step_sibling',
  half_sibling: 'half_sibling',
  guardian: 'ward',
  ward: 'guardian',
  godparent: 'godchild',
  godchild: 'godparent',
  chosen_family: 'chosen_family',
  extended: 'extended'
};

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, full_name, invite_code } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full_name are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const formattedName = formatProperName(full_name);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, created_at',
      [email, passwordHash, formattedName]
    );

    const user = result.rows[0];
    req.session.userId = user.id;

    const nameParts = formattedName.trim().split(/\s+/);
    let regFirstName, regMiddleName, regLastName;
    if (nameParts.length === 1) {
      regFirstName = nameParts[0]; regMiddleName = null; regLastName = null;
    } else if (nameParts.length === 2) {
      regFirstName = nameParts[0]; regMiddleName = null; regLastName = nameParts[1];
    } else {
      regFirstName = nameParts[0]; regLastName = nameParts[nameParts.length - 1]; regMiddleName = nameParts.slice(1, -1).join(' ');
    }
    const personResult = await pool.query(
      'INSERT INTO people (name, first_name, middle_name, last_name, user_id, linked_user_email, role_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [formattedName, regFirstName, regMiddleName, regLastName, user.id, email, 'adult']
    );
    const newPersonId = personResult.rows[0].id;

    if (invite_code) {
      const inviteResult = await pool.query(
        'SELECT * FROM invite_links WHERE code = $1 AND used_by_user_id IS NULL AND (expires_at IS NULL OR expires_at > NOW())',
        [invite_code]
      );
      if (inviteResult.rows.length > 0) {
        const invite = inviteResult.rows[0];
        const relType = invite.relationship_type || 'chosen_family';
        const reciprocalType = RECIPROCAL_TYPES[relType] || relType;

        await pool.query(
          'INSERT INTO relationships (person_id, related_person_id, relationship_type, status_from_person, status_from_related) VALUES ($1, $2, $3, $4, $5)',
          [invite.created_by_person_id, newPersonId, relType, 'confirmed', 'confirmed']
        );
        await pool.query(
          'INSERT INTO relationships (person_id, related_person_id, relationship_type, status_from_person, status_from_related) VALUES ($1, $2, $3, $4, $5)',
          [newPersonId, invite.created_by_person_id, reciprocalType, 'confirmed', 'confirmed']
        );

        await pool.query(
          'UPDATE invite_links SET used_by_user_id = $1, used_at = NOW() WHERE id = $2',
          [user.id, invite.id]
        );
      }
    }

    if (!invite_code) {
      try {
        const { findCandidates, computeMatchScore } = await import('../identityScoring.js');
        const signals = {
          name: formattedName,
          first_name: regFirstName,
          last_name: regLastName,
          email,
        };
        const candidates = await findCandidates(signals, {
          excludeIds: [newPersonId],
          unclaimedOnly: true,
          limit: 10,
        });
        for (const candidate of candidates) {
          const result = await computeMatchScore(candidate, signals);
          if (result.confidence === 'high') {
            await pool.query(
              `INSERT INTO person_match_suggestions (user_id, suggested_person_id, score, confidence, breakdown, explanations, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'pending')
               ON CONFLICT (user_id, suggested_person_id) DO NOTHING`,
              [user.id, candidate.id, result.score, result.confidence, JSON.stringify(result.breakdown), result.explanations]
            );
          }
        }
      } catch (sugErr) {
        console.error('Claim suggestion generation error (non-fatal):', sugErr.message);
      }
    }

    res.status(201).json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, full_name, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    // Must pass matching options that were used when setting the cookie,
    // otherwise many browsers will ignore the clear request.
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my-person', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM people WHERE user_id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get my-person error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Secure endpoint — only returns medical_notes for the authenticated user's own record.
// medical_notes is intentionally excluded from the public entities API.
router.get('/my-medical-notes', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, medical_notes FROM people WHERE user_id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get my-medical-notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been generated.' });
    }

    const user = result.rows[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    const host = req.get('host') || process.env.REPLIT_DEV_DOMAIN || 'localhost:3001';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const resetUrl = `${protocol}://${host}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(email, resetUrl);

    res.json({ message: 'If that email exists, a reset link has been generated.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = hashToken(token);

    await client.query('BEGIN');

    const result = await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1 AND used_at IS NULL AND expires_at > NOW() RETURNING user_id',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = result.rows[0].user_id;
    const passwordHash = await bcrypt.hash(new_password, 10);
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

    await client.query(
      `DELETE FROM session WHERE sess->>'userId' = $1`,
      [userId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/change-email', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { new_email, password } = req.body;

    if (!new_email || !password) {
      return res.status(400).json({ error: 'New email and current password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const userResult = await client.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Cannot verify password for Google-only accounts. Please set a password first.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const existingEmail = await client.query('SELECT id FROM users WHERE email = $1 AND id != $2', [new_email, user.id]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    await client.query('BEGIN');
    await client.query('UPDATE users SET email = $1 WHERE id = $2', [new_email, user.id]);
    await client.query('UPDATE people SET linked_user_email = $1 WHERE user_id = $2', [new_email, user.id]);
    await client.query('COMMIT');

    const updatedUser = await client.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [user.id]
    );

    res.json(updatedUser.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Change email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const result = await pool.query(
      'SELECT id, password_hash, google_id FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (user.password_hash) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const validPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(new_password, saltRounds);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newHash, user.id]
    );

    await pool.query(
      `DELETE FROM session WHERE sess->>'userId' = $1 AND sid != $2`,
      [user.id, req.sessionID]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/account', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.session.userId;

    const { rows: personRows } = await client.query(
      'SELECT id, role_type FROM people WHERE user_id = $1',
      [userId]
    );
    const person = personRows[0];

    if (person && (person.role_type === 'child' || person.role_type === 'teen')) {
      client.release();
      return res.status(403).json({ error: 'Minor accounts are managed by a parent. Please ask your parent to manage this account.' });
    }

    await client.query('BEGIN');

    if (person) {
      await client.query(
        'UPDATE people SET user_id = NULL, linked_user_email = NULL WHERE user_id = $1',
        [userId]
      );
    }

    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    req.session.destroy(() => {});

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/support-token', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { rows: personRows } = await pool.query(
      `SELECT id FROM people WHERE user_id = $1`, [userId]
    );

    await pool.query(`
      UPDATE support_access_tokens SET status = 'expired'
      WHERE user_id = $1 AND status = 'pending' AND expires_at <= NOW()
    `, [userId]);

    const { rows: existing } = await pool.query(`
      SELECT * FROM support_access_tokens
      WHERE user_id = $1 AND status IN ('pending', 'active') AND expires_at > NOW()
    `, [userId]);
    if (existing.length > 0) {
      return res.json(existing[0]);
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const { rows } = await pool.query(`
      INSERT INTO support_access_tokens (user_id, person_id, token, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [userId, personRows[0]?.id || null, token, expiresAt]);

    res.json(rows[0]);
  } catch (err) {
    console.error('Generate support token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/support-token', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM support_access_tokens
      WHERE user_id = $1 AND status IN ('pending', 'active') AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `, [req.session.userId]);
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Get support token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/support-token/revoke', requireAuth, async (req, res) => {
  try {
    await pool.query(`
      UPDATE support_access_tokens
      SET status = 'resolved', resolved_at = NOW()
      WHERE user_id = $1 AND status IN ('pending', 'active')
    `, [req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Revoke support token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
