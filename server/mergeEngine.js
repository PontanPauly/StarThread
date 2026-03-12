import { pool } from './db/index.js';

export async function mergePeople(keepPersonId, mergePersonId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: keepRows } = await client.query(`SELECT * FROM people WHERE id = $1 AND merged_into_id IS NULL`, [keepPersonId]);
    const { rows: mergeRows } = await client.query(`SELECT * FROM people WHERE id = $1 AND merged_into_id IS NULL`, [mergePersonId]);

    if (keepRows.length === 0 || mergeRows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('One or both people not found or already merged');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const keepPerson = keepRows[0];
    const mergePerson = mergeRows[0];

    if (keepPerson.user_id && mergePerson.user_id) {
      const { rows: conflictRows } = await client.query(`
        INSERT INTO merge_conflicts (person_a_id, person_b_id, reported_by_user_id, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id
      `, [keepPersonId, mergePersonId, userId]);

      await client.query('COMMIT');
      const err = new Error('Both people have active accounts. This merge requires admin review.');
      err.code = 'CONFLICT';
      err.conflictId = conflictRows[0]?.id;
      throw err;
    }

    const isAdmin = await checkAdmin(client, userId);
    if (!isAdmin) {
      const myPersonResult = await client.query(`SELECT id FROM people WHERE user_id = $1`, [userId]);
      const myPersonId = myPersonResult.rows[0]?.id;
      if (!myPersonId) {
        await client.query('ROLLBACK');
        const err = new Error('No person record linked to your account');
        err.code = 'FORBIDDEN';
        throw err;
      }

      const ownsKeep = keepPerson.user_id === userId ||
        (keepPerson.guardian_ids && keepPerson.guardian_ids.includes(myPersonId));
      const ownsMerge = mergePerson.user_id === userId ||
        (mergePerson.guardian_ids && mergePerson.guardian_ids.includes(myPersonId));

      if (!ownsKeep && !ownsMerge) {
        await client.query('ROLLBACK');
        const err = new Error('You must own or be guardian of at least one person to merge');
        err.code = 'FORBIDDEN';
        throw err;
      }

      if (!ownsKeep && ownsMerge) {
        await client.query('ROLLBACK');
        const err = new Error('You can only merge other people into your own profile, not the reverse');
        err.code = 'FORBIDDEN';
        throw err;
      }

      if (mergePerson.user_id && mergePerson.user_id !== userId) {
        await client.query('ROLLBACK');
        const err = new Error('Cannot merge a person owned by another user');
        err.code = 'FORBIDDEN';
        throw err;
      }
    }

    await transferRelationships(client, keepPersonId, mergePersonId);

    const transferTables = [
      { table: 'moments', column: 'author_person_id' },
      { table: 'love_notes', column: 'from_person_id' },
      { table: 'love_notes', column: 'to_person_id' },
      { table: 'family_stories', column: 'author_person_id' },
      { table: 'trip_participants', column: 'person_id' },
      { table: 'packing_items', column: 'person_id' },
      { table: 'trusted_contacts', column: 'person_id' },
    ];

    for (const { table, column } of transferTables) {
      try {
        await client.query(
          `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`,
          [keepPersonId, mergePersonId]
        );
      } catch (transferErr) {
        if (transferErr.code === '23505') continue;
        throw transferErr;
      }
    }

    await client.query(
      `UPDATE family_stories SET related_person_ids = array_replace(related_person_ids, $2, $1)
       WHERE $2 = ANY(related_person_ids)`,
      [keepPersonId, mergePersonId]
    );

    if (mergePerson.user_id && !keepPerson.user_id) {
      await client.query(
        `UPDATE people SET user_id = $1, linked_user_email = $2 WHERE id = $3`,
        [mergePerson.user_id, mergePerson.linked_user_email, keepPersonId]
      );
    }

    const mergeableFields = [
      'first_name', 'middle_name', 'last_name', 'nickname', 'photo_url',
      'birth_date', 'birth_year', 'death_date', 'city', 'state', 'address',
      'about', 'allergies', 'dietary_preferences', 'star_profile',
      'star_pattern', 'star_intensity', 'star_flare_count'
    ];

    const provenanceLog = {};
    const updates = [];
    const updateValues = [];
    let paramIdx = 1;

    for (const field of mergeableFields) {
      const keepVal = keepPerson[field];
      const mergeVal = mergePerson[field];
      provenanceLog[field] = {
        kept: keepVal !== null && keepVal !== undefined ? String(keepVal) : null,
        fromMerged: mergeVal !== null && mergeVal !== undefined ? String(mergeVal) : null,
        action: keepVal != null ? 'kept_existing' : mergeVal != null ? 'filled_from_merged' : 'both_null',
      };
      if (keepVal == null && mergeVal != null) {
        updates.push(`${field} = $${paramIdx}`);
        updateValues.push(mergeVal);
        paramIdx++;
      }
    }

    if (updates.length > 0) {
      updateValues.push(keepPersonId);
      await client.query(
        `UPDATE people SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
        updateValues
      );
    }

    if (keepPerson.name !== mergePerson.name || updates.some(u => u.startsWith('first_name') || u.startsWith('last_name'))) {
      const { rows: refreshed } = await client.query(`SELECT first_name, middle_name, last_name FROM people WHERE id = $1`, [keepPersonId]);
      if (refreshed[0]) {
        const newName = [refreshed[0].first_name, refreshed[0].middle_name, refreshed[0].last_name].filter(Boolean).join(' ');
        if (newName) {
          await client.query(`UPDATE people SET name = $1 WHERE id = $2`, [newName, keepPersonId]);
        }
      }
    }

    await client.query(`
      INSERT INTO merge_history (keep_person_id, merged_person_id, merged_by_user_id, merged_data)
      VALUES ($1, $2, $3, $4)
    `, [keepPersonId, mergePersonId, userId, JSON.stringify({
      mergedPerson: mergePerson,
      provenance: provenanceLog,
    })]);

    await client.query(
      `UPDATE people SET merged_into_id = $1 WHERE id = $2`,
      [keepPersonId, mergePersonId]
    );

    await client.query('COMMIT');
    return { success: true, keepPersonId, mergedPersonId: mergePersonId };
  } catch (error) {
    if (error.code !== 'CONFLICT') {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}

async function transferRelationships(client, keepId, mergeId) {
  const { rows: mergeRels } = await client.query(
    `SELECT * FROM relationships WHERE person_id = $1 OR related_person_id = $1`,
    [mergeId]
  );

  for (const rel of mergeRels) {
    const isSource = rel.person_id === mergeId;
    const newSourceId = isSource ? keepId : rel.person_id;
    const newTargetId = isSource ? rel.related_person_id : keepId;

    if (newSourceId === newTargetId) continue;

    const { rows: existing } = await client.query(
      `SELECT id FROM relationships 
       WHERE person_id = $1 AND related_person_id = $2 AND relationship_type = $3`,
      [newSourceId, newTargetId, rel.relationship_type]
    );

    if (existing.length > 0) continue;

    try {
      await client.query(
        `UPDATE relationships SET 
         person_id = $1, related_person_id = $2
         WHERE id = $3`,
        [newSourceId, newTargetId, rel.id]
      );
    } catch (err) {
      if (err.code === '23505') continue;
      throw err;
    }
  }
}

async function checkAdmin(client, userId) {
  const { rows } = await client.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  return rows.length > 0 && rows[0].role === 'admin';
}
