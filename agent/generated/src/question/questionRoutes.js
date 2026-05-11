const express = require('express');
const router = express.Router();
const questionService = require('./questionService');
const { requireAuth, requireAdmin } = require('../user/authMiddleware');

/**
 * GET /api/questions
 * Get all questions (admin only).
 */
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const questions = await questionService.getAllQuestions();
    res.json({ success: true, data: questions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/questions/:id
 * Get a single question by id (admin only).
 */
router.get('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await questionService.getQuestionById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    res.json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/questions
 * Create a new question (admin only).
 * Body: { prompt, options: [...], correct_answer, difficulty }
 */
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await questionService.createQuestion(req.body);
    res.status(201).json({ success: true, data: question });
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('must be')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * PUT /api/questions/:id
 * Update a question (admin only).
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await questionService.updateQuestion(req.params.id, req.body);
    res.json({ success: true, data: question });
  } catch (err) {
    if (err.message === 'Question not found') {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.message.includes('required') || err.message.includes('must be')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * DELETE /api/questions/:id
 * Delete a question (admin only).
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await questionService.deleteQuestion(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Question not found') {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
});

module.exports = router;
