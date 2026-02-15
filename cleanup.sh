#!/bin/bash

# Script de Limpeza e Manutenção GOGOMA (Expo)
# Caminho: /Users/macbookpro/Downloads/gogoma/

PROJECT_DIR="/Users/macbookpro/Downloads/gogoma"
cd "$PROJECT_DIR" || exit

echo "🚀 Iniciando manutenção do projeto GOGOMA..."

# 1. Instalar dependências essenciais que faltam para o Firebase/Native
echo "📦 Instalando dependências auxiliares para Firebase Native..."
npm install react-native-get-random-values --save

# 2. Corrigir versões incompatíveis (conforme avisos do Expo)
echo "🛠️ Validando versões das dependências com Expo..."
npx expo install --check

# 3. Limpar Caches
echo "🧹 Limpando caches (npm, Expo, Metro)..."
npm cache clean --force
rm -rf .expo
rm -rf node_modules/.cache

# 4. Iniciar Teste com Cache Limpo
echo "🔥 Iniciando Expo com --clear..."
npx expo start --clear
