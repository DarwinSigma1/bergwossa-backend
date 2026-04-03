const Brew = require('../models/Brew');

class TemperatureService {
  /**
   * Process temperature update from ESP32 via MQTT
   */
  async processTemperatureUpdate(brewId, temperature) {
    try {
      // 1. Load brew
      const brew = await Brew.findById(brewId);
      
      if (!brew) {
        throw new Error(`Brew with ID ${brewId} not found`);
      }

      if (brew.isCompleted()) {
        console.log(`Brew ${brewId} is already completed. Ignoring temperature update.`);
        return {
          success: false,
          message: 'Brew is already completed'
        };
      }

      // 2. Load current step
      const currentStep = await brew.getCurrentStep();

      // 3. Update temperature in DB
      await brew.updateTemperature(temperature);
      
      console.log(`📊 Temperature update for Brew ${brewId}: ${temperature}°C (Step: ${currentStep.name})`);

      // 4. Check if step requires temperature
      if (!currentStep.requires_temperature) {
        console.log(`Step "${currentStep.name}" requires no temperature check`);
        return {
          success: true,
          temperature,
          step: currentStep.name,
          requires_temperature: false,
          temp_condition_met: true  // Always true if not required
        };
      }

      // 5. Check if temperature is in range
      const isInRange = currentStep.isTemperatureInRange(temperature);

      // 6. State machine: Update condition_met flag
      if (isInRange && !brew.temp_condition_met) {
        // Transition: FALSE → TRUE
        await brew.setTempConditionMet(true);
        console.log(`✓ Temperature condition met for Brew ${brewId} in Step "${currentStep.name}"`);
        
        return {
          success: true,
          temperature,
          step: currentStep.name,
          temp_condition_met: true,
          transition: 'FALSE_TO_TRUE',
          message: `Temperature condition met: ${temperature}°C is in range ${currentStep.temprange}°C`
        };
      } 
      else if (!isInRange && brew.temp_condition_met) {
        // Transition: TRUE → FALSE (Temperature dropped out of range)
        await brew.setTempConditionMet(false);
        console.log(`⚠ Temperature out of range for Brew ${brewId}. Condition reset.`);
        
        return {
          success: true,
          temperature,
          step: currentStep.name,
          temp_condition_met: false,
          transition: 'TRUE_TO_FALSE',
          message: `Temperature out of range: ${temperature}°C (Required: ${currentStep.temprange}°C)`
        };
      }
      
      // No state change
      return {
        success: true,
        temperature,
        step: currentStep.name,
        temp_condition_met: brew.temp_condition_met,
        in_range: isInRange,
        target_range: currentStep.temprange
      };

    } catch (error) {
      console.error('Error processing temperature update:', error);
      throw error;
    }
  }

  /**
   * Get temperature status for a brew
   */
  async getTemperatureStatus(brewId) {
    const brew = await Brew.findById(brewId);
    
    if (!brew) {
      throw new Error(`Brew with ID ${brewId} not found`);
    }

    const currentStep = await brew.getCurrentStep();

    return {
      brew_id: brew.brew_id,
      current_temperature: brew.currenttemp,
      last_update: brew.last_temp_update,
      step: currentStep.name,
      requires_temperature: currentStep.requires_temperature,
      temperature_range: currentStep.temprange,
      temp_condition_met: brew.temp_condition_met,
      in_range: currentStep.isTemperatureInRange(brew.currenttemp)
    };
  }
}

module.exports = TemperatureService;
