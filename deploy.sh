#!/bin/bash

# AmzSellMetrics Deploy Script
# Usage: ./deploy.sh "commit message"

set -e

MESSAGE=${1:-"Update"}

echo "📦 Building locally..."
npm run build

echo "📝 Committing changes..."
git add -A
git commit -m "$MESSAGE

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>" || echo "Nothing to commit"

echo "🚀 Pushing to GitHub..."
git push

echo "🔄 Deploying to server..."
ssh root@78.47.117.36 "cd /var/www/amzsellmetrics-repo && git pull && npm run build && cp -r build/* /var/www/amzsellmetrics/"

echo "✅ Deploy complete!"
