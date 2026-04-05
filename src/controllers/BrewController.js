const BrewService = require('../services/BrewService');

class BrewController {
  constructor() {
    this.brewService = new BrewService();
  }

  /**
   * GET /api/brews
   * Get all brews for current user
   */
  async getAllBrews(req, res) {
    try {
      const userId = req.user_id;
      const activeOnly = req.query.active === 'true';

      const brews = await this.brewService.getUserBrews(userId, activeOnly);

      res.json({
        success: true,
        count: brews.length,
        data: brews
      });

    } catch (error) {
      console.error('Error in getAllBrews:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/brews/:id
   * Get brew details by ID
   */
  async getBrewById(req, res) {
    try {
      const brewId = parseInt(req.params.id);
      const userId = req.user_id;

      const brew = await this.brewService.getBrewDetails(brewId);

      // Verify ownership
      if (brew.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Not your brew'
        });
      }

      res.json({
        success: true,
        data: brew
      });

    } catch (error) {
      console.error('Error in getBrewById:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/brews
   * Create new brew
   */
  async createBrew(req, res) {
    try {
      const userId = req.user_id;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Brew name is required'
        });
      }

      const brew = await this.brewService.createBrew(userId, { name });

      res.status(201).json({
        success: true,
        data: brew,
        message: 'Brew created successfully'
      });

    } catch (error) {
      console.error('Error in createBrew:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * PUT /api/brews/:id/advance
   * Advance brew to next step
   */
  async advanceStep(req, res) {
    try {
      const brewId = parseInt(req.params.id);
      const userId = req.user_id;

      const result = await this.brewService.advanceToNextStep(brewId, userId);

      // Publish target temperature to ESP32 if new step requires it
      const temprange = result.new_step.temprange;
      if (temprange) {
        const [low, high] = temprange.split('-').map(Number);
        const midpoint = (low + high) / 2;
        const mqttHandler = req.app.get('mqttHandler');
        console.log(`[MQTT] mqttHandler present: ${!!mqttHandler}, temprange: ${temprange}, midpoint: ${midpoint}`);
        mqttHandler.publishCommand(brewId, { action: 'set_temperature', value: midpoint });
      } else {
        console.log(`[MQTT] New step has no temprange, skipping publish`);
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in advanceStep:', error);

      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('Cannot advance')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/brews/:id/set-temperature
   * Send temperature command to ESP32
   */
  async setTargetTemperature(req, res) {
    try {
      const brewId = parseInt(req.params.id);
      const { temperature } = req.body;

      if (typeof temperature !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Invalid temperature value'
        });
      }

      // Get MQTT handler from app
      const mqttHandler = req.app.get('mqttHandler');
      
      // Send command to ESP32
      mqttHandler.publishCommand(brewId, {
        action: 'set_temperature',
        value: temperature
      });

      res.json({
        success: true,
        message: `Temperature command sent to Brew ${brewId}`,
        temperature
      });

    } catch (error) {
      console.error('Error in setTargetTemperature:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * PUT /api/brews/:id/complete
   * Mark brew as completed
   */
  async completeBrew(req, res) {
    try {
      const brewId = parseInt(req.params.id);
      const userId = req.user_id;

      const result = await this.brewService.completeBrew(brewId, userId);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in completeBrew:', error);

      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = BrewController;
