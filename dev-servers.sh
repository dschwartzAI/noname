#!/bin/bash

# Kill existing servers
echo "🔪 Killing existing servers..."
pkill -f "wrangler dev" 2>/dev/null
pkill -f "vite" 2>/dev/null
lsof -ti:8788 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
sleep 3

cd "$(dirname "$0")"

# Start backend in background with auto-restart
echo "🚀 Starting Wrangler backend..."
(
  while true; do
    npm run dev:backend
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      echo "Backend exited normally"
      break
    fi
    echo "⚠️  Wrangler crashed (exit code: $EXIT_CODE), cleaning up..."
    # Kill any zombie wrangler/workerd processes
    pkill -9 -f "wrangler dev" 2>/dev/null
    pkill -9 workerd 2>/dev/null
    lsof -ti:8788 | xargs kill -9 2>/dev/null
    sleep 3
    echo "Restarting backend..."
  done
) > /tmp/wrangler.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend (port 8788)..."
for i in {1..30}; do
  if curl -s http://localhost:8788/ > /dev/null 2>&1; then
    echo "✅ Backend ready!"
    break
  fi
  sleep 1
done

# Start frontend in background with auto-restart
echo "🚀 Starting Vite frontend..."
(
  while true; do
    npm run dev:frontend
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      echo "Frontend exited normally"
      break
    fi
    echo "⚠️  Vite crashed (exit code: $EXIT_CODE), cleaning up..."
    # Kill any zombie vite processes
    pkill -9 -f "vite" 2>/dev/null
    lsof -ti:5174 | xargs kill -9 2>/dev/null
    sleep 2
    echo "Restarting frontend..."
  done
) > /tmp/vite.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "⏳ Waiting for frontend (port 5174)..."
for i in {1..30}; do
  if curl -s http://localhost:5174/ > /dev/null 2>&1; then
    echo "✅ Frontend ready!"
    break
  fi
  sleep 1
done

echo ""
echo "🎉 Both servers are running with auto-restart!"
echo "   Frontend: http://localhost:5174"
echo "   Backend:  http://localhost:8788"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/wrangler.log"
echo "   Frontend: tail -f /tmp/vite.log"
echo ""
echo "💡 Press Ctrl+C to stop"

# Keep script running and forward signals
trap "echo ''; echo '🛑 Stopping servers...'; pkill -P $BACKEND_PID; pkill -P $FRONTEND_PID; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
