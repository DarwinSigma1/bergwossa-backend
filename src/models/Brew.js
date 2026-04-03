const { query, queryOne, run } = require('../config/database');
const Step = require('./Step');

class Brew {
  constructor(data) {
    this.brew_id = data.brew_id;
    this.user_id = data.user_id;
    this.step_id = data.step_id;
    this.name = data.name;
    this.start_date = data.start_date;
    this.end_date = data.end_date;
    this.step_started_at = data.step_started_at;
    this.currenttemp = data.currenttemp;
    this.last_temp_update = data.last_temp_update;
    this.temp_condition_met = Boolean(data.temp_condition_met);
  }

  /**
   * Find brew by ID
   */
  static async findById(brewId) {
    const sql = 'SELECT * FROM brew WHERE brew_id = $1';
    const row = await queryOne(sql, [brewId]);
    return row ? new Brew(row) : null;
  }

  /**
   * Find all brews for a user
   */
  static async findByUserId(userId) {
    const sql = `
      SELECT * FROM brew 
      WHERE user_id = $1 
      ORDER BY start_date DESC
    `;
    const rows = await query(sql, [userId]);
    return rows.map(row => new Brew(row));
  }

  /**
   * Find active brews for a user (not completed)
   */
  static async findActiveByUser(userId) {
    const sql = `
      SELECT * FROM brew 
      WHERE user_id = $1 AND end_date IS NULL 
      ORDER BY start_date DESC
    `;
    const rows = await query(sql, [userId]);
    return rows.map(row => new Brew(row));
  }

  /**
   * Create new brew
   */
  static async create(brewData) {
    // Get first step
    const firstStep = await Step.findByNumber(1);
    
    const sql = `
      INSERT INTO brew (
        user_id, 
        step_id, 
        name, 
        start_date, 
        step_started_at,
        temp_condition_met
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4)
      RETURNING brew_id
    `;
    
    const result = await run(sql, [
      brewData.user_id,
      firstStep.step_id,
      brewData.name || 'Unbenannter Brew',
      !firstStep.requires_temperature  // TRUE wenn keine Temp benötigt
    ]);

    return await Brew.findById(result.rows[0].brew_id);
  }

  /**
   * Update temperature
   */
  async updateTemperature(temperature) {
    const sql = `
      UPDATE brew 
      SET currenttemp = $1, 
          last_temp_update = CURRENT_TIMESTAMP
      WHERE brew_id = $2
    `;
    
    await run(sql, [temperature, this.brew_id]);
    this.currenttemp = temperature;
    this.last_temp_update = new Date();
  }

  /**
   * Set temperature condition status
   */
  async setTempConditionMet(met) {
    const sql = `
      UPDATE brew 
      SET temp_condition_met = $1
      WHERE brew_id = $2
    `;
    
    await run(sql, [met, this.brew_id]);
    this.temp_condition_met = met;
  }

  /**
   * Get current step details
   */
  async getCurrentStep() {
    return await Step.findById(this.step_id);
  }

  /**
   * Advance to next step
   */
  async advanceToNextStep() {
    const currentStep = await this.getCurrentStep();
    const nextStep = await currentStep.getNextStep();
    
    if (!nextStep) {
      throw new Error('Already at last step');
    }

    const sql = `
      UPDATE brew 
      SET step_id = $1, 
          step_started_at = CURRENT_TIMESTAMP,
          temp_condition_met = $2
      WHERE brew_id = $3
    `;
    
    // temp_condition_met = TRUE wenn nächster Step keine Temp braucht
    await run(sql, [
      nextStep.step_id, 
      !nextStep.requires_temperature,
      this.brew_id
    ]);
    
    this.step_id = nextStep.step_id;
    this.step_started_at = new Date();
    this.temp_condition_met = !nextStep.requires_temperature;
    
    return nextStep;
  }

  /**
   * Complete brew (mark as finished)
   */
  async complete() {
    const sql = `
      UPDATE brew 
      SET end_date = CURRENT_TIMESTAMP
      WHERE brew_id = $1
    `;
    
    await run(sql, [this.brew_id]);
    this.end_date = new Date();
  }

  /**
   * Check if brew is completed
   */
  isCompleted() {
    return this.end_date !== null;
  }

  /**
   * Get brew duration in days
   */
  getDuration() {
    if (!this.end_date) return null;
    
    const start = new Date(this.start_date);
    const end = new Date(this.end_date);
    const diffMs = end - start;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    return Math.round(diffDays * 10) / 10;  // Round to 1 decimal
  }

  /**
   * Convert to JSON (for API responses)
   */
  toJSON() {
    return {
      brew_id: this.brew_id,
      user_id: this.user_id,
      step_id: this.step_id,
      name: this.name,
      start_date: this.start_date,
      end_date: this.end_date,
      step_started_at: this.step_started_at,
      currenttemp: this.currenttemp,
      last_temp_update: this.last_temp_update,
      temp_condition_met: this.temp_condition_met,
      is_completed: this.isCompleted(),
      duration_days: this.getDuration()
    };
  }
}

module.exports = Brew;
