require('dotenv').config();
const { pool } = require('../src/config/database');

/**
 * Database Setup Script
 * 
 * Run with: node database/setup.js
 * 
 * This creates tables and inserts sample step data
 */

async function setupDatabase() {
  try {
    console.log('\n🔧 Setting up database...\n');

    // Create tables
    console.log('Creating tables...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS step (
        step_id SERIAL PRIMARY KEY,
        step_number INTEGER UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        condition TEXT,
        temprange VARCHAR(50),
        timer INTEGER,
        requires_temperature BOOLEAN DEFAULT FALSE,
        requires_timer BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ step table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS brew (
        brew_id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        step_id INTEGER NOT NULL,
        name VARCHAR(255),
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP,
        step_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        currenttemp DECIMAL(5,2),
        last_temp_update TIMESTAMP,
        temp_condition_met BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (step_id) REFERENCES step(step_id)
      );
    `);
    console.log('✓ brew table created');

    // Create indexes
    console.log('\nCreating indexes...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_brew_user_id ON brew(user_id);
      CREATE INDEX IF NOT EXISTS idx_brew_completion ON brew(end_date);
      CREATE INDEX IF NOT EXISTS idx_brew_current_step ON brew(step_id);
      CREATE INDEX IF NOT EXISTS idx_brew_condition ON brew(temp_condition_met);
    `);
    console.log('✓ Indexes created');

    // Insert sample steps
    console.log('\nInserting step data...');
    
    // Check if steps already exist
    const existingSteps = await pool.query('SELECT COUNT(*) FROM step');
    
    if (parseInt(existingSteps.rows[0].count) > 0) {
      console.log('⚠ Steps already exist, skipping insert');
    } else {
      await pool.query(`
        INSERT INTO step (step_number, name, condition, temprange, timer, requires_temperature, requires_timer) VALUES
        (1, 'Maischen', 'Maische bei konstanter Temperatur halten und regelmäßig rühren', '65-69', 3600, TRUE, TRUE),
        (2, 'Läutern', 'Würze langsam ablaufen lassen, Treber zurückhalten', '76-80', NULL, TRUE, FALSE),
        (3, 'Würzekochen', 'Würze kräftig kochen, Hopfen nach Plan zugeben', '98-102', 3600, TRUE, TRUE),
        (4, 'Whirlpool', 'Würze rotieren lassen, Trub in der Mitte absetzen', NULL, 900, FALSE, TRUE),
        (5, 'Kühlung', 'Würze schnell auf Gärtemperatur kühlen', '18-22', NULL, TRUE, FALSE),
        (6, 'Hauptgärung', 'Hefe arbeiten lassen, Spundung beachten', '18-22', 604800, TRUE, TRUE),
        (7, 'Nachgärung', 'Bier reifen lassen in Flaschen oder Fass', NULL, 1209600, FALSE, TRUE),
        (8, 'Karbonisierung', 'Zucker zugeben, Kohlensäure entwickeln lassen', NULL, 604800, FALSE, TRUE),
        (9, 'Abfüllung', 'Bier in Flaschen abfüllen und verschließen', NULL, NULL, FALSE, FALSE);
      `);
      
      console.log('✓ 9 brewing steps inserted');
      console.log('  1. Maischen (65-69°C, 60 min)');
      console.log('  2. Läutern (76-80°C)');
      console.log('  3. Würzekochen (98-102°C, 60 min)');
      console.log('  4. Whirlpool (15 min)');
      console.log('  5. Kühlung (18-22°C)');
      console.log('  6. Hauptgärung (18-22°C, 7 days)');
      console.log('  7. Nachgärung (14 days)');
      console.log('  8. Karbonisierung (7 days)');
      console.log('  9. Abfüllung');
    }

    console.log('\n✅ Database setup complete!\n');

  } catch (error) {
    console.error('\n❌ Error setting up database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run setup
setupDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
