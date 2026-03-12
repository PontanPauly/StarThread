import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { BETA_CONFIG, isBetaActive, isBetaGracePeriodActive, getBetaStatus } from '../betaConfig.js';

const router = express.Router();

router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const { rows: userRows } = await pool.query(
      `SELECT subscription_tier FROM users WHERE id = $1`,
      [userId]
    );
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tier = userRows[0].subscription_tier || 'free';

    const { rows: membership } = await pool.query(
      `SELECT fp.id as plan_id, fp.name as plan_name, fp.max_seats, fp.owner_user_id
       FROM family_plan_members fpm
       JOIN family_plans fp ON fp.id = fpm.family_plan_id
       WHERE fpm.user_id = $1
       LIMIT 1`,
      [userId]
    );

    const plan = membership.length > 0 ? {
      plan_id: membership[0].plan_id,
      plan_name: membership[0].plan_name,
      max_seats: membership[0].max_seats,
      is_owner: membership[0].owner_user_id === userId,
    } : null;

    res.json({ tier, plan });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/plan', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const { rows: plans } = await pool.query(
      `SELECT * FROM family_plans WHERE owner_user_id = $1 LIMIT 1`,
      [userId]
    );
    if (!plans.length) {
      return res.json({ plan: null });
    }

    const plan = plans[0];

    const { rows: members } = await pool.query(
      `SELECT fpm.user_id, fpm.joined_at, u.email, u.full_name
       FROM family_plan_members fpm
       JOIN users u ON u.id = fpm.user_id
       WHERE fpm.family_plan_id = $1
       ORDER BY fpm.joined_at`,
      [plan.id]
    );

    const { rows: activeCount } = await pool.query(
      `SELECT COUNT(DISTINCT u.id) as count
       FROM family_plan_members fpm
       JOIN users u ON u.id = fpm.user_id
       JOIN people p ON p.user_id = u.id
       WHERE fpm.family_plan_id = $1
         AND p.is_deceased IS NOT TRUE
         AND p.is_memorial IS NOT TRUE`,
      [plan.id]
    );

    res.json({
      plan: {
        ...plan,
        members,
        active_seat_count: parseInt(activeCount[0].count),
      }
    });
  } catch (error) {
    console.error('Plan details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/beta-status', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { rows } = await pool.query(
      `SELECT beta_participant, beta_joined_at, beta_discount_applied FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    const betaStatus = getBetaStatus();

    const hasFullAccess = user.beta_participant && (betaStatus.phase === 'active' || betaStatus.phase === 'grace');

    res.json({
      isParticipant: user.beta_participant || false,
      joinedAt: user.beta_joined_at,
      discountApplied: user.beta_discount_applied || false,
      discountPercent: BETA_CONFIG.discountPercent,
      discountDurationMonths: BETA_CONFIG.discountDurationMonths,
      beta: betaStatus,
      hasFullAccess,
    });
  } catch (error) {
    console.error('Beta status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/join-beta', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!isBetaActive()) {
      return res.status(400).json({ error: 'The beta program has ended' });
    }

    await pool.query(
      `UPDATE users SET beta_participant = true, beta_joined_at = NOW() WHERE id = $1 AND beta_participant IS NOT TRUE`,
      [userId]
    );

    res.json({ success: true, message: 'Welcome to the StarThread beta!' });
  } catch (error) {
    console.error('Join beta error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/leave-beta', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    await pool.query(
      `UPDATE users SET beta_participant = false WHERE id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'You have left the beta program' });
  } catch (error) {
    console.error('Leave beta error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
