const express = require('express');
const OpenAI = require('openai');
const router = express.Router();
const db = require('../database-mysql');

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache en memoria para threads activos (conversationId -> threadId)
const gameThreads = new Map();

// ID del Assistant de Zork desde .env
const ZORK_ASSISTANT_ID = process.env.ZORK_ASSISTANT_ID;

if (!ZORK_ASSISTANT_ID) {
  console.error('❌ ZORK_ASSISTANT_ID no está configurado en el archivo .env');
  process.exit(1);
}

// Función para obtener o crear thread de conversación
const getOrCreateThread = async (conversationId) => {
  // Primero verificar en cache
  if (gameThreads.has(conversationId)) {
    return gameThreads.get(conversationId);
  }

  // Si no está en cache, buscar en base de datos
  try {
    const dbConversation = await db.getConversation(conversationId);
    
    if (dbConversation) {
      // Thread existe en BD, cargar en cache
      const threadData = {
        threadId: dbConversation.thread_id,
        createdAt: new Date(dbConversation.created_at)
      };
      gameThreads.set(conversationId, threadData);
      console.log(`✅ Thread cargado desde BD: ${dbConversation.thread_id} para conversación: ${conversationId}`);
      return threadData;
    } else {
      // Thread no existe, crear nuevo
      const thread = await openai.beta.threads.create();
      const threadData = {
        threadId: thread.id,
        createdAt: new Date()
      };
      
      // Guardar en cache
      gameThreads.set(conversationId, threadData);
      
      // Guardar en base de datos
      await db.saveConversation(conversationId, thread.id);
      
      console.log(`✅ Nuevo thread creado: ${thread.id} para conversación: ${conversationId}`);
      return threadData;
    }
  } catch (error) {
    console.error('❌ Error obteniendo/creando thread:', error);
    throw error;
  }
};

// Función para detectar si el jugador quiere crear un nuevo juego
const isNewGameRequest = (message) => {
  const newGameKeywords = [
    'crear nuevo juego',
    'nueva partida',
    'empezar de nuevo',
    'reiniciar juego',
    'nuevo juego',
    'comenzar aventura',
    'start game',
    'new game'
  ];
  
  const lowerMessage = message.toLowerCase();
  return newGameKeywords.some(keyword => lowerMessage.includes(keyword));
};

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

// Endpoint para chat con el Assistant de Zork
router.post('/chat', validateChatRequest, async (req, res) => {
  try {
     const { 
       message, 
       conversationId = 'default' // ID de conversación para mantener contexto
     } = req.body;

    console.log(`📝 Nuevo mensaje recibido: ${message.substring(0, 100)}...`);

    // Verificar si el jugador quiere crear un nuevo juego
    if (isNewGameRequest(message)) {
      console.log(`🎮 Creando nueva partida para conversación: ${conversationId}`);
      // Eliminar thread existente de cache y BD
      if (gameThreads.has(conversationId)) {
        gameThreads.delete(conversationId);
      }
      // Eliminar de base de datos también
      try {
        await db.deleteConversation(conversationId);
      } catch (error) {
        console.error('❌ Error eliminando conversación de BD:', error);
      }
    }

    // Obtener o crear thread de conversación
    const gameThread = await getOrCreateThread(conversationId);
    
    // Agregar mensaje al thread
    await openai.beta.threads.messages.create(gameThread.threadId, {
      role: 'user',
      content: message
    });

    // Ejecutar el Assistant
    const run = await openai.beta.threads.runs.create(gameThread.threadId, {
      assistant_id: ZORK_ASSISTANT_ID
    });

    // Esperar a que termine la ejecución
    let runStatus = await openai.beta.threads.runs.retrieve(gameThread.threadId, run.id);
    while (runStatus.status !== 'completed') {
      if (runStatus.status === 'failed') {
        throw new Error(`Run failed: ${runStatus.last_error?.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(gameThread.threadId, run.id);
    }

    // Obtener la respuesta
    const messages = await openai.beta.threads.messages.list(gameThread.threadId);
    const response = messages.data[0].content[0].text.value;

    console.log(`🔍 Respuesta recibida: ${response}`);

    if (!response) {
      throw new Error('No se recibió respuesta del Assistant');
    }

    // response.message = JSON.parse(response.message);

    console.log(`✅ Respuesta generada exitosamente`);

    res.json({
      success: true,
      data: {
        message: JSON.parse(response),
        conversationId: conversationId,
        threadId: gameThread.threadId,
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
  const hasAssistantId = !!process.env.ZORK_ASSISTANT_ID;
  
  res.json({
    success: true,
    data: {
      configured: hasApiKey && hasAssistantId,
      hasApiKey: hasApiKey,
      hasAssistantId: hasAssistantId,
      assistantId: ZORK_ASSISTANT_ID,
      environment: process.env.NODE_ENV || 'development',
      activeConversations: gameThreads.size,
      timestamp: new Date().toISOString()
    }
  });
});

// Endpoint para obtener contexto de una conversación
router.get('/context/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Buscar en base de datos primero
    const dbConversation = await db.getConversation(conversationId);
    
    if (!dbConversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversación no encontrada',
        message: `No existe una conversación con ID: ${conversationId}`
      });
    }

    // Obtener mensajes del thread
    const messages = await openai.beta.threads.messages.list(dbConversation.thread_id);
    const messageCount = messages.data.length;
    const lastMessage = messageCount > 0 ? {
      role: messages.data[0].role,
      content: messages.data[0].content[0].text.value,
      timestamp: new Date(messages.data[0].created_at * 1000)
    } : null;
    
    res.json({
      success: true,
      data: {
        conversationId: conversationId,
        threadId: dbConversation.thread_id,
        messageCount: messageCount,
        createdAt: dbConversation.created_at,
        updatedAt: dbConversation.updated_at,
        lastMessage: lastMessage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo contexto:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo contexto',
      message: error.message
    });
  }
});

// Endpoint para limpiar contexto de una conversación (DESHABILITADO)
router.delete('/context/:conversationId', (req, res) => {
  res.status(403).json({
    success: false,
    error: 'Funcionalidad deshabilitada',
    message: 'No se pueden eliminar conversaciones. Solo se permite crear y continuar historias.'
  });
});

// Endpoint para obtener historial completo de una partida
router.get('/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Buscar en base de datos primero
    const dbConversation = await db.getConversation(conversationId);
    
    if (!dbConversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversación no encontrada',
        message: `No existe una conversación con ID: ${conversationId}`
      });
    }

    // Obtener todos los mensajes del thread
    const messages = await openai.beta.threads.messages.list(dbConversation.thread_id);
    
    // Procesar mensajes en orden cronológico (más antiguos primero)
    const sortedMessages = messages.data.sort((a, b) => a.created_at - b.created_at);
    
    // Formatear historial
    const history = [];
    let currentExchange = {};
    
    for (const message of sortedMessages) {
      const content = message.content[0].text.value;
      const timestamp = new Date(message.created_at * 1000);
      
      if (message.role === 'user') {
        // Si ya hay un exchange en progreso, guardarlo
        if (currentExchange.user) {
          history.push(currentExchange);
        }
        // Iniciar nuevo exchange
        currentExchange = {
          user: content,
          timestamp: timestamp
        };
      } else if (message.role === 'assistant') {
        // Completar el exchange actual
        currentExchange.zorkMaster = content;
        if (currentExchange.user) {
          history.push(currentExchange);
        }
        currentExchange = {};
      }
    }
    
    // Si queda un exchange sin completar, agregarlo
    if (currentExchange.user) {
      history.push(currentExchange);
    }
    
    res.json({
      success: true,
      data: {
        conversationId: conversationId,
        threadId: dbConversation.thread_id,
        totalExchanges: history.length,
        createdAt: dbConversation.created_at,
        updatedAt: dbConversation.updated_at,
        history: history,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo historial',
      message: error.message
    });
  }
});

// Endpoint para listar todas las conversaciones activas
router.get('/conversations', async (req, res) => {
  try {
    const dbConversations = await db.getAllConversations();
    
    const conversationList = dbConversations.map(conv => ({
      conversationId: conv.conversation_id,
      threadId: conv.thread_id,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at
    }));
    
    res.json({
      success: true,
      data: {
        conversations: conversationList,
        total: conversationList.length,
        assistantId: ZORK_ASSISTANT_ID,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo conversaciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo conversaciones',
      message: error.message
    });
  }
});

module.exports = router;
