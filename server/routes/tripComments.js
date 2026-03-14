import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

async function getMyPersonId(userId) {
  const { rows } = await pool.query('SELECT id FROM people WHERE user_id = $1 LIMIT 1', [userId]);
  return rows.length > 0 ? rows[0].id : null;
}

async function isTripParticipantOrPlanner(tripId, personId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM trip_participants WHERE trip_id = $1 AND person_id = $2
     UNION
     SELECT 1 FROM trips WHERE id = $1 AND $2 = ANY(planner_ids)`,
    [tripId, personId]
  );
  return rows.length > 0;
}

router.get('/:tripId/comments', requireAuth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.session.userId;
    const myPersonId = await getMyPersonId(userId);

    if (!myPersonId || !(await isTripParticipantOrPlanner(tripId, myPersonId))) {
      return res.status(403).json({ error: 'Not authorized to view comments for this trip' });
    }

    const { rows } = await pool.query(
      `SELECT id, trip_id, author_person_id, content, created_at as created_date
       FROM trip_comments
       WHERE trip_id = $1
       ORDER BY created_at ASC`,
      [tripId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching trip comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/:tripId/comments', requireAuth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { content } = req.body;
    const userId = req.session.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const myPersonId = await getMyPersonId(userId);

    if (!myPersonId || !(await isTripParticipantOrPlanner(tripId, myPersonId))) {
      return res.status(403).json({ error: 'Not authorized to comment on this trip' });
    }

    const { rows } = await pool.query(
      `INSERT INTO trip_comments (trip_id, author_person_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, trip_id, author_person_id, content, created_at as created_date`,
      [tripId, myPersonId, content.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating trip comment:', err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

router.delete('/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.session.userId;
    const myPersonId = await getMyPersonId(userId);

    if (!myPersonId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { rowCount } = await pool.query(
      `DELETE FROM trip_comments WHERE id = $1 AND author_person_id = $2`,
      [commentId, myPersonId]
    );

    if (rowCount === 0) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting trip comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
