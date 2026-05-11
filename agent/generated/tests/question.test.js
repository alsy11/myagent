const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

let adminToken;
let studentToken;
let adminId;
let studentId;

beforeAll(async () => {
  // Ensure tables exist
  try {
    await db.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(200),
        role VARCHAR(20) NOT NULL DEFAULT 'student',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        prompt TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer VARCHAR(255) NOT NULL,
        difficulty VARCHAR(20) NOT NULL DEFAULT 'easy',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  } catch (err) {
    // Tables may already exist
  }

  // Register admin user
  const adminRes = await request(app)
    .post('/api/users/register')
    .send({ username: 'testadmin_q', password: 'admin1234', displayName: 'Test Admin' });

  if (adminRes.body.success) {
    adminToken = adminRes.body.data.token;
    adminId = adminRes.body.data.user.id;
    // Promote to admin directly in DB
    await db.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', adminId]);
  } else {
    // Try login
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ username: 'testadmin_q', password: 'admin1234' });
    if (loginRes.body.success) {
      adminToken = loginRes.body.data.token;
      adminId = loginRes.body.data.user.id;
    }
  }

  // Register student user
  const studentRes = await request(app)
    .post('/api/users/register')
    .send({ username: 'teststudent_q', password: 'student1234', displayName: 'Test Student' });

  if (studentRes.body.success) {
    studentToken = studentRes.body.data.token;
    studentId = studentRes.body.data.user.id;
  } else {
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ username: 'teststudent_q', password: 'student1234' });
    if (loginRes.body.success) {
      studentToken = loginRes.body.data.token;
      studentId = loginRes.body.data.user.id;
    }
  }
});

afterAll(async () => {
  // Clean up
  if (adminId) {
    await db.query('DELETE FROM games WHERE user_id = $1', [adminId]);
    await db.query('DELETE FROM users WHERE id = $1', [adminId]);
  }
  if (studentId) {
    await db.query('DELETE FROM games WHERE user_id = $1', [studentId]);
    await db.query('DELETE FROM users WHERE id = $1', [studentId]);
  }
  await db.pool.end();
});

describe('Questions API', () => {
  let createdQuestionId;

  test('POST /api/questions - admin can create a question', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prompt: 'What is 1/2 + 1/2?',
        options: ['1', '2/4', '3/4', '2/2'],
        correct_answer: '1',
        difficulty: 'easy',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.prompt).toContain('1/2');
    createdQuestionId = res.body.data.id;
  });

  test('POST /api/questions - student cannot create a question', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        prompt: 'What is 1/2 + 1/2?',
        options: ['1', '2/4', '3/4', '2/2'],
        correct_answer: '1',
        difficulty: 'easy',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/questions - fails without auth', async () => {
    const res = await request(app)
      .post('/api/questions')
      .send({
        prompt: 'Test?',
        options: ['A', 'B'],
        correct_answer: 'A',
      });

    expect(res.status).toBe(401);
  });

  test('POST /api/questions - fails with invalid data', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prompt: '',
        options: ['A'],
        correct_answer: 'B',
      });

    expect(res.status).toBe(400);
  });

  test('GET /api/questions - admin can list questions', async () => {
    const res = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/questions - student cannot list questions', async () => {
    const res = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  test('GET /api/questions/:id - admin can get a question', async () => {
    if (!createdQuestionId) return;

    const res = await request(app)
      .get(`/api/questions/${createdQuestionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdQuestionId);
  });

  test('GET /api/questions/:id - returns 404 for non-existent', async () => {
    const res = await request(app)
      .get('/api/questions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('PUT /api/questions/:id - admin can update a question', async () => {
    if (!createdQuestionId) return;

    const res = await request(app)
      .put(`/api/questions/${createdQuestionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prompt: 'What is 1/4 + 1/4?',
        options: ['1/2', '2/8', '1/4', '3/4'],
        correct_answer: '1/2',
        difficulty: 'easy',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.prompt).toContain('1/4');
  });

  test('PUT /api/questions/:id - student cannot update', async () => {
    if (!createdQuestionId) return;

    const res = await request(app)
      .put(`/api/questions/${createdQuestionId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        prompt: 'Hacked?',
        options: ['A', 'B'],
        correct_answer: 'A',
      });

    expect(res.status).toBe(403);
  });

  test('DELETE /api/questions/:id - admin can delete a question', async () => {
    if (!createdQuestionId) return;

    const res = await request(app)
      .delete(`/api/questions/${createdQuestionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
  });

  test('DELETE /api/questions/:id - student cannot delete', async () => {
    // Create a temp question first
    const createRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prompt: 'Temp question?',
        options: ['Yes', 'No'],
        correct_answer: 'Yes',
        difficulty: 'easy',
      });

    const tempId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/questions/${tempId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);

    // Clean up
    await request(app)
      .delete(`/api/questions/${tempId}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });
});
