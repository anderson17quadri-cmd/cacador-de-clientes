#!/bin/bash
set -e

echo "🚀 LeadHunter AI - Development Environment"
echo "============================================"

if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@9.5.0
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🗄️  Setting up database..."
pnpm db:generate
pnpm db:migrate
pnpm db:seed

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start development servers:"
echo "  pnpm dev              # Start all services"
echo "  pnpm dev:backend      # Start backend only"
echo "  pnpm dev:web          # Start frontend only"
echo ""
echo "API Docs: http://localhost:3001/api/docs"
echo "Web App:  http://localhost:3000"
