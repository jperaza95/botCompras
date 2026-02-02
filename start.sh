#!/bin/bash

echo "🚀 Iniciando servidores..."
echo ""

# Backend en primer terminal
echo "Terminal 1: Backend"
cd backend && npm run dev &
BACKEND_PID=$!

# Esperar un poco para que el backend arranque
sleep 2

# Frontend en segundo terminal
echo ""
echo "Terminal 2: Frontend"
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Ambos servidores iniciados!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "📡 Backend:  http://localhost:5000"
echo ""
echo "Para detener, presiona Ctrl+C"
echo ""

wait
