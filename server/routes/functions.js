import express from 'express';
import { pool } from '../db/index.js';
import { seedFamilyData } from '../db/seed.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

async function isAdmin(userId) {
  const { rows } = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  return rows.length > 0 && rows[0].role === 'admin';
}

async function requireAdminRole(req) {
  const admin = await isAdmin(req.session.userId);
  if (!admin) throw new Error('Admin privileges required');
}

const functionHandlers = {
  async exportFamilyData(req) {
    await requireAdminRole(req);
    const tables = [
      'people', 'households', 'relationships', 'trips', 'trip_participants',
      'meals', 'rooms', 'activities', 'expenses', 'packing_items',
      'shared_trip_items', 'moments', 'love_notes', 'family_stories',
      'family_settings', 'rituals', 'conversations', 'messages', 'calendar_events'
    ];
    const result = {};
    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table}`);
        result[table] = rows;
      } catch {
        result[table] = [];
      }
    }
    return { data: result };
  },

  async makeAdmin(req) {
    const userId = req.session.userId;
    const { rows: userCount } = await pool.query(`SELECT COUNT(*) as count FROM users`);
    const { rows: adminCount } = await pool.query(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`);
    const isFirstUser = parseInt(userCount[0].count) <= 1 || parseInt(adminCount[0].count) === 0;

    if (!isFirstUser) {
      await requireAdminRole(req);
    }

    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [userId]);
    return { data: { success: true, role: 'admin' } };
  },

  async cleanupTestData(req) {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowDestructive = process.env.ALLOW_DESTRUCTIVE_ADMIN === 'true';
    if (isProduction && !allowDestructive) {
      throw new Error('Destructive operations are not allowed in production');
    }
    await requireAdminRole(req);
    if (req.body?.confirm !== 'CLEANUP') {
      throw new Error('Confirmation required: send { confirm: "CLEANUP" }');
    }
    const tablesToClean = [
      'messages', 'conversations', 'calendar_events', 'love_notes', 'moments',
      'family_stories', 'rituals', 'packing_items', 'shared_trip_items',
      'expenses', 'activities', 'rooms', 'meals', 'trip_participants', 'trips',
      'relationships', 'people', 'households', 'join_requests', 'family_settings'
    ];
    for (const table of tablesToClean) {
      try {
        await pool.query(`DELETE FROM ${table}`);
      } catch {
      }
    }
    return { data: { success: true, message: 'Test data cleaned up' } };
  },

  async getFamilyInsights(req) {
    const userId = req.session.userId;
    const { rows: personRows } = await pool.query(`SELECT id FROM people WHERE user_id = $1`, [userId]);
    const personId = personRows[0]?.id;

    const familyPersonIds = [personId];
    if (personId) {
      const { rows: rels } = await pool.query(
        `SELECT related_person_id FROM relationships WHERE person_id = $1 AND status_from_person = 'confirmed'
         UNION
         SELECT person_id FROM relationships WHERE related_person_id = $1 AND status_from_related = 'confirmed'`,
        [personId]
      );
      rels.forEach(r => {
        const id = r.related_person_id || r.person_id;
        if (id && !familyPersonIds.includes(id)) familyPersonIds.push(id);
      });
    }

    const { rows: people } = await pool.query(
      `SELECT id, name, birth_date, privacy_level FROM people WHERE id = ANY($1)`,
      [familyPersonIds]
    );
    const { rows: relationships } = await pool.query(
      `SELECT id, relationship_type, status_from_person FROM relationships WHERE person_id = ANY($1)`,
      [familyPersonIds]
    );
    const { rows: recentMoments } = await pool.query(
      `SELECT id, created_date FROM moments WHERE author_person_id = ANY($1) ORDER BY created_date DESC LIMIT 20`,
      [familyPersonIds]
    );
    const { rows: trips } = await pool.query(
      `SELECT DISTINCT t.id, t.name, t.start_date, t.end_date, t.location FROM trips t
       LEFT JOIN trip_participants tp ON tp.trip_id = t.id
       WHERE tp.person_id = ANY($1) ORDER BY t.start_date DESC LIMIT 10`,
      [familyPersonIds]
    );
    const { rows: loveNotes } = await pool.query(
      `SELECT id, created_date FROM love_notes WHERE from_person_id = ANY($1) OR to_person_id = ANY($1) ORDER BY created_date DESC LIMIT 10`,
      [familyPersonIds]
    );
    const { rows: stories } = await pool.query(
      `SELECT id FROM family_stories WHERE author_person_id = ANY($1)`,
      [familyPersonIds]
    );

    const today = new Date();
    const upcomingBirthdays = people
      .filter(p => p.birth_date && p.privacy_level !== 'private')
      .map(p => {
        const bd = new Date(p.birth_date);
        const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const days = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
        return { name: p.name, days };
      })
      .filter(b => b.days <= 30)
      .sort((a, b) => a.days - b.days);

    const upcomingTrips = trips.filter(t => new Date(t.start_date) > today);
    const confirmedRelationships = relationships.filter(r => r.status_from_person === 'confirmed').length;

    const insights = [];

    if (upcomingBirthdays.length > 0) {
      const first = upcomingBirthdays[0];
      if (first.days === 0) {
        insights.push(`Today is ${first.name}'s birthday! Don't forget to wish them a wonderful day.`);
      } else if (first.days === 1) {
        insights.push(`${first.name}'s birthday is tomorrow! You might want to prepare something special.`);
      } else if (first.days <= 7) {
        insights.push(`${first.name}'s birthday is coming up in ${first.days} days. ${upcomingBirthdays.length > 1 ? `There are ${upcomingBirthdays.length} birthdays in the next month.` : ''}`);
      } else {
        insights.push(`${upcomingBirthdays.length} birthday${upcomingBirthdays.length > 1 ? 's' : ''} coming up in the next month. Next: ${first.name} in ${first.days} days.`);
      }
    }

    if (upcomingTrips.length > 0) {
      const nextTrip = upcomingTrips[upcomingTrips.length - 1];
      const daysUntil = Math.ceil((new Date(nextTrip.start_date) - today) / (1000 * 60 * 60 * 24));
      insights.push(`Your next trip "${nextTrip.name}"${nextTrip.location ? ` to ${nextTrip.location}` : ''} is in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}. ${upcomingTrips.length > 1 ? `You have ${upcomingTrips.length} upcoming trips planned.` : ''}`);
    }

    if (recentMoments.length > 0) {
      const lastMoment = recentMoments[0];
      const daysSince = Math.floor((today - new Date(lastMoment.created_date)) / (1000 * 60 * 60 * 24));
      if (daysSince === 0) {
        insights.push(`A new moment was captured today! Your family has documented ${recentMoments.length} recent memories.`);
      } else if (daysSince <= 3) {
        insights.push(`Your last captured moment was ${daysSince} day${daysSince > 1 ? 's' : ''} ago. Keep the memories flowing!`);
      } else if (daysSince > 7) {
        insights.push(`It's been ${daysSince} days since your last captured moment. Maybe it's time to share something new with your family.`);
      }
    }

    const comingOfAge = people
      .filter(p => p.birth_date && p.privacy_level !== 'private')
      .map(p => {
        const bd = new Date(p.birth_date);
        const eighteenth = new Date(bd.getFullYear() + 18, bd.getMonth(), bd.getDate());
        const daysUntil18 = Math.ceil((eighteenth - today) / (1000 * 60 * 60 * 24));
        return { name: p.name, id: p.id, daysUntil18 };
      })
      .filter(p => p.daysUntil18 > -90 && p.daysUntil18 <= 90);

    const recentAdultIds = comingOfAge.filter(p => p.daysUntil18 <= 0).map(p => p.id);
    const linkedUserIds = new Set();
    if (recentAdultIds.length > 0) {
      const { rows: linked } = await pool.query(
        `SELECT id FROM people WHERE id = ANY($1) AND user_id IS NOT NULL`,
        [recentAdultIds]
      );
      linked.forEach(r => linkedUserIds.add(r.id));
    }

    for (const p of comingOfAge) {
      if (p.daysUntil18 > 0 && p.daysUntil18 <= 30) {
        insights.push(`${p.name} turns 18 in ${p.daysUntil18} day${p.daysUntil18 !== 1 ? 's' : ''}! They'll get their own galaxy and can create their own account. Make sure to add their email address so they can get started.`);
      } else if (p.daysUntil18 > 30 && p.daysUntil18 <= 90) {
        insights.push(`${p.name} is turning 18 in about ${Math.round(p.daysUntil18 / 30)} months. They'll soon be ready for their own galaxy and account.`);
      } else if (p.daysUntil18 <= 0 && !linkedUserIds.has(p.id)) {
        insights.push(`${p.name} recently turned 18 but doesn't have their own account yet. Visit their star profile to add their email and help them get set up.`);
      }
    }

    insights.push(`Your family universe has ${people.length} star${people.length !== 1 ? 's' : ''}, ${confirmedRelationships} confirmed connection${confirmedRelationships !== 1 ? 's' : ''}, ${stories.length} stor${stories.length !== 1 ? 'ies' : 'y'}, and ${loveNotes.length} note${loveNotes.length !== 1 ? 's' : ''} of gratitude.`);

    if (loveNotes.length > 0) {
      const lastNote = loveNotes[0];
      const daysSince = Math.floor((today - new Date(lastNote.created_date)) / (1000 * 60 * 60 * 24));
      if (daysSince > 14) {
        insights.push(`It's been a while since someone sent a love note. A small note of gratitude can brighten someone's day.`);
      }
    } else {
      insights.push(`No love notes have been shared yet. Start a tradition of gratitude — send someone in your family a note today.`);
    }

    const chosen = insights[Math.floor(Math.random() * insights.length)];
    return { data: { insight: chosen } };
  },

  async transferAdmin(req) {
    await requireAdminRole(req);
    const { targetEmail } = req.body || {};
    if (!targetEmail) throw new Error('targetEmail is required');

    const { rows: targetUsers } = await pool.query(`SELECT id, email FROM users WHERE email = $1`, [targetEmail]);
    if (!targetUsers.length) throw new Error('Target user not found');

    const currentUserId = req.session.userId;

    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [targetUsers[0].id]);
    await pool.query(`UPDATE users SET role = 'member' WHERE id = $1`, [currentUserId]);

    return { data: { success: true, newAdmin: targetEmail } };
  },

  async seedFamilyData(req) {
    await requireAdminRole(req);
    if (req.body?.confirm !== 'SEED') {
      throw new Error('Confirmation required: send { confirm: "SEED" }');
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const allowDestructive = process.env.ALLOW_DESTRUCTIVE_ADMIN === 'true';
    if (isProduction && !allowDestructive) {
      throw new Error('Destructive operations are not allowed in production');
    }
    const result = await seedFamilyData({ force: true });
    return { data: result };
  }
};

router.post('/:functionName', requireAuth, async (req, res) => {
  try {
    const { functionName } = req.params;
    const handler = functionHandlers[functionName];
    if (!handler) {
      return res.status(404).json({ error: `Function '${functionName}' not found` });
    }
    const result = await handler(req);
    res.json(result);
  } catch (error) {
    console.error(`Function ${req.params.functionName} error:`, error);
    const statusCode = error.message === 'Admin privileges required' ? 403 : 500;
    res.status(statusCode).json({ error: error.message || 'Function execution failed' });
  }
});

export default router;
