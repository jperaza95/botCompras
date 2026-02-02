# 🚀 GUÍA DE INICIO RÁPIDO

## Estructura Nueva ✨

Tu proyecto ahora está organizado así:

```
node-15minutos/
├── backend/          ← API JSON pura (Express)
├── frontend/         ← Interfaz React (Vite)
├── install.sh        ← Script de instalación
├── start.sh          ← Script para iniciar ambos servidores
└── docker-compose.yml ← Opcional (Docker)
```

## Paso 1: Instalar Dependencias 📦

```bash
chmod +x install.sh
./install.sh
```

O manualmente:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Paso 2: Configurar Variables de Entorno 🔐

**Backend:**
```bash
cp backend/.env.example backend/.env
# Edita backend/.env con tus credenciales PostgreSQL
```

**Frontend (Opcional):**
```bash
cp frontend/.env.example frontend/.env
```

## Paso 3: Iniciar los Servidores 🎬

**Opción A: Script automático**
```bash
./start.sh
```

**Opción B: Terminales separadas**

Terminal 1:
```bash
cd backend
npm run dev
```

Terminal 2:
```bash
cd frontend
npm run dev
```

## Paso 4: Acceder a la Aplicación 🌐

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## Endpoints de la API 📡

```bash
# Buscar licitaciones
GET http://localhost:5000/api/licitaciones?buscar=seguridad

# Filtrar por rubro
GET http://localhost:5000/api/licitaciones?rubro=Seguridad

# Obtener rubros disponibles
GET http://localhost:5000/api/rubros

# Verificar servidor
GET http://localhost:5000/api/health
```

## Cambios Principales 🔄

### ✅ Backend ahora:
- Solo devuelve JSON puro (sin HTML)
- CORS habilitado para React
- Separado en su propio puerto (5000)
- API limpia y documentada

### ✅ Frontend ahora:
- React moderno con Vite
- Componentes reutilizables
- Interfaz responsiva
- Conecta directamente a la API

### ✅ Base de Datos:
- PostgreSQL sigue igual
- Los datos no cambian

## 🐛 Troubleshooting

**Error "PORT en uso"**
```bash
# Cambiar puerto en backend/.env
PORT=5001
```

**Error CORS**
- Verifica que FRONTEND_URL en backend/.env es `http://localhost:3000`

**Base de datos no conecta**
- Verifica credenciales en backend/.env
- Asegúrate que PostgreSQL está corriendo

**Puerto 3000 ocupado en frontend**
- Edita frontend/vite.config.js y cambia `port: 3000`

## 📚 Archivos Importantes

- [backend/server.js](backend/server.js) - Servidor API
- [frontend/src/App.jsx](frontend/src/App.jsx) - App principal
- [frontend/src/components/SearchBar.jsx](frontend/src/components/SearchBar.jsx) - Búsqueda
- [backend/.env.example](backend/.env.example) - Template de variables

## 🐳 Con Docker (Opcional)

```bash
# Crea un .env con tus credenciales BD
cp backend/.env.example .env

# Inicia todo con Docker
docker-compose up
```

## Próximos Pasos 📈

- [ ] Instalar dependencias
- [ ] Configurar .env
- [ ] Iniciar servidores
- [ ] Verificar en http://localhost:3000
- [ ] Añadir más rubros al diccionario
- [ ] Mejorar interfaz
- [ ] Deploy a producción

¡Listo! Tu proyecto está organizado para escalar 🚀
