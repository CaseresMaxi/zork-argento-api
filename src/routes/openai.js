const express = require('express');
const OpenAI = require('openai');
const router = express.Router();

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validación de entrada
const validateChatRequest = (req, res, next) => {
  const { message, model, temperature, max_tokens } = req.body;
  
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      error: 'Mensaje requerido',
      message: 'El campo "message" es obligatorio y debe ser una cadena no vacía'
    });
  }
  
  if (message.length > 4000) {
    return res.status(400).json({
      error: 'Mensaje demasiado largo',
      message: 'El mensaje no puede exceder 4000 caracteres'
    });
  }
  
  // Validar parámetros opcionales
  if (temperature && (temperature < 0 || temperature > 2)) {
    return res.status(400).json({
      error: 'Parámetro inválido',
      message: 'Temperature debe estar entre 0 y 2'
    });
  }
  
  if (max_tokens && (max_tokens < 1 || max_tokens > 4000)) {
    return res.status(400).json({
      error: 'Parámetro inválido',
      message: 'max_tokens debe estar entre 1 y 4000'
    });
  }
  
  next();
};

// Endpoint para chat
router.post('/chat', validateChatRequest, async (req, res) => {
  try {
     const { 
       message, 
       model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
       temperature = 1,
       max_completion_tokens = 16000
     } = req.body;

    console.log(`📝 Nuevo mensaje recibido: ${message.substring(0, 100)}...`);

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      temperature: temperature,
      max_completion_tokens: max_completion_tokens,
    });

    const response = completion.choices[0]?.message?.content;

    console.log(completion.choices[0]);
    console.log(`🔍 Respuesta recibida: ${response}`);

    if (!response) {
      throw new Error('No se recibió respuesta de OpenAI');
    }

    console.log(`✅ Respuesta generada exitosamente`);

    res.json({
      success: true,
      data: {
        message: response,
        model: model,
        usage: completion.usage,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error en chat:', error);
    
    let statusCode = 500;
    let errorMessage = 'Error interno del servidor';
    
    if (error.code === 'insufficient_quota') {
      statusCode = 402;
      errorMessage = 'Cuota de API insuficiente';
    } else if (error.code === 'invalid_api_key') {
      statusCode = 401;
      errorMessage = 'API key inválida';
    } else if (error.code === 'rate_limit_exceeded') {
      statusCode = 429;
      errorMessage = 'Límite de velocidad excedido';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorMessage = 'Timeout en la solicitud';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener modelos disponibles
router.get('/models', async (req, res) => {
  try {
    const models = await openai.models.list();
    
    const availableModels = models.data
      .filter(model => model.id.includes('gpt'))
      .map(model => ({
        id: model.id,
        owned_by: model.owned_by,
        created: model.created
      }))
      .sort((a, b) => b.created - a.created);

    res.json({
      success: true,
      data: {
        models: availableModels,
        count: availableModels.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo modelos:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error obteniendo modelos',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para verificar configuración
router.get('/status', (req, res) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  
  res.json({
    success: true,
    data: {
      configured: hasApiKey,
      model: model,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
