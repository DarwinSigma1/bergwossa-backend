const mqtt = require('mqtt');
require('dotenv').config();

let client = null;

/**
 * Initialize MQTT connection to HiveMQ Cloud
 */
function connectMQTT() {
  const brokerUrl = `mqtts://${process.env.MQTT_BROKER_URL}:${process.env.MQTT_PORT}`;
  
  console.log('Connecting to MQTT broker:', process.env.MQTT_BROKER_URL);
  
  client = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: `bergwossa-backend-${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 5000,  // Auto-reconnect every 5 seconds
    connectTimeout: 30000
  });

  client.on('connect', () => {
    console.log('✓ MQTT connected to HiveMQ Cloud');
    
    // Subscribe to all brew temperature topics
    client.subscribe('brew/+/temperature', (err) => {
      if (!err) {
        console.log('✓ Subscribed to brew/+/temperature');
      } else {
        console.error('MQTT subscribe error:', err);
      }
    });
  });

  client.on('error', (error) => {
    console.error('MQTT error:', error);
  });

  client.on('offline', () => {
    console.warn('⚠ MQTT offline - will auto-reconnect');
  });

  client.on('reconnect', () => {
    console.log('↻ MQTT reconnecting...');
  });

  return client;
}

/**
 * Get MQTT client instance
 */
function getMQTTClient() {
  if (!client) {
    throw new Error('MQTT client not initialized. Call connectMQTT() first.');
  }
  return client;
}

/**
 * Publish message to topic
 */
function publish(topic, message, options = {}) {
  if (!client || !client.connected) {
    console.error('Cannot publish: MQTT not connected');
    return false;
  }
  
  const payload = typeof message === 'object' ? JSON.stringify(message) : message;
  
  client.publish(topic, payload, {
    qos: options.qos || 0,
    retain: options.retain || false
  }, (err) => {
    if (err) {
      console.error('MQTT publish error:', err);
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`📤 MQTT published to ${topic}:`, payload);
    }
  });
  
  return true;
}

/**
 * Subscribe to topic
 */
function subscribe(topic, callback) {
  if (!client) {
    throw new Error('MQTT client not initialized');
  }
  
  client.subscribe(topic, (err) => {
    if (err) {
      console.error(`MQTT subscribe error for ${topic}:`, err);
    } else {
      console.log(`✓ Subscribed to ${topic}`);
    }
  });
  
  if (callback) {
    client.on('message', callback);
  }
}

module.exports = {
  connectMQTT,
  getMQTTClient,
  publish,
  subscribe
};
