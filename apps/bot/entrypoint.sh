#!/bin/sh
echo "💾 Syncing Prisma Database Schema..."
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss
echo "🚀 Starting Enterprise Discord Bot..."
npm run start
