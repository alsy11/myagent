const db = require('../db');

/**
 * Get all questions.
 * @param {object} filters - Optional filters (difficulty, limit)
 * @returns {Promise<Array>} List of questions
 */
async function getAllQuestions(filters = {}) {
  let queryText = 'SELECT id, prompt, options, correct_answer, difficulty, created_at FROM questions';
  const params = [];
  const conditions = [];

  if (filters.difficulty) {
    conditions.push(`difficulty = $${params.length + 1}`);
    params.push(parseInt(filters.difficulty, 10));
  }

  if (conditions.length > 0) {
    queryText += ' WHERE ' + conditions.join(' AND ');
  }

  queryText += ' ORDER BY difficulty ASC, id ASC';

  if (filters.limit) {
    queryText += ` LIMIT $${params.length + 1}`;
    params.push(parseInt(filters.limit, 10));
  }

  const result = await db.query(queryText, params);
  return result.rows;
}

/**
 * Get a single question by ID.
 * @param {number} id - Question ID
 * @returns {Promise<object|null>} Question object or null
 */
async function getQuestionById(id) {
  const result = await db.query(
    'SELECT id, prompt, options, correct_answer, difficulty, created_at FROM questions WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a new question.
 * @param {object} questionData - { prompt, options, correct_answer, difficulty }
 * @returns {Promise<object>} Created question
 */
async function createQuestion(questionData) {
  const { prompt, options, correct_answer, difficulty } = questionData;

  // Validate
  if (!prompt || !options || !correct_answer) {
    throw new Error('prompt, options, and correct_answer are required');
  }

  if (!Array.isArray(options) || options.length < 2) {
    throw new Error('options must be an array with at least 2 choices');
  }

  if (!options.includes(correct_answer)) {
    throw new Error('correct_answer must be one of the options');
  }

  const diff = difficulty || 1;
  if (diff < 1 || diff > 5) {
    throw new Error('difficulty must be between 1 and 5');
  }

  const result = await db.query(
    'INSERT INTO questions (prompt, options, correct_answer, difficulty) VALUES ($1, $2, $3, $4) RETURNING id, prompt, options, correct_answer, difficulty, created_at',
    [prompt, JSON.stringify(options), correct_answer, diff]
  );

  return result.rows[0];
}

/**
 * Update an existing question.
 * @param {number} id - Question ID
 * @param {object} questionData - Fields to update
 * @returns {Promise<object|null>} Updated question or null
 */
async function updateQuestion(id, questionData) {
  const existing = await getQuestionById(id);
  if (!existing) {
    return null;
  }

  const { prompt, options, correct_answer, difficulty } = questionData;

  const updatedPrompt = prompt !== undefined ? prompt : existing.prompt;
  const updatedOptions = options !== undefined ? options : existing.options;
  const updatedCorrectAnswer = correct_answer !== undefined ? correct_answer : existing.correct_answer;
  const updatedDifficulty = difficulty !== undefined ? difficulty : existing.difficulty;

  // Validate if options or correct_answer changed
  if (options && (!Array.isArray(options) || options.length < 2)) {
    throw new Error('options must be an array with at least 2 choices');
  }

  if (correct_answer && options && !options.includes(correct_answer)) {
    throw new Error('correct_answer must be one of the options');
  }

  if (difficulty !== undefined && (difficulty < 1 || difficulty > 5)) {
    throw new Error('difficulty must be between 1 and 5');
  }

  const result = await db.query(
    'UPDATE questions SET prompt = $1, options = $2, correct_answer = $3, difficulty = $4 WHERE id = $5 RETURNING id, prompt, options, correct_answer, difficulty, created_at',
    [
      updatedPrompt,
      JSON.stringify(updatedOptions),
      updatedCorrectAnswer,
      updatedDifficulty,
      id,
    ]
  );

  return result.rows[0];
}

/**
 * Delete a question.
 * @param {number} id - Question ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteQuestion(id) {
  const result = await db.query(
    'DELETE FROM questions WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rowCount > 0;
}

/**
 * Validate a batch of questions for seeding.
 * @param {Array} questions - Array of question objects
 * @returns {object} { valid: Array, errors: Array }
 */
function validateSeedQuestions(questions) {
  const valid = [];
  const errors = [];

  questions.forEach((q, index) => {
    const issues = [];

    if (!q.prompt || typeof q.prompt !== 'string') {
      issues.push('prompt is required and must be a string');
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      issues.push('options must be an array with at least 2 choices');
    }

    if (!q.correct_answer) {
      issues.push('correct_answer is required');
    } else if (Array.isArray(q.options) && !q.options.includes(q.correct_answer)) {
      issues.push('correct_answer must be one of the options');
    }

    if (q.difficulty !== undefined && (q.difficulty < 1 || q.difficulty > 5)) {
      issues.push('difficulty must be between 1 and 5');
    }

    if (issues.length > 0) {
      errors.push({ index, prompt: q.prompt, issues });
    } else {
      valid.push({
        prompt: q.prompt,
        options: q.options,
        correct_answer: q.correct_answer,
        difficulty: q.difficulty || 1,
      });
    }
  });

  return { valid, errors };
}

module.exports = {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  validateSeedQuestions,
};
