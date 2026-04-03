const express = require('express');
const BrewController = require('../controllers/BrewController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const brewController = new BrewController();

// All routes require authentication
router.use(authMiddleware);

// GET /api/brews - Get all brews for user
router.get('/', (req, res) => brewController.getAllBrews(req, res));

// GET /api/brews/:id - Get brew details
router.get('/:id', (req, res) => brewController.getBrewById(req, res));

// POST /api/brews - Create new brew
router.post('/', (req, res) => brewController.createBrew(req, res));

// PUT /api/brews/:id/advance - Advance to next step
router.put('/:id/advance', (req, res) => brewController.advanceStep(req, res));

// POST /api/brews/:id/set-temperature - Send temperature command to ESP32
router.post('/:id/set-temperature', (req, res) => brewController.setTargetTemperature(req, res));

// PUT /api/brews/:id/complete - Mark brew as completed
router.put('/:id/complete', (req, res) => brewController.completeBrew(req, res));

module.exports = router;
