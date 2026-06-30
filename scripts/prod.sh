#!/bin/bash
set -e

echo "🚀 LeadHunter AI - Production Deployment"
echo "============================================"

echo "📦 Building Docker images..."
docker-compose build

echo "🗄️  Running database migrations..."
docker-compose run --rm backend pnpm db:migrate:prod

echo "🌱 Seeding database..."
docker-compose run --rm backend pnpm db:seed

echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Services:"
echo "  Web App:  http://localhost"
echo "  API:      http://localhost/api"
echo "  API Docs: http://localhost/api/docs"
echo ""
echo "Useful commands:"
echo "  docker-compose logs -f     # View logs"
echo "  docker-compose down        # Stop services"
echo "  docker-compose restart     # Restart all"
