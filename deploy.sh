#!/bin/bash
echo "📦 Fazendo commit..."
git add .
git commit -m "$1"
git push
echo "🚀 Deployando na Vercel..."
vercel --prod --force
echo "✅ Deploy concluído!"
