#!/bin/bash
# ══════════════════════════════════════════════════
#  GOGOMA — Script de Build Web para Produção
#  Uso: bash scripts/build-web.sh
# ══════════════════════════════════════════════════

set -e  # Para se houver qualquer erro

echo ""
echo "🔨 GOGOMA — Iniciando build de produção (Web)..."
echo ""

# 1. Exportar o bundle com Expo
npx expo export --platform web

echo ""
echo "📦 Bundle gerado. A copiar ficheiros adicionais..."

# 2. Copiar Service Worker das notificações push
if [ -f "firebase-messaging-sw.js" ]; then
    cp firebase-messaging-sw.js dist/firebase-messaging-sw.js
    echo "  ✅ firebase-messaging-sw.js copiado"
else
    echo "  ⚠️  firebase-messaging-sw.js não encontrado (notificações push podem falhar)"
fi

# 3. Copiar páginas públicas da pasta /public para /dist
if [ -d "public" ]; then
    cp -r public/. dist/
    echo "  ✅ Páginas públicas copiadas (privacy, terms, contactos...)"
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ Build concluído! Pasta: ./dist"
echo ""
echo "📋 Conteúdo do dist:"
ls dist/
echo "════════════════════════════════════════"
echo ""
echo "🚀 Próximo passo: Faz upload da pasta ./dist para o Netlify"
echo ""
