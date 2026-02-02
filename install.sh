#!/bin/bash

echo "📦 Instalando dependencias del proyecto..."

# Backend
echo "🔧 Instalando backend..."
cd backend
npm install
echo "✅ Backend instalado"

# Frontend
echo "🎨 Instalando frontend..."
cd ../frontend
npm install
echo "✅ Frontend instalado"

cd ..

echo ""
echo "✨ Instalación completada!"
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "1️⃣  Configura las variables de entorno:"
echo "   - Copia backend/.env.example a backend/.env"
echo "   - Edita backend/.env con tus credenciales de BD"
echo ""
echo "2️⃣  Inicia los servidores en terminales separadas:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   $ cd backend && npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   $ cd frontend && npm run dev"
echo ""
echo "3️⃣  Accede a la aplicación:"
echo "   🌐 http://localhost:3000"
echo ""
echo "📡 Backend API disponible en: http://localhost:5000"
echo ""
