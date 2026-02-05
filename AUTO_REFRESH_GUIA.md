# 🔄 Sistema de Auto-Refresh de Licitaciones - Guía de Uso

## 📋 Descripción General

Se ha implementado un sistema automático de actualización estilo RSS que monitorea continuamente nuevas licitaciones desde el servidor ARCE. El sistema funciona en dos niveles:

### Backend (servidor.js)
- **Sincronización automática**: Cada 5 minutos (configurable)
- **Procesa RSS**: Descarga nuevas licitaciones del servidor ARCE
- **Clasifica automáticamente**: Asigna rubros a las licitaciones

### Frontend (React)
- **Polling automático**: Cada 30 segundos verifica si hay nuevas licitaciones
- **Notificaciones visuales**: Muestra un badge con el número de nuevas licitaciones
- **Control manual**: Permite pausar/reanudar el auto-refresh

---

## 🎯 Características Principales

### 1. **Indicador de Estado (Header)**
```
[🟢 Auto-actualización activa] [⏸ Pausar]
```
- **Punto verde pulsante**: Sistema activo
- **Botón ⏸/▶**: Pausar o reanudar auto-actualización

### 2. **Notificación de Nuevas Licitaciones**
```
[5] ⬇ 5 nuevas licitaciones
```
- Se muestra automáticamente cuando hay nuevas licitaciones
- Al hacer clic, descarga y muestra las nuevas licitaciones
- Limpia el contador después de actualizar

### 3. **Actualización Automática**
- Sin intervención del usuario
- Cada 30 segundos verifica nuevas licitaciones
- Cada 5 minutos sincroniza con el servidor ARCE

---

## ⚙️ Configuración

### Cambiar Intervalos de Actualización

#### En Frontend (`App.jsx`):
```javascript
const INTERVALO_POLLING = 30000 // 30 segundos
const INTERVALO_SINCRONIZACION = 5 * 60000 // 5 minutos
```

#### En Backend (`server.js`):
```javascript
const INTERVALO_SINCRONIZACION = 5 * 60 * 1000; // 5 minutos
```

---

## 🔌 Nuevos Endpoints de API

### 1. GET `/api/licitaciones/nuevas`
Obtiene licitaciones publicadas desde un timestamp específico.

**Parámetros:**
- `desde` (opcional): ISO string de fecha. Por defecto últimos 5 minutos

**Respuesta:**
```json
{
  "nuevas": 2,
  "datos": [
    {
      "id": 123,
      "titulo": "Suministro de papel",
      "organismo": "Ministerio X",
      "rubro_ia": "Oficina",
      "link": "...",
      "fecha_publicacion": "2025-02-05T10:30:00"
    }
  ]
}
```

### 2. GET `/api/licitaciones/ultima`
Obtiene la fecha de la última licitación en la base de datos.

**Respuesta:**
```json
{
  "ultimaActualizacion": "2025-02-05T10:30:00"
}
```

### 3. POST `/api/sincronizar`
Fuerza sincronización manual con el RSS del servidor ARCE.

**Respuesta:**
```json
{
  "success": true,
  "mensaje": "Sincronización completada",
  "total": 10,
  "nuevas": 3
}
```

---

## 🎨 Estilos Visuales Nuevos

Los siguientes estilos CSS se han añadido a `App.css`:

- `.header-controls`: Contenedor de controles en el header
- `.refresh-status`: Estado de auto-actualización
- `.status-dot`: Indicador visual (verde/rojo)
- `.toggle-btn`: Botón para pausar/reanudar
- `.new-items-notification`: Contenedor de notificación
- `.notification-badge`: Badge con número de nuevas licitaciones
- `.refresh-btn`: Botón para descargar nuevas licitaciones

---

## 📊 Flujo de Trabajo

```
┌─────────────────────────────────────────┐
│  Backend (Cada 5 minutos)              │
│  1. Sincroniza con RSS ARCE            │
│  2. Inserta nuevas licitaciones        │
│  3. Clasifica automáticamente          │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  Frontend (Cada 30 segundos)           │
│  1. Verifica nuevas licitaciones       │
│  2. Muestra notificación si hay nuevas │
│  3. Usuario hace clic en botón         │
│  4. Descarga y actualiza lista         │
└─────────────────────────────────────────┘
```

---

## 🚀 Uso

### Inicio Automático
El sistema comienza automáticamente cuando carga la aplicación.

### Pausar/Reanudar
Haz clic en el botón **⏸** en el header para pausar o **▶** para reanudar.

### Actualizar Manualmente
Si hay nuevas licitaciones y no quieres esperar, haz clic en el botón **⬇ X nuevas licitaciones**.

### Ver en Consola
Abre la consola del navegador (F12) para ver los logs:
```
🔔 5 nuevas licitaciones disponibles
✅ Sincronización completada: 3 nuevas licitaciones
```

---

## 📱 Responsividad

El sistema es completamente responsive:
- En móviles, los controles se apilan verticalmente
- El indicador de estado y el botón se adaptan al tamaño de pantalla
- La notificación se muestra de forma clara en cualquier dispositivo

---

## 🔧 Troubleshooting

### No aparece notificación de nuevas licitaciones
1. Verifica que `autoRefresh` esté activado (punto verde)
2. Revisa la consola para errores
3. Verifica que el backend esté corriendo

### El backend no sincroniza
1. Revisa los logs del servidor
2. Verifica conexión a base de datos
3. Verifica acceso a servidor ARCE

### Intervalos no cambian
1. Requiere reinicio del servidor
2. Reinicia el navegador para cambios en frontend

---

## 📝 Nota de Desarrollo

Este sistema está diseñado para ser:
- **Eficiente**: Polling cada 30 segundos, sincronización cada 5 minutos
- **No invasivo**: El usuario puede pausar cuando quiera
- **Escalable**: Los intervalos se pueden ajustar según necesidad
- **Resiliente**: Maneja errores sin fallar completamente

---

## 🎯 Próximas Mejoras Sugeridas

1. **WebSockets**: Reemplazar polling con WebSockets para actualizaciones en tiempo real
2. **Notificaciones del sistema**: Alertas push del navegador
3. **Historial de cambios**: Ver qué licitaciones se añadieron recientemente
4. **Filtros personalizados**: Alertas solo para rubros específicos
5. **Estadísticas**: Gráficos de licitaciones por tiempo

