const { query, queryOne } = require('../config/database');

class Step {
  constructor(data) {
    this.step_id = data.step_id;
    this.step_number = data.step_number;
    this.name = data.name;
    this.condition = data.condition;
    this.temprange = data.temprange;
    this.timer = data.timer;
    this.requires_temperature = Boolean(data.requires_temperature);
    this.requires_timer = Boolean(data.requires_timer);
  }

  /**
   * Find step by ID
   */
  static async findById(stepId) {
    const sql = 'SELECT * FROM step WHERE step_id = $1';
    const row = await queryOne(sql, [stepId]);
    return row ? new Step(row) : null;
  }

  /**
   * Find step by step number
   */
  static async findByNumber(stepNumber) {
    const sql = 'SELECT * FROM step WHERE step_number = $1';
    const row = await queryOne(sql, [stepNumber]);
    return row ? new Step(row) : null;
  }

  /**
   * Get all steps (ordered by step_number)
   */
  static async findAll() {
    const sql = 'SELECT * FROM step ORDER BY step_number ASC';
    const rows = await query(sql);
    return rows.map(row => new Step(row));
  }

  /**
   * Get next step in sequence
   */
  async getNextStep() {
    const sql = `
      SELECT * FROM step 
      WHERE step_number > $1 
      ORDER BY step_number ASC 
      LIMIT 1
    `;
    const row = await queryOne(sql, [this.step_number]);
    return row ? new Step(row) : null;
  }

  /**
   * Check if temperature is in range
   */
  isTemperatureInRange(temperature) {
    if (!this.requires_temperature || !this.temprange) {
      return true;  // No temp requirement = always OK
    }

    // Parse temprange (e.g., "65-69")
    const [min, max] = this.temprange.split('-').map(Number);
    
    return temperature >= min && temperature <= max;
  }

  /**
   * Get temperature range info as object
   */
  getTemperatureInfo() {
    if (!this.temprange) return null;
    
    const [min, max] = this.temprange.split('-').map(Number);
    return {
      min,
      max,
      range: this.temprange,
      target: (min + max) / 2
    };
  }

  /**
   * Get timer duration in different units
   */
  getTimerInfo() {
    if (!this.timer) return null;
    
    const seconds = this.timer;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return {
      seconds,
      minutes,
      hours,
      days,
      formatted: this.formatDuration(seconds)
    };
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Convert to JSON (for API responses)
   */
  toJSON() {
    return {
      step_id: this.step_id,
      step_number: this.step_number,
      name: this.name,
      condition: this.condition,
      temprange: this.temprange,
      timer: this.timer,
      requires_temperature: this.requires_temperature,
      requires_timer: this.requires_timer,
      temperature_info: this.getTemperatureInfo(),
      timer_info: this.getTimerInfo()
    };
  }
}

module.exports = Step;
