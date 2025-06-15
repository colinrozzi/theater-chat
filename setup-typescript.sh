#!/bin/bash

echo "🚀 Setting up TypeScript for theater-chat..."
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing TypeScript dependencies..."
bun add -d @types/node@^20.11.0 @types/react@^18.2.0 @types/uuid@^9.0.7 typescript@^5.3.0 concurrently@^8.2.2

echo ""
echo "🔨 Building TypeScript..."
bunx tsc

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ TypeScript setup complete!"
    echo ""
    echo "📋 Available commands:"
    echo "  bun run build        - Build TypeScript to JavaScript"
    echo "  bun run build:watch  - Build TypeScript in watch mode"
    echo "  bun run dev          - Run in development mode"
    echo "  bun run type-check   - Type check without building"
    echo "  bun run start        - Run the built application"
    echo ""
    echo "🎯 Try it out:"
    echo "  bun run start --config sonnet.json"
    echo ""
else
    echo ""
    echo "❌ Build failed. Check the errors above."
    echo "💡 Try running: bunx tsc --noEmit"
    echo "   to see type errors without building"
fi
