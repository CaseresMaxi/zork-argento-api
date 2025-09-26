const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta de la base de datos
const DB_PATH = path.join(__dirname, '..', 'database', 'zork.db');

// Crear directorio si no existe
const fs = require('fs');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Crear conexión a la base de datos
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
  } else {
    console.log('✅ Conectado a la base de datos SQLite');
    initDatabase();
  }
});

// Inicializar la base de datos
function initDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id VARCHAR(255) UNIQUE NOT NULL,
      thread_id VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createTableQuery, (err) => {
    if (err) {
      console.error('❌ Error creando tabla:', err.message);
    } else {
      console.log('✅ Tabla de conversaciones inicializada');
    }
  });
}

// Función para guardar una conversación
function saveConversation(conversationId, threadId) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT OR REPLACE INTO conversations (conversation_id, thread_id, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    
    db.run(query, [conversationId, threadId], function(err) {
      if (err) {
        console.error('❌ Error guardando conversación:', err.message);
        reject(err);
      } else {
        console.log(`✅ Conversación guardada: ${conversationId} -> ${threadId}`);
        resolve(this.lastID);
      }
    });
  });
}

// Función para obtener una conversación
function getConversation(conversationId) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM conversations WHERE conversation_id = ?';
    
    db.get(query, [conversationId], (err, row) => {
      if (err) {
        console.error('❌ Error obteniendo conversación:', err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Función para obtener todas las conversaciones
function getAllConversations() {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM conversations ORDER BY created_at DESC';
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Error obteniendo conversaciones:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Función para eliminar una conversación
function deleteConversation(conversationId) {
  return new Promise((resolve, reject) => {
    const query = 'DELETE FROM conversations WHERE conversation_id = ?';
    
    db.run(query, [conversationId], function(err) {
      if (err) {
        console.error('❌ Error eliminando conversación:', err.message);
        reject(err);
      } else {
        console.log(`✅ Conversación eliminada: ${conversationId}`);
        resolve(this.changes);
      }
    });
  });
}

// Cerrar conexión a la base de datos
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('❌ Error cerrando base de datos:', err.message);
    } else {
      console.log('✅ Conexión a base de datos cerrada');
    }
  });
}

module.exports = {
  saveConversation,
  getConversation,
  getAllConversations,
  deleteConversation,
  closeDatabase
};
