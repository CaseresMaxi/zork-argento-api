# Zork Argento API 🚀

Una API REST en Node.js para conectarse con OpenAI, similar a ChatGPT. Permite enviar prompts y recibir respuestas generadas por IA.

## 🎯 Características

- **Endpoints públicos** para fácil integración
- **Integración completa con OpenAI** (GPT-3.5-turbo, GPT-4, etc.)
- **Rate limiting** para prevenir abuso
- **Validación de entrada** robusta
- **Manejo de errores** detallado
- **Logging** para monitoreo
- **Health checks** para verificar estado

## 🚀 Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/facundogonzalez/zork-argento-api.git
cd zork-argento-api
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
```

Editar el archivo `.env` y agregar tu API key de OpenAI:
```env
OPENAI_API_KEY=tu_api_key_aqui
OPENAI_MODEL=gpt-3.5-turbo
PORT=3000
```

4. **Ejecutar el servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📡 Endpoints

### 1. Health Check
```http
GET /health
```

**Respuesta:**
```json
{
  "status": "OK",
  "message": "API funcionando correctamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### 2. Chat (Principal)
```http
POST /api/chat
```

**Body:**
```json
{
  "message": "Hola, ¿cómo estás?",
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "message": "¡Hola! Estoy muy bien, gracias por preguntar...",
    "model": "gpt-3.5-turbo",
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 50,
      "total_tokens": 60
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Modelos Disponibles
```http
GET /api/models
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "gpt-3.5-turbo",
        "owned_by": "openai",
        "created": 1677610602
      }
    ],
    "count": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. Estado de Configuración
```http
GET /api/status
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "configured": true,
    "model": "gpt-3.5-turbo",
    "environment": "development",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `OPENAI_API_KEY` | Tu API key de OpenAI | Requerido |
| `ZORK_ASSISTANT_ID` | ID del Assistant de Zork | Requerido |
| `OPENAI_MODEL` | Modelo a usar | `gpt-3.5-turbo` |
| `PORT` | Puerto del servidor | `3001` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `RATE_LIMIT_WINDOW_MS` | Ventana de rate limiting | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Máximo de requests por ventana | `100` |

### Parámetros del Chat

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `message` | string | ✅ | El prompt/mensaje a enviar |
| `model` | string | ❌ | Modelo de OpenAI a usar |
| `temperature` | number | ❌ | Creatividad (0-2) |
| `max_tokens` | number | ❌ | Máximo de tokens en respuesta |

## 🛡️ Seguridad

- **Rate Limiting**: 100 requests por 15 minutos por IP
- **Helmet**: Headers de seguridad
- **Validación**: Validación robusta de entrada
- **Error Handling**: Manejo seguro de errores

## 📝 Ejemplos de Uso

### JavaScript (Frontend)
```javascript
const response = await fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Explica qué es la inteligencia artificial',
    temperature: 0.7
  })
});

const data = await response.json();
console.log(data.data.message);
```

### cURL
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cuál es la capital de Argentina?",
    "temperature": 0.5
  }'
```

### Python
```python
import requests

response = requests.post('http://localhost:3000/api/chat', json={
    'message': 'Escribe un poema sobre la programación',
    'temperature': 0.8,
    'max_tokens': 500
})

data = response.json()
print(data['data']['message'])
```

## 🚨 Códigos de Error

| Código | Descripción |
|--------|-------------|
| `400` | Solicitud malformada |
| `401` | API key inválida |
| `402` | Cuota insuficiente |
| `408` | Timeout |
| `429` | Rate limit excedido |
| `500` | Error interno del servidor |

## 🛠️ Desarrollo

### Estructura del Proyecto
```
zork-argento-api/
├── src/
│   ├── routes/
│   │   └── openai.js      # Rutas de la API
│   └── server.js          # Servidor principal
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

### Scripts Disponibles
```bash
npm start      # Ejecutar en producción
npm run dev    # Ejecutar en desarrollo con nodemon
```

## 📄 Licencia

MIT License - ver archivo LICENSE para más detalles.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa la documentación
2. Verifica que tu API key de OpenAI sea válida
3. Revisa los logs del servidor
4. Abre un issue en GitHub

---

**¡Disfruta usando la API! 🎉**
