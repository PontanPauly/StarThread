import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { computeMatchScore, findCandidates } from '../identityScoring.js';
import { mergePeople } from '../mergeEngine.js';
import { scoreFamilySuggestions } from '../scoringTriggers.js';

const router = express.Router();

router.get('/suggestions', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const includeFamily = req.query.include_family === 'true';

    const { rows: ownSuggestions } = await pool.query(`
      SELECT s.*, p.name, p.first_name, p.last_name, p.photo_url, p.role_type,
             p.birth_year, p.city, p.state, NULL AS for_family_member_name, NULL AS for_family_member_id
      FROM person_match_suggestions s
      JOIN people p ON p.id = s.suggested_person_id
      WHERE s.user_id = $1
        AND s.status = 'pending'
        AND p.user_id IS NULL
        AND p.merged_into_id IS NULL
      ORDER BY s.score DESC
    `, [userId]);

    let familySuggestions = [];
    if (includeFamily) {
      familySuggestions = await scoreFamilySuggestions(userId);
    }

    res.json([...ownSuggestions, ...familySuggestions]);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/suggestions/:id/accept', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    await client.query('BEGIN');

    const { rows: suggestions } = await client.query(
      `SELECT * FROM person_match_suggestions WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
      [id, userId]
    );
    if (suggestions.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Suggestion not found or already resolved' });
    }

    const suggestion = suggestions[0];
    const personId = suggestion.suggested_person_id;

    const { rows: personRows } = await client.query(
      `SELECT * FROM people WHERE id = $1 FOR UPDATE`,
      [personId]
    );
    if (personRows.length === 0 || personRows[0].user_id !== null || personRows[0].merged_into_id !== null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Person is already claimed or merged' });
    }

    const { rows: userRows } = await client.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    const userEmail = userRows[0]?.email;

    const { rows: existingPerson } = await client.query(
      `SELECT id FROM people WHERE user_id = $1 FOR UPDATE`, [userId]
    );

    if (existingPerson.length > 0) {
      await client.query(
        `UPDATE people SET user_id = NULL, linked_user_email = NULL WHERE user_id = $1`,
        [userId]
      );
    }

    const { rowCount } = await client.query(
      `UPDATE people SET user_id = $1, linked_user_email = $2 WHERE id = $3 AND user_id IS NULL AND merged_into_id IS NULL`,
      [userId, userEmail, personId]
    );
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Person was claimed by another user' });
    }

    await client.query(
      `UPDATE person_match_suggestions SET status = 'accepted' WHERE id = $1`,
      [id]
    );

    await client.query(
      `UPDATE person_match_suggestions SET status = 'dismissed' 
       WHERE user_id = $1 AND id != $2 AND status = 'pending'`,
      [userId, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, personId, message: 'Star claimed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Accept suggestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/suggestions/:id/dismiss', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const { permanent } = req.body || {};

    const status = permanent ? 'dismissed_permanently' : 'dismissed';

    const result = await pool.query(
      `UPDATE person_match_suggestions SET status = $1 WHERE id = $2 AND user_id = $3 AND status = 'pending' RETURNING id`,
      [status, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Suggestion not found or already resolved' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Dismiss suggestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/merge', requireAuth, async (req, res) => {
  try {
    const { keepPersonId, mergePersonId } = req.body;
    if (!keepPersonId || !mergePersonId) {
      return res.status(400).json({ error: 'keepPersonId and mergePersonId are required' });
    }
    if (keepPersonId === mergePersonId) {
      return res.status(400).json({ error: 'Cannot merge a person with themselves' });
    }

    const result = await mergePeople(keepPersonId, mergePersonId, req.session.userId);
    res.json(result);
  } catch (error) {
    if (error.code === 'CONFLICT') {
      return res.status(409).json({ error: error.message, conflictId: error.conflictId });
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/merge-history', requireAuth, async (req, res) => {
  try {
    const personResult = await pool.query(
      `SELECT id FROM people WHERE user_id = $1`, [req.session.userId]
    );
    if (personResult.rows.length === 0) {
      return res.json([]);
    }
    const myPersonId = personResult.rows[0].id;

    const { rows } = await pool.query(`
      SELECT mh.*, kp.name AS keep_person_name
      FROM merge_history mh
      JOIN people kp ON kp.id = mh.keep_person_id
      WHERE mh.merged_by_user_id = $1
         OR mh.keep_person_id = $2
      ORDER BY mh.created_at DESC
      LIMIT 50
    `, [req.session.userId, myPersonId]);

    res.json(rows);
  } catch (error) {
    console.error('Merge history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
