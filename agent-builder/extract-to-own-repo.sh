#!/bin/bash
# Script to extract agent-builder into its own standalone Git repository
#
# Usage:
#   1. Create a new repo on GitHub: gh repo create mrstrawciu/agent-builder --public
#   2. Run this script: bash agent-builder/extract-to-own-repo.sh
#   3. The standalone repo will be at ~/agent-builder-standalone/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$HOME/agent-builder-standalone"

echo "Extracting agent-builder to $TARGET_DIR..."

# Clean target
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

# Copy files (excluding node_modules, .env, dist, db)
rsync -av --exclude='node_modules' --exclude='.env' --exclude='dist' --exclude='*.db' \
  --exclude='extract-to-own-repo.sh' \
  "$SCRIPT_DIR/" "$TARGET_DIR/"

cd "$TARGET_DIR"

# Initialize git
git init
git add -A
git commit -m "Initial commit: Agent Builder - Visual AI Agent Pipeline Creator"

# Set remote (update URL if needed)
git remote add origin git@github.com:mrstrawciu/agent-builder.git
git branch -M main

echo ""
echo "Done! To push to GitHub:"
echo "  cd $TARGET_DIR"
echo "  git push -u origin main"
echo ""
echo "To run the app:"
echo "  npm install"
echo "  cd client && npm install && cd .."
echo "  echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env"
echo "  npm run dev"
