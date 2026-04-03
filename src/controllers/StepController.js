const Step = require('../models/Step');

class StepController {
  /**
   * GET /api/steps
   * Get all steps
   */
  async getAllSteps(req, res) {
    try {
      const steps = await Step.findAll();

      res.json({
        success: true,
        count: steps.length,
        data: steps.map(step => step.toJSON())
      });

    } catch (error) {
      console.error('Error in getAllSteps:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/steps/:id
   * Get step by ID
   */
  async getStepById(req, res) {
    try {
      const stepId = parseInt(req.params.id);
      const step = await Step.findById(stepId);

      if (!step) {
        return res.status(404).json({
          success: false,
          error: 'Step not found'
        });
      }

      res.json({
        success: true,
        data: step.toJSON()
      });

    } catch (error) {
      console.error('Error in getStepById:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = StepController;
