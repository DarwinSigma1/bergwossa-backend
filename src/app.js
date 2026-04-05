require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Config
const { pool } = require('./config/database');
const { connectMQTT, getMQTTClient } = require('./config/mqtt');

// Routes
const brewRoutes = require('./routes/brewRoutes');
const stepRoutes = require('./routes/stepRoutes');

// Handlers
const MQTTHandler = require('./handlers/MQTTHandler');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api/brews', brewRoutes);
app.use('/api/steps', stepRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Check MQTT
    const mqttClient = getMQTTClient();
    const mqttConnected = mqttClient && mqttClient.connected;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      mqtt: mqttConnected ? 'connected' : 'disconnected',
      socket_io: 'running'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log('✓ Socket.IO client connected:', socket.id);

  // Join brew room (user wants to watch a specific brew)
  socket.on('join_brew', (brewId) => {
    socket.join(`brew:${brewId}`);
    console.log(`Socket ${socket.id} joined brew:${brewId}`);
  });

  // Leave brew room
  socket.on('leave_brew', (brewId) => {
    socket.leave(`brew:${brewId}`);
    console.log(`Socket ${socket.id} left brew:${brewId}`);
  });

  // Join user room (for user-specific notifications)
  socket.on('join_user', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`Socket ${socket.id} joined user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected:', socket.id);
  });
});

// Initialize and start server
async function startServer() {
  try {
    console.log('\n🚀 Starting Bergwossa Backend...\n');

    // 1. Test database connection
    console.log('📊 Testing PostgreSQL connection...');
    await pool.query('SELECT NOW()');
    console.log('✓ PostgreSQL connected\n');

    // 2. Connect to MQTT broker
    console.log('📡 Connecting to MQTT broker...');
    const mqttClient = connectMQTT();
    
    // Wait for MQTT connection
    await new Promise((resolve, reject) => {
      mqttClient.on('connect', resolve);
      mqttClient.on('error', reject);
      setTimeout(() => reject(new Error('MQTT connection timeout')), 10000);
    });

    // 3. Initialize MQTT Handler
    const mqttHandler = new MQTTHandler(mqttClient, io);
    app.set('mqttHandler', mqttHandler);  // Make available to controllers
    console.log('✓ MQTT handler initialized\n');

    // 4. Start HTTP server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log('✓ Server running\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      const host = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${PORT}`;
      console.log(`🌐 REST API:    ${host}/api`);
      console.log(`🔌 Socket.IO:   ${host}`);
      console.log(`📡 MQTT:        ${process.env.MQTT_BROKER_URL}`);
      console.log(`📊 Database:    ${process.env.DB_NAME}@${process.env.DB_HOST}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('Ready to receive temperature data! 🍺\n');
    });

  } catch (error) {
    console.error('\n❌ Failed to start server:', error.message, error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠ SIGTERM received, shutting down gracefully...');
  
  server.close(() => {
    console.log('✓ HTTP server closed');
  });

  await pool.end();
  console.log('✓ Database connections closed');
  
  const mqttClient = getMQTTClient();
  if (mqttClient) {
    mqttClient.end();
    console.log('✓ MQTT connection closed');
  }

  process.exit(0);
});

// Start the server
startServer();

module.exports = { app, server, io };
