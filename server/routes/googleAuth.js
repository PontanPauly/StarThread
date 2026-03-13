import express from 'express';
import crypto from 'crypto';
import { pool } from '../db/index.js';

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

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getCallbackUrl(req) {
  const forwardedHost = req.get('x-forwarded-host');
  const host = forwardedHost || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  if (host && !host.startsWith('0.0.0.0') && !host.startsWith('127.0.0.1') && !host.startsWith('localhost')) {
    const cleanHost = host.replace(/:\d+$/, '');
    return `https://${cleanHost}/api/auth/google/callback`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`;
  }
  return `https://localhost:3001/api/auth/google/callback`;
}

router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth is not configured' });
  }

  const callbackUrl = getCallbackUrl(req);
  const inviteCode = req.query.invite || '';
  const relationshipType = req.query.relationship_type || '';
  const nonce = crypto.randomBytes(16).toString('hex');

  req.session.oauthNonce = nonce;

  const state = Buffer.from(JSON.stringify({ invite: inviteCode, nonce, relationship_type: relationshipType })).toString('base64url');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/login?error=google_denied');
  }

  let inviteCode = '';
  let stateNonce = '';
  let stateRelationshipType = '';
  try {
    const stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString());
    inviteCode = stateData.invite || '';
    stateNonce = stateData.nonce || '';
    stateRelationshipType = stateData.relationship_type || '';
  } catch {}

  const expectedNonce = req.session.oauthNonce;
  delete req.session.oauthNonce;

  if (!stateNonce || !expectedNonce || stateNonce !== expectedNonce) {
    return res.redirect('/login?error=google_failed');
  }

  try {
    const callbackUrl = getCallbackUrl(req);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text());
      return res.redirect('/login?error=google_token_failed');
    }

    const tokenData = await tokenRes.json();

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userInfoRes.ok) {
      return res.redirect('/login?error=google_profile_failed');
    }

    const profile = await userInfoRes.json();
    const { id: googleId, email, name, picture } = profile;

    const RECIPROCAL_TYPES = {
      parent: 'child', child: 'parent', sibling: 'sibling', partner: 'partner',
      grandparent: 'grandchild', grandchild: 'grandparent', aunt_uncle: 'niece_nephew',
      niece_nephew: 'aunt_uncle', cousin: 'cousin', in_law: 'in_law',
      step_parent: 'step_child', step_child: 'step_parent', step_sibling: 'step_sibling',
      half_sibling: 'half_sibling', guardian: 'ward', ward: 'guardian',
      godparent: 'godchild', godchild: 'godparent',
      chosen_family: 'chosen_family', extended: 'extended'
    };

    let existingByGoogleId = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);

    if (existingByGoogleId.rows.length > 0) {
      const user = existingByGoogleId.rows[0];
      req.session.userId = user.id;
      return res.redirect('/');
    }

    let existingByEmail = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (existingByEmail.rows.length > 0) {
      const user = existingByEmail.rows[0];
      await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
      req.session.userId = user.id;
      return res.redirect('/');
    }

    if (inviteCode) {
      const preCheck = await pool.query(
        'SELECT relationship_type FROM invite_links WHERE code = $1 AND used_by_user_id IS NULL AND (expires_at IS NULL OR expires_at > NOW())',
        [inviteCode]
      );
      if (preCheck.rows.length > 0 && !preCheck.rows[0].relationship_type && !stateRelationshipType) {
        return res.redirect('/login?error=google_failed&reason=relationship_required');
      }
    }

    const formattedName = formatProperName(name || email.split('@')[0]);
    const result = await pool.query(
      'INSERT INTO users (email, full_name, google_id) VALUES ($1, $2, $3) RETURNING id, email, full_name, created_at',
      [email, formattedName, googleId]
    );
    const newUser = result.rows[0];

    const gNameParts = formattedName.trim().split(/\s+/);
    let gFirstName, gMiddleName, gLastName;
    if (gNameParts.length === 1) {
      gFirstName = gNameParts[0]; gMiddleName = null; gLastName = null;
    } else if (gNameParts.length === 2) {
      gFirstName = gNameParts[0]; gMiddleName = null; gLastName = gNameParts[1];
    } else {
      gFirstName = gNameParts[0]; gLastName = gNameParts[gNameParts.length - 1]; gMiddleName = gNameParts.slice(1, -1).join(' ');
    }
    const personResult = await pool.query(
      'INSERT INTO people (name, first_name, middle_name, last_name, user_id, linked_user_email, role_type, photo_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [formattedName, gFirstName, gMiddleName, gLastName, newUser.id, email, 'adult', picture || null]
    );
    let newPersonId = personResult.rows[0].id;

    if (inviteCode) {
      const inviteResult = await pool.query(
        'SELECT * FROM invite_links WHERE code = $1 AND used_by_user_id IS NULL AND (expires_at IS NULL OR expires_at > NOW())',
        [inviteCode]
      );
      if (inviteResult.rows.length > 0) {
        const invite = inviteResult.rows[0];
        const relType = invite.relationship_type || stateRelationshipType;
        const reciprocalType = RECIPROCAL_TYPES[relType] || relType;

        if (invite.for_person_id) {
          const existingPerson = await pool.query('SELECT id, user_id FROM people WHERE id = $1', [invite.for_person_id]);
          if (existingPerson.rows.length > 0 && !existingPerson.rows[0].user_id) {
            await pool.query('DELETE FROM people WHERE id = $1', [newPersonId]);
            await pool.query(
              'UPDATE people SET user_id = $1, linked_user_email = $2, first_name = COALESCE(first_name, $3), last_name = COALESCE(last_name, $4), photo_url = COALESCE(photo_url, $5) WHERE id = $6',
              [newUser.id, email, gFirstName, gLastName, picture || null, invite.for_person_id]
            );
            newPersonId = invite.for_person_id;
          }
        }

        const existingRel = await pool.query(
          'SELECT id FROM relationships WHERE person_id = $1 AND related_person_id = $2 AND relationship_type = $3',
          [invite.created_by_person_id, newPersonId, relType]
        );
        if (existingRel.rows.length === 0) {
          await pool.query(
            'INSERT INTO relationships (person_id, related_person_id, relationship_type, status_from_person, status_from_related) VALUES ($1, $2, $3, $4, $5)',
            [invite.created_by_person_id, newPersonId, relType, 'confirmed', 'confirmed']
          );
        }
        const existingRecip = await pool.query(
          'SELECT id FROM relationships WHERE person_id = $1 AND related_person_id = $2 AND relationship_type = $3',
          [newPersonId, invite.created_by_person_id, reciprocalType]
        );
        if (existingRecip.rows.length === 0) {
          await pool.query(
            'INSERT INTO relationships (person_id, related_person_id, relationship_type, status_from_person, status_from_related) VALUES ($1, $2, $3, $4, $5)',
            [newPersonId, invite.created_by_person_id, reciprocalType, 'confirmed', 'confirmed']
          );
        }

        await pool.query(
          'UPDATE invite_links SET used_by_user_id = $1, used_at = NOW() WHERE id = $2',
          [newUser.id, invite.id]
        );
      }
    }

    req.session.userId = newUser.id;
    return res.redirect('/');

  } catch (error) {
    console.error('Google OAuth error:', error);
    return res.redirect('/login?error=google_failed');
  }
});

router.get('/google/enabled', (req, res) => {
  res.json({ enabled: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) });
});

export default router;
