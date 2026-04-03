const express = require('express');
const StepController = require('../controllers/StepController');

const router = express.Router();
const stepController = new StepController();

// GET /api/steps - Get all steps
router.get('/', (req, res) => stepController.getAllSteps(req, res));

// GET /api/steps/:id - Get step by ID
router.get('/:id', (req, res) => stepController.getStepById(req, res));

module.exports = router;
