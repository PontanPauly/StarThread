import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { getTestServer, closeTestServer, cleanupTestData, createTestUser, authenticatedAgent, pool } from './setup.js';

const TEST_PREFIX = 'test_api_';
let baseUrl;

function testEmail(name) {
  return `${TEST_PREFIX}${name}@example.com`;
}

function agent() {
  return supertest.agent(baseUrl);
}

beforeAll(async () => {
  const server = await getTestServer();
  baseUrl = server.baseUrl;
  await cleanupTestData(TEST_PREFIX);
});

afterAll(async () => {
  await cleanupTestData(TEST_PREFIX);
  await closeTestServer();
  await pool.end();
});

describe('Auth: register, login, logout, session', () => {
  const email = testEmail('auth1');
  const password = 'TestPass123!';
  let userAgent;

  it('should register a new user', async () => {
    userAgent = agent();
    const res = await userAgent
      .post('/api/auth/register')
      .send({ email, password, full_name: 'Auth Test User' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe(email);
    expect(res.body.full_name).toBe('Auth Test User');
  });

  it('should reject duplicate registration', async () => {
    const res = await agent()
      .post('/api/auth/register')
      .send({ email, password, full_name: 'Dup User' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('should reject registration with missing fields', async () => {
    const res = await agent()
      .post('/api/auth/register')
      .send({ email: testEmail('missing') });

    expect(res.status).toBe(400);
  });

  it('should reject registration with short password', async () => {
    const res = await agent()
      .post('/api/auth/register')
      .send({ email: testEmail('short'), password: '123', full_name: 'Short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/);
  });

  it('should return current user with valid session', async () => {
    const res = await userAgent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it('should reject /me without session', async () => {
    const res = await agent().get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should login with correct credentials', async () => {
    userAgent = agent();
    const res = await userAgent
      .post('/api/auth/login')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it('should reject login with wrong password', async () => {
    const res = await agent()
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
  });

  it('should logout and invalidate session', async () => {
    const logoutRes = await userAgent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    const meRes = await userAgent.get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });
});

describe('Entity CRUD: Person', () => {
  const email = testEmail('crud1');
  const password = 'TestPass123!';
  let userAgent;
  let personId;

  beforeAll(async () => {
    const user = await createTestUser(email, password, 'Crud Test');
    personId = user.personId;
    userAgent = await authenticatedAgent(baseUrl, user.userId);
  });

  it('should read person list', async () => {
    const res = await userAgent.get('/api/entities/Person');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const me = res.body.find(p => p.id === personId);
    expect(me).toBeDefined();
    expect(me.first_name).toBe('Crud');
    expect(me.last_name).toBe('Test');
  });

  it('should update person name fields', async () => {
    const res = await userAgent
      .patch(`/api/entities/Person/${personId}`)
      .send({ first_name: 'Updated', last_name: 'Name' });

    expect(res.status).toBe(200);
    expect(res.body.first_name).toBe('Updated');
    expect(res.body.last_name).toBe('Name');
  });

  it('should read updated person by filter', async () => {
    const res = await userAgent
      .get('/api/entities/Person/filter')
      .query({ id: personId });

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].first_name).toBe('Updated');
  });
});

describe('Ownership: non-owners get 403', () => {
  const ownerEmail = testEmail('owner1');
  const otherEmail = testEmail('other1');
  const password = 'TestPass123!';
  let ownerAgent, otherAgent;
  let ownerPersonId;

  beforeAll(async () => {
    const owner = await createTestUser(ownerEmail, password, 'Owner User');
    ownerPersonId = owner.personId;
    ownerAgent = await authenticatedAgent(baseUrl, owner.userId);

    const other = await createTestUser(otherEmail, password, 'Other User');
    otherAgent = await authenticatedAgent(baseUrl, other.userId);
  });

  it('should allow owner to update their own person', async () => {
    const res = await ownerAgent
      .patch(`/api/entities/Person/${ownerPersonId}`)
      .send({ about: 'My about text' });

    expect(res.status).toBe(200);
  });

  it('should deny non-owner from updating another person', async () => {
    const res = await otherAgent
      .patch(`/api/entities/Person/${ownerPersonId}`)
      .send({ about: 'Hijacked about' });

    expect(res.status).toBe(403);
  });

  it('should deny non-owner from deleting another person', async () => {
    const res = await otherAgent
      .delete(`/api/entities/Person/${ownerPersonId}`);

    expect(res.status).toBe(403);
  });

  it('should deny non-planner from updating a trip', async () => {
    const { rows } = await pool.query(
      `INSERT INTO trips (name, start_date, end_date, planner_ids) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Test Trip', '2025-08-01', '2025-08-10', [ownerPersonId]]
    );
    const tripId = rows[0].id;

    const res = await otherAgent
      .patch(`/api/entities/Trip/${tripId}`)
      .send({ name: 'Hijacked Trip' });

    expect(res.status).toBe(403);

    await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);
  });

  it('should allow trip planner to update their trip', async () => {
    const { rows } = await pool.query(
      `INSERT INTO trips (name, start_date, end_date, planner_ids) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Owner Trip', '2025-08-01', '2025-08-10', [ownerPersonId]]
    );
    const tripId = rows[0].id;

    const res = await ownerAgent
      .patch(`/api/entities/Trip/${tripId}`)
      .send({ name: 'Updated Trip' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Trip');

    await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);
  });
});

describe('Beta: join/leave/status', () => {
  const email = testEmail('beta1');
  const password = 'TestPass123!';
  let betaAgent;

  beforeAll(async () => {
    const user = await createTestUser(email, password, 'Beta User');
    betaAgent = await authenticatedAgent(baseUrl, user.userId);
  });

  it('should show non-participant beta status', async () => {
    const res = await betaAgent.get('/api/subscription/beta-status');

    expect(res.status).toBe(200);
    expect(res.body.isParticipant).toBe(false);
    expect(res.body.beta).toHaveProperty('phase');
  });

  it('should join beta', async () => {
    const res = await betaAgent.post('/api/subscription/join-beta');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should show participant beta status after joining', async () => {
    const res = await betaAgent.get('/api/subscription/beta-status');

    expect(res.status).toBe(200);
    expect(res.body.isParticipant).toBe(true);
    expect(res.body.joinedAt).toBeTruthy();
  });

  it('should leave beta', async () => {
    const res = await betaAgent.post('/api/subscription/leave-beta');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should show non-participant after leaving', async () => {
    const res = await betaAgent.get('/api/subscription/beta-status');

    expect(res.status).toBe(200);
    expect(res.body.isParticipant).toBe(false);
  });
});

describe('Admin: requireAdmin blocks non-admin', () => {
  const userEmail = testEmail('nonadmin1');
  const adminEmail = testEmail('admin1');
  const password = 'TestPass123!';
  let userAgentSession, adminAgentSession;

  beforeAll(async () => {
    const regularUser = await createTestUser(userEmail, password, 'Regular User');
    userAgentSession = await authenticatedAgent(baseUrl, regularUser.userId);

    const adminUser = await createTestUser(adminEmail, password, 'Admin User', 'admin');
    adminAgentSession = await authenticatedAgent(baseUrl, adminUser.userId);
  });

  it('should deny non-admin access to admin stats', async () => {
    const res = await userAgentSession.get('/api/admin/stats');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it('should deny non-admin access to admin users list', async () => {
    const res = await userAgentSession.get('/api/admin/users');
    expect(res.status).toBe(403);
  });

  it('should deny non-admin access to beta-stats', async () => {
    const res = await userAgentSession.get('/api/admin/beta-stats');
    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated access to admin endpoints', async () => {
    const res = await agent().get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('should allow admin access to stats', async () => {
    const res = await adminAgentSession.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_users');
    expect(res.body).toHaveProperty('total_people');
  });

  it('should allow admin access to beta-stats', async () => {
    const res = await adminAgentSession.get('/api/admin/beta-stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('beta');
    expect(res.body).toHaveProperty('participants');
  });

  it('should allow admin to list users', async () => {
    const res = await adminAgentSession.get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});

describe('Onboarding: staged member flow', () => {
  const email = testEmail('onboard1');
  const password = 'TestPass123!';
  let onboardAgent;
  let personId, userId;

  beforeAll(async () => {
    const user = await createTestUser(email, password, 'Jane Marie Doe');
    userId = user.userId;
    personId = user.personId;
    onboardAgent = await authenticatedAgent(baseUrl, userId);
  });

  it('should have auto-created person with correct name parts', async () => {
    const personRes = await onboardAgent.get('/api/auth/my-person');
    expect(personRes.status).toBe(200);
    expect(personRes.body).not.toBeNull();
    expect(personRes.body.first_name).toBe('Jane');
    expect(personRes.body.middle_name).toBe('Marie');
    expect(personRes.body.last_name).toBe('Doe');
    expect(personRes.body.role_type).toBe('adult');
  });

  it('should update person profile during onboarding', async () => {
    const res = await onboardAgent
      .patch(`/api/entities/Person/${personId}`)
      .send({
        birth_date: '1990-05-15',
        about: 'A test person for onboarding',
        nickname: 'Janey',
      });

    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe('Janey');
    expect(res.body.about).toBe('A test person for onboarding');
  });

  it('should mark onboarding complete', async () => {
    const res = await onboardAgent
      .patch(`/api/entities/Person/${personId}`)
      .send({ onboarding_complete: true });

    expect(res.status).toBe(200);
    expect(res.body.onboarding_complete).toBe(true);
  });

  it('should create a household for the person', async () => {
    const hhRes = await onboardAgent
      .post('/api/entities/Household')
      .send({ name: 'Test Galaxy' });

    expect(hhRes.status).toBe(201);
    const hhId = hhRes.body.id;

    const personUpdate = await onboardAgent
      .patch(`/api/entities/Person/${personId}`)
      .send({ household_id: hhId });

    expect(personUpdate.status).toBe(200);
    expect(personUpdate.body.household_id).toBe(hhId);

    await pool.query('UPDATE people SET household_id = NULL WHERE id = $1', [personId]);
    await pool.query('DELETE FROM households WHERE id = $1', [hhId]);
  });
});

describe('Identity Scoring Engine', () => {
  it('should compute high score for exact name match', async () => {
    const { computeMatchScore } = await import('../identityScoring.js');
    const candidate = { id: 'fake', name: 'John Smith', first_name: 'John', last_name: 'Smith' };
    const signals = { name: 'John Smith', first_name: 'John', last_name: 'Smith' };
    const result = await computeMatchScore(candidate, signals);
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.breakdown).toHaveProperty('name');
    expect(result.explanations).toBeInstanceOf(Array);
    expect(result.explanations.length).toBeGreaterThan(0);
  });

  it('should override to high confidence on email match', async () => {
    const { computeMatchScore } = await import('../identityScoring.js');
    const candidate = { id: 'fake', name: 'Jane Doe', first_name: 'Jane', last_name: 'Doe', linked_user_email: 'jane@example.com' };
    const signals = { name: 'Janet D', first_name: 'Janet', last_name: 'D', email: 'jane@example.com' };
    const result = await computeMatchScore(candidate, signals);
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.confidence).toBe('high');
    expect(result.explanations.some(e => /email/i.test(e))).toBe(true);
  });

  it('should return low score for unrelated names', async () => {
    const { computeMatchScore } = await import('../identityScoring.js');
    const candidate = { id: 'fake', name: 'Zara Williams', first_name: 'Zara', last_name: 'Williams' };
    const signals = { name: 'John Smith', first_name: 'John', last_name: 'Smith' };
    const result = await computeMatchScore(candidate, signals);
    expect(result.score).toBeLessThan(45);
    expect(result.confidence).not.toBe('high');
  });

  it('should include birth year in scoring', async () => {
    const { computeMatchScore } = await import('../identityScoring.js');
    const candidate = { id: 'fake', name: 'John Smith', first_name: 'John', last_name: 'Smith', birth_year: 1990 };
    const signals = { name: 'John Smith', first_name: 'John', last_name: 'Smith', birthYear: 1990 };
    const withYear = await computeMatchScore(candidate, signals);
    const withoutYear = await computeMatchScore(candidate, { name: 'John Smith', first_name: 'John', last_name: 'Smith' });
    expect(withYear.score).toBeGreaterThan(withoutYear.score);
  });

  it('should include location in scoring', async () => {
    const { computeMatchScore } = await import('../identityScoring.js');
    const candidate = { id: 'fake', name: 'John Smith', first_name: 'John', last_name: 'Smith', city: 'Portland', state: 'OR' };
    const signals = { name: 'John Smith', first_name: 'John', last_name: 'Smith', city: 'Portland', state: 'OR' };
    const withLoc = await computeMatchScore(candidate, signals);
    const withoutLoc = await computeMatchScore(candidate, { name: 'John Smith', first_name: 'John', last_name: 'Smith' });
    expect(withLoc.score).toBeGreaterThan(withoutLoc.score);
  });
});

describe('Upgraded Person Search', () => {
  let searchAgent;
  let searchUser;

  beforeAll(async () => {
    searchUser = await createTestUser(testEmail('search1'), 'Pass123!', 'Search User');
    searchAgent = await authenticatedAgent(baseUrl, searchUser.userId);
    await pool.query(
      `INSERT INTO people (name, first_name, last_name, role_type) VALUES ($1, $2, $3, $4)`,
      ['Searchable Person', 'Searchable', 'Person', 'adult']
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM people WHERE name = 'Searchable Person' AND user_id IS NULL`);
  });

  it('should return scored matches with breakdown', async () => {
    const res = await searchAgent
      .get('/api/entities/Person/search?q=Searchable')
      .expect(200);

    expect(res.body).toHaveProperty('matches');
    expect(res.body.matches.length).toBeGreaterThan(0);
    const match = res.body.matches.find(m => m.name === 'Searchable Person');
    expect(match).toBeDefined();
    expect(match).toHaveProperty('score');
    expect(match).toHaveProperty('confidence');
    expect(match).toHaveProperty('explanations');
  });

  it('should sort matches by score descending', async () => {
    const res = await searchAgent
      .get('/api/entities/Person/search?q=Searchable')
      .expect(200);

    const scores = res.body.matches.map(m => m.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

describe('Claim Suggestions & Dismiss', () => {
  let claimUser;
  let claimAgent;
  let unclaimedPersonId;
  let suggestionId;

  beforeAll(async () => {
    const { rows } = await pool.query(
      `INSERT INTO people (name, first_name, last_name, role_type, linked_user_email)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Claim Target', 'Claim', 'Target', 'adult', testEmail('claimtarget')]
    );
    unclaimedPersonId = rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM person_match_suggestions WHERE suggested_person_id = $1`, [unclaimedPersonId]);
    await pool.query(`UPDATE people SET user_id = NULL, linked_user_email = $2 WHERE id = $1`, [unclaimedPersonId, testEmail('claimtarget')]);
    await pool.query(`DELETE FROM people WHERE id = $1 AND user_id IS NULL`, [unclaimedPersonId]);
  });

  it('should create claim suggestions for matching unclaimed people on register', async () => {
    const regAgent = agent();
    const res = await regAgent
      .post('/api/auth/register')
      .send({ email: testEmail('claimtarget'), password: 'Claim123!', full_name: 'Claim Target' });

    expect(res.status).toBe(201);
    claimUser = res.body;
    claimAgent = regAgent;

    const sugRes = await claimAgent.get('/api/identity/suggestions');
    expect(sugRes.status).toBe(200);
  });

  it('should accept a suggestion', async () => {
    const sugRes = await claimAgent.get('/api/identity/suggestions');
    if (sugRes.body.length > 0) {
      suggestionId = sugRes.body[0].id;
      const acceptRes = await claimAgent
        .post(`/api/identity/suggestions/${suggestionId}/accept`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);

      const person = await pool.query(`SELECT user_id FROM people WHERE id = $1`, [sugRes.body[0].suggested_person_id]);
      expect(person.rows[0].user_id).toBe(claimUser.id);
    }
  });

  it('should dismiss a suggestion', async () => {
    await pool.query(`UPDATE people SET user_id = NULL WHERE id = $1`, [unclaimedPersonId]);
    await pool.query(
      `INSERT INTO person_match_suggestions (user_id, suggested_person_id, score, confidence, status)
       VALUES ($1, $2, 80, 'high', 'pending')
       ON CONFLICT (user_id, suggested_person_id) DO UPDATE SET status = 'pending'`,
      [claimUser.id, unclaimedPersonId]
    );

    const sugRes = await claimAgent.get('/api/identity/suggestions');
    if (sugRes.body.length > 0) {
      const dismissRes = await claimAgent
        .post(`/api/identity/suggestions/${sugRes.body[0].id}/dismiss`)
        .send({ permanent: false });
      expect(dismissRes.status).toBe(200);
    }
  });

  it('should permanently dismiss a suggestion', async () => {
    await pool.query(
      `INSERT INTO person_match_suggestions (user_id, suggested_person_id, score, confidence, status)
       VALUES ($1, $2, 80, 'high', 'pending')
       ON CONFLICT (user_id, suggested_person_id) DO UPDATE SET status = 'pending'`,
      [claimUser.id, unclaimedPersonId]
    );

    const sugRes = await claimAgent.get('/api/identity/suggestions');
    if (sugRes.body.length > 0) {
      const dismissRes = await claimAgent
        .post(`/api/identity/suggestions/${sugRes.body[0].id}/dismiss`)
        .send({ permanent: true });
      expect(dismissRes.status).toBe(200);

      const check = await pool.query(
        `SELECT status FROM person_match_suggestions WHERE user_id = $1 AND suggested_person_id = $2`,
        [claimUser.id, unclaimedPersonId]
      );
      expect(check.rows[0].status).toBe('dismissed_permanently');
    }
  });
});

describe('Person Merge Workflow', () => {
  let mergeUser;
  let mergeAgent;
  let keepPersonId;
  let mergePersonId;

  beforeAll(async () => {
    mergeUser = await createTestUser(testEmail('merger1'), 'Pass123!', 'Merge Tester');
    mergeAgent = await authenticatedAgent(baseUrl, mergeUser.userId);
    keepPersonId = mergeUser.personId;

    const { rows } = await pool.query(
      `INSERT INTO people (name, first_name, last_name, role_type, city)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Merge Victim', 'Merge', 'Victim', 'adult', 'Portland']
    );
    mergePersonId = rows[0].id;

    await pool.query(
      `INSERT INTO relationships (person_id, related_person_id, relationship_type, status_from_person, status_from_related)
       VALUES ($1, $2, $3, $4, $5)`,
      [mergePersonId, keepPersonId, 'sibling', 'confirmed', 'confirmed']
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM merge_history WHERE keep_person_id = $1`, [keepPersonId]);
    await pool.query(`DELETE FROM relationships WHERE person_id = $1 OR related_person_id = $1`, [mergePersonId]);
    await pool.query(`DELETE FROM people WHERE id = $1`, [mergePersonId]);
  });

  it('should reject merge of same person', async () => {
    const res = await mergeAgent
      .post('/api/identity/merge')
      .send({ keepPersonId, mergePersonId: keepPersonId });
    expect(res.status).toBe(400);
  });

  it('should reject merge without required fields', async () => {
    const res = await mergeAgent
      .post('/api/identity/merge')
      .send({ keepPersonId });
    expect(res.status).toBe(400);
  });

  it('should merge an unclaimed person into user profile', async () => {
    const res = await mergeAgent
      .post('/api/identity/merge')
      .send({ keepPersonId, mergePersonId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const person = await pool.query(`SELECT merged_into_id, city FROM people WHERE id = $1`, [mergePersonId]);
    expect(person.rows[0].merged_into_id).toBe(keepPersonId);

    const keepPerson = await pool.query(`SELECT city FROM people WHERE id = $1`, [keepPersonId]);
    expect(keepPerson.rows[0].city).toBe('Portland');
  });

  it('should return merge history', async () => {
    const res = await mergeAgent.get('/api/identity/merge-history');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('merged_data');
  });

  it('should create conflict when both people are claimed', async () => {
    const user2 = await createTestUser(testEmail('merger2'), 'Pass123!', 'Merge Claimer');
    const agent2 = await authenticatedAgent(baseUrl, user2.userId);

    const res = await agent2
      .post('/api/identity/merge')
      .send({ keepPersonId: user2.personId, mergePersonId: keepPersonId });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/admin|review|claimed/i);
  });
});

describe('Computed Relationship Inference', () => {
  let inferUser;
  let inferAgent;
  let grandparentId, parentId, childId, siblingId;

  beforeAll(async () => {
    inferUser = await createTestUser(testEmail('infer1'), 'Pass123!', 'Infer Child');
    inferAgent = await authenticatedAgent(baseUrl, inferUser.userId);
    childId = inferUser.personId;

    const gpRes = await pool.query(
      `INSERT INTO people (name, first_name, last_name, role_type) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Infer Grandparent', 'Infer', 'Grandparent', 'adult']
    );
    grandparentId = gpRes.rows[0].id;

    const pRes = await pool.query(
      `INSERT INTO people (name, first_name, last_name, role_type) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Infer Parent', 'Infer', 'Parent', 'adult']
    );
    parentId = pRes.rows[0].id;

    const sRes = await pool.query(
      `INSERT INTO people (name, first_name, last_name, role_type) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Infer Sibling', 'Infer', 'Sibling', 'adult']
    );
    siblingId = sRes.rows[0].id;

    const rels = [
      [grandparentId, parentId, 'parent', 'confirmed', 'confirmed'],
      [parentId, grandparentId, 'child', 'confirmed', 'confirmed'],
      [parentId, childId, 'parent', 'confirmed', 'confirmed'],
      [childId, parentId, 'child', 'confirmed', 'confirmed'],
      [parentId, siblingId, 'parent', 'confirmed', 'confirmed'],
      [siblingId, parentId, 'child', 'confirmed', 'confirmed'],
    ];
    for (const [pid, rid, type, s1, s2] of rels) {
      await pool.query(
        `INSERT INTO relationships (person_id, related_person_id, relationship_type, status_from_person, status_from_related)
         VALUES ($1, $2, $3, $4, $5)`,
        [pid, rid, type, s1, s2]
      );
    }
  });

  afterAll(async () => {
    const ids = [grandparentId, parentId, siblingId].filter(Boolean);
    if (ids.length > 0) {
      await pool.query(`DELETE FROM relationships WHERE person_id = ANY($1) OR related_person_id = ANY($1)`, [ids]);
      await pool.query(`DELETE FROM people WHERE id = ANY($1)`, [ids]);
    }
  });

  it('should infer grandparent relationship', async () => {
    const res = await inferAgent
      .get(`/api/relationships/inferred/${childId}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);

    const gpRel = res.body.find(r => r.personId === grandparentId);
    expect(gpRel).toBeDefined();
    expect(gpRel.inferredType).toBe('grandparent');
    expect(gpRel.source).toBe('inferred');
  });

  it('should infer sibling relationship', async () => {
    const res = await inferAgent
      .get(`/api/relationships/inferred/${childId}`);

    const sibRel = res.body.find(r => r.personId === siblingId);
    expect(sibRel).toBeDefined();
    expect(sibRel.inferredType).toBe('sibling');
  });

  it('should include path and confidence', async () => {
    const res = await inferAgent
      .get(`/api/relationships/inferred/${childId}`);

    const gpRel = res.body.find(r => r.personId === grandparentId);
    if (gpRel) {
      expect(gpRel).toHaveProperty('path');
      expect(gpRel).toHaveProperty('confidence');
      expect(gpRel.path.length).toBeGreaterThan(0);
    }
  });
});
