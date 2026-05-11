const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// In-memory game state cache (in production, use Redis)
const gameCache = new Map();

/**
 * Start a new game for a user.
 * @param {number} userId - The user's ID
 * @returns {Promise<object>} Game object with id and initial state
 */
async function startGame(userId) {
  const gameId = uuidv4();

  // Fetch a set of random questions for the game
  const questionsResult = await db.query(
    'SELECT id, prompt, options, difficulty FROM questions ORDER BY RANDOM() LIMIT 10'
  );
  const questions = questionsResult.rows;

  if (questions.length === 0) {
    throw new Error('No questions available. Please seed the database first.');
  }

  const gameState = {
    currentQuestionIndex: 0,
    score: 0,
    totalQuestions: questions.length,
    questions: questions.map(q => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      difficulty: q.difficulty,
    })),
    answers: [],
    status: 'playing', // playing, paused, gameover
    startedAt: new Date().toISOString(),
  };

  // Persist game to database
  await db.query(
    'INSERT INTO games (id, user_id, game_state) VALUES ($1, $2, $3)',
    [gameId, userId, JSON.stringify(gameState)]
  );

  // Cache in memory
  gameCache.set(gameId, gameState);

  return {
    gameId,
    currentQuestion: gameState.questions[0] || null,
    totalQuestions: gameState.totalQuestions,
    currentQuestionIndex: 0,
    score: 0,
    status: 'playing',
  };
}

/**
 * Submit an answer for the current question.
 * @param {string} gameId - The game ID
 * @param {number} questionId - The question ID being answered
 * @param {string} answer - The user's answer
 * @returns {Promise<object>} Result with correctness, updated score, next question
 */
async function submitAnswer(gameId, questionId, answer) {
  // Try cache first
  let gameState = gameCache.get(gameId);

  if (!gameState) {
    // Load from database
    const result = await db.query(
      'SELECT game_state FROM games WHERE id = $1',
      [gameId]
    );
    if (result.rows.length === 0) {
      throw new Error('Game not found');
    }
    gameState = result.rows[0].game_state;
    gameCache.set(gameId, gameState);
  }

  if (gameState.status === 'gameover') {
    throw new Error('Game is already over');
  }

  if (gameState.status === 'paused') {
    throw new Error('Game is paused. Resume to continue.');
  }

  const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
  if (!currentQuestion || currentQuestion.id !== questionId) {
    throw new Error('Invalid question for current game state');
  }

  // Check answer against database
  const questionResult = await db.query(
    'SELECT correct_answer FROM questions WHERE id = $1',
    [questionId]
  );
  if (questionResult.rows.length === 0) {
    throw new Error('Question not found');
  }

  const correctAnswer = questionResult.rows[0].correct_answer;
  const isCorrect = answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

  // Calculate points based on difficulty
  let points = 0;
  if (isCorrect) {
    const difficulty = currentQuestion.difficulty || 1;
    points = difficulty * 10;
  }

  // Record answer
  gameState.answers.push({
    questionId,
    userAnswer: answer,
    correctAnswer,
    isCorrect,
    points,
    timestamp: new Date().toISOString(),
  });

  if (isCorrect) {
    gameState.score += points;
  }

  // Move to next question or end game
  gameState.currentQuestionIndex += 1;

  if (gameState.currentQuestionIndex >= gameState.totalQuestions) {
    gameState.status = 'gameover';
    gameState.endedAt = new Date().toISOString();
  }

  // Update database
  await db.query(
    'UPDATE games SET game_state = $1 WHERE id = $2',
    [JSON.stringify(gameState), gameId]
  );

  // Update cache
  gameCache.set(gameId, gameState);

  const nextQuestion = gameState.status !== 'gameover'
    ? gameState.questions[gameState.currentQuestionIndex] || null
    : null;

  return {
    isCorrect,
    correctAnswer,
    pointsEarned: points,
    currentScore: gameState.score,
    totalQuestions: gameState.totalQuestions,
    currentQuestionIndex: gameState.currentQuestionIndex,
    nextQuestion,
    status: gameState.status,
  };
}

/**
 * Get the current score and game status.
 * @param {string} gameId - The game ID
 * @returns {Promise<object>} Score and game info
 */
async function getScore(gameId) {
  let gameState = gameCache.get(gameId);

  if (!gameState) {
    const result = await db.query(
      'SELECT game_state FROM games WHERE id = $1',
      [gameId]
    );
    if (result.rows.length === 0) {
      throw new Error('Game not found');
    }
    gameState = result.rows[0].game_state;
  }

  const correctAnswers = gameState.answers.filter(a => a.isCorrect).length;

  return {
    gameId,
    score: gameState.score,
    totalQuestions: gameState.totalQuestions,
    answeredQuestions: gameState.answers.length,
    correctAnswers,
    incorrectAnswers: gameState.answers.length - correctAnswers,
    status: gameState.status,
    currentQuestionIndex: gameState.currentQuestionIndex,
    startedAt: gameState.startedAt,
    endedAt: gameState.endedAt || null,
  };
}

/**
 * Get current question for a game.
 * @param {string} gameId
 * @returns {Promise<object|null>}
 */
async function getCurrentQuestion(gameId) {
  let gameState = gameCache.get(gameId);

  if (!gameState) {
    const result = await db.query(
      'SELECT game_state FROM games WHERE id = $1',
      [gameId]
    );
    if (result.rows.length === 0) {
      throw new Error('Game not found');
    }
    gameState = result.rows[0].game_state;
    gameCache.set(gameId, gameState);
  }

  if (gameState.status === 'gameover') {
    return null;
  }
  return gameState.questions[gameState.currentQuestionIndex] || null;
}

/**
 * Pause the game.
 * @param {string} gameId - The game ID
 * @returns {Promise<object>} Updated game state
 */
async function pauseGame(gameId) {
  let gameState = gameCache.get(gameId);

  if (!gameState) {
    const result = await db.query(
      'SELECT game_state FROM games WHERE id = $1',
      [gameId]
    );
    if (result.rows.length === 0) {
      throw new Error('Game not found');
    }
    gameState = result.rows[0].game_state;
  }

  if (gameState.status === 'gameover') {
    throw new Error('Cannot pause a finished game');
  }

  gameState.status = 'paused';
  gameState.pausedAt = new Date().toISOString();

  await db.query(
    'UPDATE games SET game_state = $1 WHERE id = $2',
    [JSON.stringify(gameState), gameId]
  );
  gameCache.set(gameId, gameState);

  return { gameId, status: 'paused', pausedAt: gameState.pausedAt };
}

/**
 * Resume the game.
 * @param {string} gameId - The game ID
 * @returns {Promise<object>} Updated game state with current question
 */
async function resumeGame(gameId) {
  let gameState = gameCache.get(gameId);

  if (!gameState) {
    const result = await db.query(
      'SELECT game_state FROM games WHERE id = $1',
      [gameId]
    );
    if (result.rows.length === 0) {
      throw new Error('Game not found');
    }
    gameState = result.rows[0].game_state;
  }

  if (gameState.status !== 'paused') {
    throw new Error('Game is not paused');
  }

  gameState.status = 'playing';
  gameState.resumedAt = new Date().toISOString();

  await db.query(
    'UPDATE games SET game_state = $1 WHERE id = $2',
    [JSON.stringify(gameState), gameId]
  );
  gameCache.set(gameId, gameState);

  const currentQuestion = gameState.questions[gameState.currentQuestionIndex] || null;

  return {
    gameId,
    status: 'playing',
    currentQuestion,
    currentQuestionIndex: gameState.currentQuestionIndex,
    totalQuestions: gameState.totalQuestions,
    score: gameState.score,
  };
}

module.exports = {
  startGame,
  submitAnswer,
  getScore,
  getCurrentQuestion,
  pauseGame,
  resumeGame,
};
