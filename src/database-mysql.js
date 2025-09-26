const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'zork_argento', // Necesitarás crear esta BD
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Inicializar la base de datos
async function initDatabase() {
  try {
    // Verificar conexión a la base de datos existente
    const [rows] = await pool.execute('SELECT 1');
    console.log('✅ Conectado a MySQL - Base de datos zork_argento');
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error);
    throw error;
  }
}

// Función para guardar una conversación
async function saveConversation(conversationId, threadId) {
  try {
    const query = `
      INSERT INTO conversations (conversation_id, thread_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE 
      thread_id = VALUES(thread_id),
      updated_at = CURRENT_TIMESTAMP
    `;
    
    const [result] = await pool.execute(query, [conversationId, threadId]);
    console.log(`✅ Conversación guardada en MySQL: ${conversationId} -> ${threadId}`);
    return result.insertId;
  } catch (error) {
    console.error('❌ Error guardando conversación en MySQL:', error);
    throw error;
  }
}

// Función para obtener una conversación
async function getConversation(conversationId) {
  try {
    const query = 'SELECT * FROM conversations WHERE conversation_id = ?';
    const [rows] = await pool.execute(query, [conversationId]);
    return rows[0] || null;
  } catch (error) {
    console.error('❌ Error obteniendo conversación de MySQL:', error);
    throw error;
  }
}

// Función para obtener todas las conversaciones
async function getAllConversations() {
  try {
    const query = 'SELECT * FROM conversations ORDER BY created_at DESC';
    const [rows] = await pool.execute(query);
    return rows;
  } catch (error) {
    console.error('❌ Error obteniendo conversaciones de MySQL:', error);
    throw error;
  }
}

// Función para eliminar una conversación
async function deleteConversation(conversationId) {
  try {
    const query = 'DELETE FROM conversations WHERE conversation_id = ?';
    const [result] = await pool.execute(query, [conversationId]);
    console.log(`✅ Conversación eliminada de MySQL: ${conversationId}`);
    return result.affectedRows;
  } catch (error) {
    console.error('❌ Error eliminando conversación de MySQL:', error);
    throw error;
  }
}

// Cerrar conexiones
async function closeDatabase() {
  try {
    await pool.end();
    console.log('✅ Conexiones MySQL cerradas');
  } catch (error) {
    console.error('❌ Error cerrando MySQL:', error);
  }
}

module.exports = {
  initDatabase,
  saveConversation,
  getConversation,
  getAllConversations,
  deleteConversation,
  closeDatabase
};
