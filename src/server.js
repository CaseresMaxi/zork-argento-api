const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const openaiRoutes = require('./routes/openai');
const db = require('./database-mysql');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - Configurar Helmet para permitir CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - Permitir localhost y dominio de producción
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080'
    ];

// Agregar dominio de producción si está configurado
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Permitir si está en la lista de orígenes permitidos
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      // En producción, verificar si el origen está permitido
      if (process.env.NODE_ENV === 'production') {
        // Si no está en la lista, rechazar
        callback(new Error('No permitido por CORS'));
      } else {
        // En desarrollo, permitir todo
        callback(null, true);
      }
    }
  },
  credentials: true, // Permitir cookies y headers de autenticación
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // límite de requests por IP
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  }
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS está funcionando correctamente',
    origin: req.headers.origin || 'No origin header',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', openaiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Zork Argento API - Conecta con OpenAI',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      chat: '/api/chat',
      models: '/api/models'
    },
    documentation: 'https://github.com/facundogonzalez/zork-argento-api'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    message: 'El endpoint solicitado no existe',
    availableEndpoints: ['/health', '/api/chat', '/api/models']
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Inicializar base de datos y start server
async function startServer() {
  try {
    // Inicializar base de datos
    await db.initDatabase();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
      console.log(`🤖 Models endpoint: http://localhost:${PORT}/api/models`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await db.closeDatabase();
  process.exit(0);
});

startServer();

module.exports = app;
