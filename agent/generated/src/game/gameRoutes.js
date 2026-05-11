const express = require('express');
const router = express.Router();
const gameService = require('./gameService');
const { requireAuth } = require('../user/authMiddleware');

/**
 * POST /api/game/start
 * Start a new game for the authenticated user.
 */
router.post('/start', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const game = await gameService.startGame(userId);
    res.status(201).json({ success: true, data: game });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/game/answer
 * Submit an answer for the current question.
 * Body: { gameId, questionId, answer }
 */
router.post('/answer', requireAuth, async (req, res, next) => {
  try {
    const { gameId, questionId, answer } = req.body;

    if (!gameId || !questionId || answer === undefined) {
      return res.status(400).json({
        success: false,
        error: 'gameId, questionId, and answer are required',
      });
    }

    const result = await gameService.submitAnswer(gameId, questionId, answer);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('Invalid')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/game/:gameId/answer
 * Compatibility endpoint for frontend that sends gameId in URL.
 * Body: { answer }
 */
router.post('/:gameId/answer', requireAuth, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const { answer } = req.body;

    if (answer === undefined || answer === null) {
      return res.status(400).json({ success: false, error: 'answer is required' });
    }

    const currentQuestion = await gameService.getCurrentQuestion(gameId);

    if (!currentQuestion) {
      return res.status(400).json({ success: false, error: 'No active question' });
    }

    const result = await gameService.submitAnswer(gameId, currentQuestion.id, String(answer));
    res.json({
      success: true,
      data: {
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        score: result.currentScore,
        finished: result.status === 'gameover',
        nextQuestion: result.nextQuestion,
        answeredQuestions: result.currentQuestionIndex,
      },
    });
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('Invalid')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/game/score/:gameId
 * Get the current score and game status.
 */
router.get('/score/:gameId', requireAuth, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const score = await gameService.getScore(gameId);
    res.json({ success: true, data: score });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/game/:gameId/score
 * Compatibility endpoint for frontend that expects gameId before /score.
 */
router.get('/:gameId/score', requireAuth, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const score = await gameService.getScore(gameId);
    res.json({
      success: true,
      data: {
        gameId: score.gameId,
        score: score.score,
        total: score.totalQuestions,
        currentIndex: score.currentQuestionIndex,
        answeredCount: score.answeredQuestions,
        correctCount: score.correctAnswers,
        state: score.status,
      },
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/game/pause/:gameId
 * Pause the current game.
 */
router.post('/pause/:gameId', requireAuth, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const result = await gameService.pauseGame(gameId);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/game/resume/:gameId
 * Resume a paused game.
 */
router.post('/resume/:gameId', requireAuth, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const result = await gameService.resumeGame(gameId);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not paused')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

module.exports = router;
