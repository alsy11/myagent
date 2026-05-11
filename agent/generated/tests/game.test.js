const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

let token;
let userId;

beforeAll(async () => {
  // Ensure tables exist and seed data
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
      CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_state JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Seed questions if empty
    const qCount = await db.query('SELECT COUNT(*) FROM questions');
    if (parseInt(qCount.rows[0].count) === 0) {
      await db.query(`
        INSERT INTO questions (prompt, options, correct_answer, difficulty) VALUES
        ('What is 1/2 + 1/4?', '["3/4", "2/6", "1/6", "2/4"]', '3/4', 'easy'),
        ('What is 2/3 of 12?', '["6", "8", "4", "10"]', '8', 'easy'),
        ('Which fraction is equivalent to 3/5?', '["6/10", "3/10", "6/5", "9/15"]', '6/10', 'easy'),
        ('What is 3/4 - 1/2?', '["1/4", "2/2", "1/2", "2/4"]', '1/4', 'medium'),
        ('Simplify: 8/12', '["2/3", "4/6", "1/3", "3/4"]', '2/3', 'medium'),
        ('What is 2/5 + 3/10?', '["7/10", "5/15", "1/2", "5/10"]', '7/10', 'medium'),
        ('Which is larger: 5/8 or 3/5?', '["5/8", "3/5", "They are equal", "Cannot determine"]', '5/8', 'hard'),
        ('What is 1/3 x 3/4?', '["1/4", "3/12", "1/3", "3/7"]', '1/4', 'hard'),
        ('What is 3/4 / 1/2?', '["1 1/2", "3/8", "3/2", "1/2"]', '1 1/2', 'hard'),
        ('Order from smallest to largest: 1/3, 2/5, 3/10', '["3/10, 1/3, 2/5", "1/3, 2/5, 3/10", "2/5, 1/3, 3/10", "3/10, 2/5, 1/3"]', '3/10, 1/3, 2/5', 'hard');
      `);
    }
  } catch (err) {
    // Tables may already exist
  }

  // Register a test user
  const res = await request(app)
    .post('/api/users/register')
    .send({ username: 'testgamer', password: 'test1234', displayName: 'Test Gamer' });

  if (res.body.success) {
    token = res.body.data.token;
    userId = res.body.data.user.id;
  } else {
    // User may already exist, try login
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ username: 'testgamer', password: 'test1234' });
    if (loginRes.body.success) {
      token = loginRes.body.data.token;
      userId = loginRes.body.data.user.id;
    }
  }
});

afterAll(async () => {
  // Clean up test data
  if (userId) {
    await db.query('DELETE FROM games WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  }
  await db.pool.end();
});

describe('Game API', () => {
  let gameId;

  test('POST /api/game/start - should start a new game', async () => {
    const res = await request(app)
      .post('/api/game/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('currentQuestion');
    expect(res.body.data).toHaveProperty('state', 'playing');
    expect(res.body.data).toHaveProperty('total', 10);
    gameId = res.body.data.gameId;
  });

  test('POST /api/game/start - should fail without auth', async () => {
    const res = await request(app)
      .post('/api/game/start');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/game/:id/answer - should submit an answer', async () => {
    // First start a game
    const startRes = await request(app)
      .post('/api/game/start')
      .set('Authorization', `Bearer ${token}`);

    const gId = startRes.body.data.gameId;
    const question = startRes.body.data.currentQuestion;

    // Submit the correct answer
    const correctAnswer = await getCorrectAnswer(question.id);
    const res = await request(app)
      .post(`/api/game/${gId}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: correctAnswer });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('isCorrect');
    expect(res.body.data).toHaveProperty('score');
  });

  test('POST /api/game/:id/answer - should fail without auth', async () => {
    const res = await request(app)
      .post(`/api/game/${gameId}/answer`)
      .send({ answer: '3/4' });

    expect(res.status).toBe(401);
  });

  test('POST /api/game/:id/answer - should fail with missing answer', async () => {
    const res = await request(app)
      .post(`/api/game/${gameId}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('GET /api/game/:id/score - should get score', async () => {
    const startRes = await request(app)
      .post('/api/game/start')
      .set('Authorization', `Bearer ${token}`);

    const gId = startRes.body.data.gameId;

    const res = await request(app)
      .get(`/api/game/${gId}/score`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('score');
    expect(res.body.data).toHaveProperty('state');
  });

  test('GET /api/game/:id/score - should fail without auth', async () => {
    const res = await request(app)
      .get(`/api/game/${gameId}/score`);

    expect(res.status).toBe(401);
  });

  test('POST /api/game/:id/pause and resume - should pause and resume game', async () => {
    const startRes = await request(app)
      .post('/api/game/start')
      .set('Authorization', `Bearer ${token}`);

    const gId = startRes.body.data.gameId;

    // Pause
    const pauseRes = await request(app)
      .post(`/api/game/${gId}/pause`)
      .set('Authorization', `Bearer ${token}`);

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.state).toBe('paused');

    // Resume
    const resumeRes = await request(app)
      .post(`/api/game/${gId}/resume`)
      .set('Authorization', `Bearer ${token}`);

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.state).toBe('playing');
  });

  test('POST /api/game/:id/pause - should fail for non-existent game', async () => {
    const res = await request(app)
      .post('/api/game/00000000-0000-0000-0000-000000000000/pause')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

/**
 * Helper: get correct answer for a question id.
 */
async function getCorrectAnswer(questionId) {
  const res = await db.query('SELECT correct_answer FROM questions WHERE id = $1', [questionId]);
  return res.rows[0]?.correct_answer;
}
