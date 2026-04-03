const TemperatureService = require('../services/TemperatureService');

class MQTTHandler {
  constructor(mqttClient, io) {
    this.mqttClient = mqttClient;
    this.io = io;  // Socket.IO instance
    this.temperatureService = new TemperatureService();
    
    this.setupHandlers();
  }

  /**
   * Setup MQTT message handlers
   */
  setupHandlers() {
    this.mqttClient.on('message', async (topic, message) => {
      try {
        await this.handleMessage(topic, message);
      } catch (error) {
        console.error('Error handling MQTT message:', error);
      }
    });
  }

  /**
   * Handle incoming MQTT message
   */
  async handleMessage(topic, message) {
    console.log(`📨 MQTT received: ${topic}`);

    // Parse topic: brew/{brew_id}/temperature
    if (topic.match(/^brew\/\d+\/temperature$/)) {
      await this.handleTemperatureUpdate(topic, message);
    }
    else {
      console.log(`Unknown topic: ${topic}`);
    }
  }

  /**
   * Handle temperature update from ESP32
   */
  async handleTemperatureUpdate(topic, message) {
    try {
      // Extract brew_id from topic: brew/42/temperature
      const brewId = this.extractBrewId(topic);
      
      // Parse message
      const data = JSON.parse(message.toString());
      const temperature = data.temperature;

      if (typeof temperature !== 'number') {
        console.error('Invalid temperature value:', temperature);
        return;
      }

      console.log(`Temperature update for Brew ${brewId}: ${temperature}°C`);

      // Process temperature update
      const result = await this.temperatureService.processTemperatureUpdate(brewId, temperature);

      // Broadcast to frontend via Socket.IO
      this.broadcastTemperatureUpdate(brewId, result);

      // If condition just became met, send special notification
      if (result.transition === 'FALSE_TO_TRUE') {
        this.broadcastConditionMet(brewId, result);
      }

    } catch (error) {
      console.error('Error processing temperature update:', error);
    }
  }

  /**
   * Broadcast temperature update to frontend via Socket.IO
   */
  broadcastTemperatureUpdate(brewId, result) {
    this.io.to(`brew:${brewId}`).emit('temperature_update', {
      brew_id: brewId,
      temperature: result.temperature,
      temp_condition_met: result.temp_condition_met,
      in_range: result.in_range,
      step: result.step,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast condition met notification
   */
  broadcastConditionMet(brewId, result) {
    this.io.to(`brew:${brewId}`).emit('condition_met', {
      brew_id: brewId,
      type: 'TEMPERATURE',
      step: result.step,
      message: result.message,
      timestamp: new Date().toISOString()
    });

    console.log(`📤 Condition met notification sent for Brew ${brewId}`);
  }

  /**
   * Extract brew ID from topic
   */
  extractBrewId(topic) {
    const match = topic.match(/brew\/(\d+)\//);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Publish command to ESP32
   */
  publishCommand(brewId, command) {
    const topic = `brew/${brewId}/command`;
    const payload = JSON.stringify(command);
    
    this.mqttClient.publish(topic, payload, { qos: 0 }, (err) => {
      if (err) {
        console.error(`Error publishing command to ${topic}:`, err);
      } else {
        console.log(`📤 MQTT command sent to Brew ${brewId}:`, command);
      }
    });
  }
}

module.exports = MQTTHandler;
