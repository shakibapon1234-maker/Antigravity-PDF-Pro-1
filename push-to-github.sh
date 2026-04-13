#!/usr/bin/env bash
# Usage: ./push-to-github.sh <git-remote-url>
# Example: ./push-to-github.sh https://<TOKEN>@github.com/username/repo.git

if [ -z "$1" ]; then
  echo "Error: pass the remote git URL as the first argument."
  echo "Example: ./push-to-github.sh https://<TOKEN>@github.com/username/repo.git"
  exit 1
fi

REMOTE="$1"

echo "Initializing git (if not already)..."
git init

echo "Adding files..."
git add -A

echo "Committing..."
git commit -m "Add archive feature & UI" || echo "No changes to commit."

echo "Setting main branch..."
git branch -M main

echo "Removing any existing origin..."
git remote remove origin 2>/dev/null || true

echo "Adding remote $REMOTE..."
git remote add origin "$REMOTE"

echo "Pushing to origin main..."
git push -u origin main

echo "Done. If push failed, check credentials and remote URL."
