const Brew = require('../models/Brew');
const Step = require('../models/Step');

class BrewService {
  /**
   * Get brew with full details (including step info)
   */
  async getBrewDetails(brewId) {
    const brew = await Brew.findById(brewId);
    
    if (!brew) {
      throw new Error(`Brew with ID ${brewId} not found`);
    }

    const currentStep = await brew.getCurrentStep();

    return {
      ...brew.toJSON(),
      current_step: currentStep.toJSON()
    };
  }

  /**
   * Advance brew to next step
   */
  async advanceToNextStep(brewId, userId) {
    const brew = await Brew.findById(brewId);
    
    if (!brew) {
      throw new Error('Brew not found');
    }

    // Verify ownership
    if (brew.user_id !== userId) {
      throw new Error('Unauthorized: Not your brew');
    }

    // Check if brew is completed
    if (brew.isCompleted()) {
      throw new Error('Brew is already completed');
    }

    const currentStep = await brew.getCurrentStep();
    
    // Validate that conditions are met
    const conditions = await this.checkConditions(brew, currentStep);
    
    if (!conditions.canAdvance) {
      const reasons = [];
      if (!conditions.tempOK) reasons.push('Temperature condition not met');
      if (!conditions.timerOK) reasons.push('Timer not complete');
      
      throw new Error(`Cannot advance: ${reasons.join(', ')}`);
    }

    // Advance to next step
    const nextStep = await brew.advanceToNextStep();

    console.log(`✓ Brew ${brewId} advanced from "${currentStep.name}" to "${nextStep.name}"`);

    return {
      success: true,
      old_step: currentStep.toJSON(),
      new_step: nextStep.toJSON(),
      message: `Advanced to step ${nextStep.step_number}: ${nextStep.name}`
    };
  }

  /**
   * Check if all conditions for current step are met
   */
  async checkConditions(brew, step) {
    // 1. Temperature condition
    let tempOK = true;
    if (step.requires_temperature) {
      tempOK = brew.temp_condition_met;
    }

    // 2. Timer condition (calculated on frontend, but we can check here too)
    let timerOK = true;
    if (step.requires_timer) {
      const elapsedMs = Date.now() - new Date(brew.step_started_at).getTime();
      const elapsedSeconds = elapsedMs / 1000;
      timerOK = elapsedSeconds >= step.timer;
    }

    return {
      tempOK,
      timerOK,
      canAdvance: tempOK && timerOK
    };
  }

  /**
   * Create new brew
   */
  async createBrew(userId, brewData) {
    const brew = await Brew.create({
      user_id: userId,
      name: brewData.name
    });

    const currentStep = await brew.getCurrentStep();

    console.log(`✓ New brew created: ${brew.name} (ID: ${brew.brew_id}) for user ${userId}`);

    return {
      ...brew.toJSON(),
      current_step: currentStep.toJSON()
    };
  }

  /**
   * Complete brew (mark as finished)
   */
  async completeBrew(brewId, userId) {
    const brew = await Brew.findById(brewId);
    
    if (!brew) {
      throw new Error('Brew not found');
    }

    if (brew.user_id !== userId) {
      throw new Error('Unauthorized: Not your brew');
    }

    if (brew.isCompleted()) {
      throw new Error('Brew is already completed');
    }

    await brew.complete();

    console.log(`✓ Brew ${brewId} completed after ${brew.getDuration()} days`);

    return {
      success: true,
      brew_id: brew.brew_id,
      duration_days: brew.getDuration(),
      message: `Brew "${brew.name}" completed successfully`
    };
  }

  /**
   * Get all brews for a user
   */
  async getUserBrews(userId, activeOnly = false) {
    const brews = activeOnly 
      ? await Brew.findActiveByUser(userId)
      : await Brew.findByUserId(userId);

    // Enrich with step info
    const enrichedBrews = await Promise.all(
      brews.map(async (brew) => {
        const currentStep = await brew.getCurrentStep();
        return {
          ...brew.toJSON(),
          current_step: {
            step_id: currentStep.step_id,
            name: currentStep.name,
            step_number: currentStep.step_number
          }
        };
      })
    );

    return enrichedBrews;
  }
}

module.exports = BrewService;
