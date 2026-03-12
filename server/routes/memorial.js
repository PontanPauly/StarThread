import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

async function getMyPersonId(userId) {
  const result = await pool.query('SELECT id FROM people WHERE user_id = $1', [userId]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

async function isTrustedContact(personId, targetPersonId) {
  const result = await pool.query(
    'SELECT id FROM trusted_contacts WHERE person_id = $1 AND trusted_person_id = $2',
    [targetPersonId, personId]
  );
  return result.rows.length > 0;
}

router.post('/initiate/:personId', requireAuth, async (req, res) => {
  try {
    const { personId } = req.params;
    const myPersonId = await getMyPersonId(req.session.userId);
    if (!myPersonId) {
      return res.status(403).json({ error: 'No person record linked to your account' });
    }

    const trusted = await isTrustedContact(myPersonId, personId);
    if (!trusted) {
      return res.status(403).json({ error: 'Only trusted contacts can initiate memorial' });
    }

    const person = await pool.query('SELECT is_memorial FROM people WHERE id = $1', [personId]);
    if (person.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    if (person.rows[0].is_memorial) {
      return res.status(400).json({ error: 'Person is already in memorial state' });
    }

    const existing = await pool.query(
      'SELECT id FROM memorial_confirmations WHERE person_id = $1 AND confirmed_by_person_id = $2',
      [personId, myPersonId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already confirmed this memorial' });
    }

    await pool.query(
      'INSERT INTO memorial_confirmations (person_id, confirmed_by_person_id) VALUES ($1, $2)',
      [personId, myPersonId]
    );

    const count = await pool.query(
      'SELECT COUNT(*) as cnt FROM memorial_confirmations WHERE person_id = $1',
      [personId]
    );
    const confirmCount = parseInt(count.rows[0].cnt);

    const totalTrusted = await pool.query(
      'SELECT COUNT(*) as cnt FROM trusted_contacts WHERE person_id = $1',
      [personId]
    );
    const totalTrustedCount = parseInt(totalTrusted.rows[0].cnt);
    const threshold = Math.min(2, totalTrustedCount);

    if (confirmCount >= threshold) {
      await pool.query(
        'UPDATE people SET is_deceased = true, is_memorial = true, memorial_date = NOW() WHERE id = $1',
        [personId]
      );
      res.json({ message: 'Memorial threshold reached. Person has been transitioned to memorial state.', confirmed: true });
    } else {
      res.json({
        message: `Memorial initiated. ${confirmCount}/${threshold} confirmations received.`,
        confirmed: false,
        current: confirmCount,
        needed: threshold
      });
    }
  } catch (error) {
    console.error('Memorial initiate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/confirm/:personId', requireAuth, async (req, res) => {
  try {
    const { personId } = req.params;
    const myPersonId = await getMyPersonId(req.session.userId);
    if (!myPersonId) {
      return res.status(403).json({ error: 'No person record linked to your account' });
    }

    const trusted = await isTrustedContact(myPersonId, personId);
    if (!trusted) {
      return res.status(403).json({ error: 'Only trusted contacts can confirm memorial' });
    }

    const existing = await pool.query(
      'SELECT id FROM memorial_confirmations WHERE person_id = $1 AND confirmed_by_person_id = $2',
      [personId, myPersonId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already confirmed this memorial' });
    }

    await pool.query(
      'INSERT INTO memorial_confirmations (person_id, confirmed_by_person_id) VALUES ($1, $2)',
      [personId, myPersonId]
    );

    const count = await pool.query(
      'SELECT COUNT(*) as cnt FROM memorial_confirmations WHERE person_id = $1',
      [personId]
    );
    const confirmCount = parseInt(count.rows[0].cnt);

    const totalTrusted = await pool.query(
      'SELECT COUNT(*) as cnt FROM trusted_contacts WHERE person_id = $1',
      [personId]
    );
    const totalTrustedCount = parseInt(totalTrusted.rows[0].cnt);
    const threshold = Math.min(2, totalTrustedCount);

    if (confirmCount >= threshold) {
      await pool.query(
        'UPDATE people SET is_deceased = true, is_memorial = true, memorial_date = NOW() WHERE id = $1',
        [personId]
      );
      res.json({ message: 'Memorial confirmed. Person has been transitioned to memorial state.', confirmed: true });
    } else {
      res.json({
        message: `Confirmation recorded. ${confirmCount}/${threshold} confirmations received.`,
        confirmed: false,
        current: confirmCount,
        needed: threshold
      });
    }
  } catch (error) {
    console.error('Memorial confirm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status/:personId', requireAuth, async (req, res) => {
  try {
    const { personId } = req.params;
    const myPersonId = await getMyPersonId(req.session.userId);

    const person = await pool.query('SELECT is_memorial, memorial_date FROM people WHERE id = $1', [personId]);
    if (person.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const confirmations = await pool.query(
      'SELECT mc.*, p.name AS confirmer_name FROM memorial_confirmations mc JOIN people p ON p.id = mc.confirmed_by_person_id WHERE mc.person_id = $1',
      [personId]
    );

    const isTrusted = myPersonId ? await isTrustedContact(myPersonId, personId) : false;

    res.json({
      is_memorial: person.rows[0].is_memorial,
      memorial_date: person.rows[0].memorial_date,
      confirmations: confirmations.rows,
      is_trusted_contact: isTrusted,
      already_confirmed: myPersonId ? confirmations.rows.some(c => c.confirmed_by_person_id === myPersonId) : false
    });
  } catch (error) {
    console.error('Memorial status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
