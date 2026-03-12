import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getUncachableGoogleCalendarClient, isGoogleCalendarConnected
} from '../googleCalendar.js';

const router = Router();

async function getPersonIdForUser(userId) {
  const result = await pool.query(
    'SELECT id, household_id FROM people WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

router.get('/events', requireAuth, async (req, res) => {
  try {
    const { scope = 'galaxy', start_date, end_date } = req.query;
    const person = await getPersonIdForUser(req.session.userId);
    if (!person) {
      return res.status(404).json({ error: 'No person profile found' });
    }
    const myPersonId = person.id;

    let query;
    let params;

    const dateFilter = start_date && end_date
      ? 'AND ce.date BETWEEN $2 AND $3'
      : '';
    const baseParams = start_date && end_date
      ? [myPersonId, start_date, end_date]
      : [myPersonId];
    const pIdx = baseParams.length;

    if (scope === 'private') {
      query = `
        SELECT ce.*, p.name as creator_name
        FROM calendar_events ce
        LEFT JOIN people p ON p.id = ce.created_by
        WHERE ce.created_by = $1
        ${dateFilter}
        ORDER BY ce.date ASC, ce.start_time ASC NULLS LAST
      `;
      params = baseParams;
    } else if (scope === 'galaxy') {
      query = `
        SELECT ce.*, p.name as creator_name
        FROM calendar_events ce
        LEFT JOIN people p ON p.id = ce.created_by
        WHERE (
          (ce.created_by IN (
            SELECT pp.id FROM people pp WHERE pp.household_id = (
              SELECT pp2.household_id FROM people pp2 WHERE pp2.id = $1
            )
          ) AND ce.visibility IN ('galaxy', 'universe'))
          OR (ce.created_by = $1)
          OR (ce.created_by IS NULL)
          OR ($1 = ANY(ce.shared_with))
        )
        ${dateFilter}
        ORDER BY ce.date ASC, ce.start_time ASC NULLS LAST
      `;
      params = baseParams;
    } else if (scope === 'universe') {
      query = `
        SELECT * FROM (
          SELECT DISTINCT ON (ce.id) ce.*, p.name as creator_name
          FROM calendar_events ce
          LEFT JOIN people p ON p.id = ce.created_by
          WHERE (
            (ce.visibility = 'universe' AND ce.created_by IN (
              SELECT r.related_person_id FROM relationships r WHERE r.person_id = $1
              UNION
              SELECT r.person_id FROM relationships r WHERE r.related_person_id = $1
            ))
            OR (ce.created_by IN (
              SELECT pp.id FROM people pp WHERE pp.household_id = (
                SELECT pp2.household_id FROM people pp2 WHERE pp2.id = $1
              )
            ) AND ce.visibility IN ('galaxy', 'universe'))
            OR (ce.created_by = $1)
            OR (ce.created_by IS NULL)
            OR ($1 = ANY(ce.shared_with))
          )
          ${dateFilter}
          ORDER BY ce.id
        ) sub
        ORDER BY sub.date ASC, sub.start_time ASC NULLS LAST
      `;
      params = baseParams;
    } else {
      return res.status(400).json({ error: 'Invalid scope. Use: private, galaxy, universe' });
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Calendar events fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

router.post('/events', requireAuth, async (req, res) => {
  try {
    const person = await getPersonIdForUser(req.session.userId);
    if (!person) {
      return res.status(404).json({ error: 'No person profile found' });
    }

    const { rows: personRows } = await pool.query(
      `SELECT role_type, parental_controls FROM people WHERE id = $1`, [person.id]
    );
    if (personRows.length > 0) {
      const p = personRows[0];
      if ((p.role_type === 'teen' || p.role_type === 'child') && p.parental_controls && p.parental_controls.calendar === false) {
        return res.status(403).json({ error: 'Calendar access is restricted by parental controls' });
      }
    }

    const {
      title, description, date, end_date, start_time, end_time,
      event_type, person_ids, is_recurring, recurrence_rule,
      color, location, visibility, shared_with
    } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    if (isNaN(Date.parse(date))) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO date (e.g. YYYY-MM-DD)' });
    }

    if (person_ids !== undefined && person_ids !== null && !Array.isArray(person_ids)) {
      return res.status(400).json({ error: 'person_ids must be an array' });
    }

    if (shared_with !== undefined && shared_with !== null && !Array.isArray(shared_with)) {
      return res.status(400).json({ error: 'shared_with must be an array' });
    }

    if (is_recurring !== undefined && is_recurring !== null && typeof is_recurring !== 'boolean') {
      return res.status(400).json({ error: 'is_recurring must be a boolean' });
    }

    const allowedVisibility = ['private', 'galaxy', 'universe'];
    if (visibility !== undefined && visibility !== null && !allowedVisibility.includes(visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${allowedVisibility.join(', ')}` });
    }

    const result = await pool.query(
      `INSERT INTO calendar_events
        (title, description, date, end_date, start_time, end_time, event_type,
         person_ids, is_recurring, recurrence_rule, color, location,
         created_by, visibility, shared_with)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        title, description || null, date, end_date || null,
        start_time || null, end_time || null, event_type || null,
        person_ids || null, is_recurring || false, recurrence_rule || null,
        color || null, location || null,
        person.id, visibility || 'galaxy', shared_with || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '22P02' || error.code === '22007' || error.code === '22003') {
      return res.status(400).json({ error: `Invalid input: ${error.message.split('\n')[0]}` });
    }
    console.error('Calendar event create error:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

router.patch('/events/:id', requireAuth, async (req, res) => {
  try {
    const person = await getPersonIdForUser(req.session.userId);
    if (!person) {
      return res.status(404).json({ error: 'No person profile found' });
    }

    const existing = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (!existing.rows[0].created_by || existing.rows[0].created_by !== person.id) {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const allowedFields = [
      'title', 'description', 'date', 'end_date', 'start_time', 'end_time',
      'event_type', 'person_ids', 'is_recurring', 'recurrence_rule',
      'color', 'location', 'visibility', 'shared_with'
    ];

    const updates = [];
    const values = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx}`);
        values.push(req.body[field]);
        paramIdx++;
      }
    }

    if (req.body.date !== undefined && isNaN(Date.parse(req.body.date))) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO date (e.g. YYYY-MM-DD)' });
    }

    if (req.body.person_ids !== undefined && req.body.person_ids !== null && !Array.isArray(req.body.person_ids)) {
      return res.status(400).json({ error: 'person_ids must be an array' });
    }

    if (req.body.shared_with !== undefined && req.body.shared_with !== null && !Array.isArray(req.body.shared_with)) {
      return res.status(400).json({ error: 'shared_with must be an array' });
    }

    if (req.body.is_recurring !== undefined && req.body.is_recurring !== null && typeof req.body.is_recurring !== 'boolean') {
      return res.status(400).json({ error: 'is_recurring must be a boolean' });
    }

    const allowedVisibility = ['private', 'galaxy', 'universe'];
    if (req.body.visibility !== undefined && req.body.visibility !== null && !allowedVisibility.includes(req.body.visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${allowedVisibility.join(', ')}` });
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '22P02' || error.code === '22007' || error.code === '22003') {
      return res.status(400).json({ error: `Invalid input: ${error.message.split('\n')[0]}` });
    }
    console.error('Calendar event update error:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

router.delete('/events/:id', requireAuth, async (req, res) => {
  try {
    const person = await getPersonIdForUser(req.session.userId);
    if (!person) {
      return res.status(404).json({ error: 'No person profile found' });
    }

    const existing = await pool.query(
      'SELECT created_by FROM calendar_events WHERE id = $1',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (!existing.rows[0].created_by || existing.rows[0].created_by !== person.id) {
      return res.status(403).json({ error: 'You can only delete your own events' });
    }

    await pool.query('DELETE FROM calendar_events WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Calendar event delete error:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

router.get('/google/status', requireAuth, async (req, res) => {
  try {
    const prefsResult = await pool.query(
      'SELECT calendar_preferences FROM users WHERE id = $1',
      [req.session.userId]
    );
    const prefs = prefsResult.rows[0]?.calendar_preferences || {};

    if (prefs.google_disconnected) {
      return res.json({ connected: false });
    }

    const connected = await isGoogleCalendarConnected();
    let calendarName = null;
    if (connected && prefs.sync_from_name) {
      calendarName = prefs.sync_from_name;
    }
    res.json({ connected, calendarName });
  } catch (error) {
    console.error('Google status check error:', error);
    res.json({ connected: false });
  }
});

router.get('/google/calendars', requireAuth, async (req, res) => {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    const response = await calendar.calendarList.list();
    const calendars = (response.data.items || []).map(cal => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
    }));
    res.json(calendars);
  } catch (error) {
    console.error('Google calendars list error:', error);
    res.status(500).json({ error: 'Failed to fetch Google calendars' });
  }
});

router.get('/google/preferences', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT calendar_preferences FROM users WHERE id = $1',
      [req.session.userId]
    );
    res.json(result.rows[0]?.calendar_preferences || {});
  } catch (error) {
    console.error('Google preferences fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

router.put('/google/preferences', requireAuth, async (req, res) => {
  try {
    const { sync_from, sync_from_name, sync_to, sync_to_name, default_import_visibility } = req.body;
    const prefs = {};
    if (sync_from !== undefined) prefs.sync_from = sync_from;
    if (sync_from_name !== undefined) prefs.sync_from_name = sync_from_name;
    if (sync_to !== undefined) prefs.sync_to = sync_to;
    if (sync_to_name !== undefined) prefs.sync_to_name = sync_to_name;
    if (default_import_visibility !== undefined) prefs.default_import_visibility = default_import_visibility;

    await pool.query(
      `UPDATE users SET calendar_preferences = COALESCE(calendar_preferences, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify(prefs), req.session.userId]
    );
    const result = await pool.query(
      'SELECT calendar_preferences FROM users WHERE id = $1',
      [req.session.userId]
    );
    res.json(result.rows[0]?.calendar_preferences || {});
  } catch (error) {
    console.error('Google preferences update error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

router.post('/google/disconnect', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET calendar_preferences = '{"google_disconnected": true}'::jsonb WHERE id = $1`,
      [req.session.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Google disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

router.post('/google/reconnect', requireAuth, async (req, res) => {
  try {
    const connected = await isGoogleCalendarConnected();
    if (!connected) {
      return res.status(400).json({ error: 'Google Calendar connector is not available' });
    }
    await pool.query(
      `UPDATE users SET calendar_preferences = COALESCE(calendar_preferences, '{}'::jsonb) - 'google_disconnected' WHERE id = $1`,
      [req.session.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Google reconnect error:', error);
    res.status(500).json({ error: 'Failed to reconnect' });
  }
});

router.get('/google/events', requireAuth, async (req, res) => {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const prefsResult = await pool.query(
      'SELECT calendar_preferences FROM users WHERE id = $1',
      [req.session.userId]
    );
    const prefs = prefsResult.rows[0]?.calendar_preferences || {};
    const calendarId = prefs.sync_from || 'primary';

    const { start, end } = req.query;
    const params = {
      calendarId,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    };
    if (start) params.timeMin = new Date(start).toISOString();
    if (end) {
      const endDate = new Date(end);
      endDate.setDate(endDate.getDate() + 1);
      params.timeMax = endDate.toISOString();
    }

    const response = await calendar.events.list(params);
    const events = (response.data.items || []).map(event => ({
      google_id: event.id,
      title: event.summary || '(No title)',
      description: event.description || '',
      location: event.location || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      all_day: !event.start?.dateTime,
      html_link: event.htmlLink,
    }));

    res.json(events);
  } catch (error) {
    console.error('Google events fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch Google Calendar events' });
  }
});

router.post('/google/import', requireAuth, async (req, res) => {
  try {
    const person = await getPersonIdForUser(req.session.userId);
    if (!person) {
      return res.status(404).json({ error: 'No person profile found' });
    }

    const prefsResult = await pool.query(
      'SELECT calendar_preferences FROM users WHERE id = $1',
      [req.session.userId]
    );
    const prefs = prefsResult.rows[0]?.calendar_preferences || {};
    const defaultVis = prefs.default_import_visibility || 'galaxy';

    const { google_id, title, description, date, start_time, end_time, location, visibility } = req.body;
    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    const result = await pool.query(
      `INSERT INTO calendar_events
        (title, description, date, start_time, end_time, location, created_by, visibility, google_event_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [title, description || null, date, start_time || null, end_time || null,
       location || null, person.id, visibility || defaultVis, google_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Google event import error:', error);
    res.status(500).json({ error: 'Failed to import Google event' });
  }
});

router.post('/google/push', requireAuth, async (req, res) => {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const person = await getPersonIdForUser(req.session.userId);
    if (!person) {
      return res.status(404).json({ error: 'No person profile found' });
    }

    const prefsResult = await pool.query(
      'SELECT calendar_preferences FROM users WHERE id = $1',
      [req.session.userId]
    );
    const prefs = prefsResult.rows[0]?.calendar_preferences || {};
    const pushCalendarId = prefs.sync_to || 'primary';

    const { event_id, timezone } = req.body;
    const tz = timezone || 'America/New_York';
    const eventResult = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1',
      [event_id]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (!eventResult.rows[0].created_by || eventResult.rows[0].created_by !== person.id) {
      return res.status(403).json({ error: 'You can only push your own events to Google' });
    }

    const event = eventResult.rows[0];
    const googleEvent = {
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
    };

    if (event.start_time) {
      googleEvent.start = { dateTime: `${event.date}T${event.start_time}`, timeZone: tz };
      googleEvent.end = {
        dateTime: `${event.end_date || event.date}T${event.end_time || event.start_time}`,
        timeZone: tz
      };
    } else {
      googleEvent.start = { date: event.date };
      googleEvent.end = { date: event.end_date || event.date };
    }

    const response = await calendar.events.insert({
      calendarId: pushCalendarId,
      resource: googleEvent,
    });

    await pool.query(
      'UPDATE calendar_events SET google_event_id = $1 WHERE id = $2',
      [response.data.id, event_id]
    );

    res.json({ success: true, google_event_id: response.data.id });
  } catch (error) {
    console.error('Google event push error:', error);
    res.status(500).json({ error: 'Failed to push event to Google Calendar' });
  }
});

export default router;
