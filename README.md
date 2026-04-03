# Bergwossa Backend 🍺

IoT Backend für Bierbrau-Temperaturüberwachung mit ESP32, MQTT, Socket.IO und PostgreSQL.

## Features

- ✅ **REST API** für Frontend-Integration
- ✅ **Socket.IO** für Live-Temperatur-Updates
- ✅ **MQTT** für ESP32-Kommunikation (HiveMQ Cloud)
- ✅ **PostgreSQL** mit Connection Pooling
- ✅ **State Machine** für Condition-Tracking
- ✅ **Timer-Support** im Frontend berechnet
- ✅ **Multi-User** Ready (Keycloak-Integration vorbereitet)

## Architektur

```
ESP32 → MQTT (HiveMQ) → Backend → Socket.IO → Frontend
                          ↓
                     PostgreSQL
```

## Installation

### 1. Dependencies installieren

```bash
npm install
```

### 2. PostgreSQL Datenbank erstellen

```sql
CREATE DATABASE bergwossa;
```

### 3. .env Datei erstellen

```bash
cp .env.example .env
```

Dann `.env` bearbeiten:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bergwossa
DB_USER=postgres
DB_PASSWORD=dein-password

# HiveMQ Cloud MQTT
MQTT_BROKER_URL=xyz123.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=dein-username
MQTT_PASSWORD=dein-password

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
```

### 4. Datenbank-Schema erstellen

```bash
npm run db:setup
```

Dies erstellt:
- `step` Tabelle mit 9 Brau-Steps
- `brew` Tabelle für Brauvorgänge
- Indizes für Performance

### 5. Server starten

**Development (mit Auto-Reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server läuft auf: `http://localhost:3000`

## API Endpoints

### Brews

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/brews` | Alle Brews des Users |
| GET | `/api/brews?active=true` | Nur aktive Brews |
| GET | `/api/brews/:id` | Brew-Details |
| POST | `/api/brews` | Neuen Brew erstellen |
| PUT | `/api/brews/:id/advance` | Zum nächsten Step |
| POST | `/api/brews/:id/set-temperature` | Temperatur an ESP32 senden |
| PUT | `/api/brews/:id/complete` | Brew abschließen |

### Steps

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/steps` | Alle Steps |
| GET | `/api/steps/:id` | Step-Details |

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "database": "connected",
  "mqtt": "connected",
  "socket_io": "running"
}
```

## Socket.IO Events

### Client → Server

```javascript
socket.emit('join_brew', 42);   // Brew-Updates abonnieren
socket.emit('leave_brew', 42);  // Abmelden
socket.emit('join_user', 'user123');  // User-Room beitreten
```

### Server → Client

```javascript
// Temperatur-Update (alle 5 Sekunden)
socket.on('temperature_update', (data) => {
  // data: { brew_id, temperature, temp_condition_met, in_range, step, timestamp }
});

// Condition erfüllt
socket.on('condition_met', (data) => {
  // data: { brew_id, type: 'TEMPERATURE', step, message, timestamp }
});
```

## MQTT Topics

### ESP32 → Backend

```
brew/42/temperature
```

Payload:
```json
{
  "temperature": 67.5
}
```

### Backend → ESP32

```
brew/42/command
```

Payload:
```json
{
  "action": "set_temperature",
  "value": 65.0
}
```

## Datenbank-Schema

### brew Tabelle

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| brew_id | SERIAL | Primary Key |
| user_id | VARCHAR(255) | User ID (von Keycloak) |
| step_id | INTEGER | Aktueller Step |
| name | VARCHAR(255) | Brew-Name |
| start_date | TIMESTAMP | Start-Zeitpunkt |
| end_date | TIMESTAMP | Ende (NULL = aktiv) |
| step_started_at | TIMESTAMP | Step-Start (für Timer) |
| currenttemp | DECIMAL(5,2) | Aktuelle Temperatur |
| last_temp_update | TIMESTAMP | Letzte Messung |
| temp_condition_met | BOOLEAN | Temperatur OK? |

### step Tabelle

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| step_id | SERIAL | Primary Key |
| step_number | INTEGER | Reihenfolge (1-9) |
| name | VARCHAR(100) | Step-Name |
| condition | TEXT | Anleitung |
| temprange | VARCHAR(50) | z.B. "65-69", NULL wenn keine |
| timer | INTEGER | Sekunden, NULL wenn kein Timer |
| requires_temperature | BOOLEAN | Braucht Temperatur? |
| requires_timer | BOOLEAN | Braucht Timer? |

## Authentifizierung

**Aktuell (Development):**

Header senden:
```
X-User-ID: user123
```

**Später (Production):**

JWT Token von Keycloak:
```
Authorization: Bearer <jwt-token>
```

## Beispiel-Request

### Brew erstellen

```bash
curl -X POST http://localhost:3000/api/brews \
  -H "Content-Type: application/json" \
  -H "X-User-ID: darwin123" \
  -d '{"name": "Mein erstes Pilsner"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "brew_id": 1,
    "user_id": "darwin123",
    "name": "Mein erstes Pilsner",
    "step_id": 1,
    "current_step": {
      "name": "Maischen",
      "temprange": "65-69",
      "timer": 3600,
      "requires_temperature": true,
      "requires_timer": true
    }
  }
}
```

### Step wechseln

```bash
curl -X PUT http://localhost:3000/api/brews/1/advance \
  -H "X-User-ID: darwin123"
```

## Frontend-Integration

### Angular/React

```typescript
import { io } from 'socket.io-client';

// Connect
const socket = io('http://localhost:3000');

// Join brew
socket.emit('join_brew', 42);

// Listen for updates
socket.on('temperature_update', (data) => {
  console.log('New temp:', data.temperature);
  setCurrentTemp(data.temperature);
});

// REST API
const response = await fetch('http://localhost:3000/api/brews', {
  headers: {
    'X-User-ID': 'darwin123'
  }
});
const brews = await response.json();
```

## ESP32 Code-Beispiel

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

const char* mqtt_server = "xyz123.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;

void loop() {
  // Alle 5 Sekunden Temperatur senden
  if (millis() - lastSend > 5000) {
    float temp = readTemperature();
    
    String payload = "{\"temperature\":" + String(temp) + "}";
    client.publish("brew/42/temperature", payload.c_str());
    
    lastSend = millis();
  }
}
```

## Entwicklung

### Logs aktivieren

```bash
NODE_ENV=development npm run dev
```

### Tests (TODO)

```bash
npm test
```

## Deployment

### PM2 (Production)

```bash
npm install -g pm2
pm2 start src/app.js --name bergwossa
pm2 save
pm2 startup
```

### Docker (TODO)

```bash
docker build -t bergwossa-backend .
docker run -p 3000:3000 --env-file .env bergwossa-backend
```

## Troubleshooting

### MQTT verbindet nicht

- Prüfe HiveMQ Cloud Credentials in `.env`
- Prüfe Port 8883 ist offen
- Teste mit MQTT.fx Client

### PostgreSQL-Fehler

```bash
# Verbindung testen
psql -h localhost -U postgres -d bergwossa

# Tabellen prüfen
\dt
```

### Socket.IO verbindet nicht

- Prüfe CORS-Einstellungen in `app.js`
- Prüfe Frontend-URL in `.env`

## Lizenz

MIT

## Autor

Darwin Heinrich - Diplomarbeit 2026
