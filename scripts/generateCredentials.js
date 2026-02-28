#!/usr/bin/env node
/**
 * generateCredentials.js
 *
 * Script para gerar credenciais encriptadas prontas para colar no Firebase Firestore.
 * Coleção: comando_universal  |  Documento: credenciais
 *
 * Uso:
 *   node scripts/generateCredentials.js <ID> <SENHA> [CHAVE_SECRETA]
 *
 * Exemplo:
 *   node scripts/generateCredentials.js "PRM_9922" "Gogoma@2024" "WjH9lM4eN2aU7sK0oR5cT8vX"
 *
 * Se não passar a chave, ela será lida de EXPO_PUBLIC_CRYPTO_KEY no ambiente.
 */

const CryptoJS = require('crypto-js');

const [, , inputId, inputPassword, inputKey] = process.argv;
const secretKey = inputKey || process.env.EXPO_PUBLIC_CRYPTO_KEY;

if (!inputId || !inputPassword) {
    console.error('\n❌ ERRO: Forneça ID e SENHA como argumentos.\n');
    console.error('   Uso: node scripts/generateCredentials.js <ID> <SENHA> [CHAVE]\n');
    process.exit(1);
}

if (!secretKey) {
    console.error('\n❌ ERRO: Chave secreta não encontrada.');
    console.error('   Passe como 3º argumento ou defina EXPO_PUBLIC_CRYPTO_KEY no ambiente.\n');
    process.exit(1);
}

// Encriptar
const encryptedId = CryptoJS.AES.encrypt(inputId, secretKey).toString();
const encryptedPassword = CryptoJS.AES.encrypt(inputPassword, secretKey).toString();
const criadoEm = new Date().toISOString();

const firestoreData = {
    encryptedId,
    encryptedPassword,
    algoritmo: 'AES-256',
    criadoEm,
};

// ──────────────────────────────────────────────────────────
// Output
// ──────────────────────────────────────────────────────────
console.log('\n✅ CREDENCIAIS ENCRIPTADAS — copie e cole no Firebase Console\n');
console.log('📍 Caminho: Firebase Console → Firestore → comando_universal → credenciais\n');
console.log('─'.repeat(60));
console.log(JSON.stringify(firestoreData, null, 2));
console.log('─'.repeat(60));

// Verificação imediata (auto-teste de descriptografia)
const verifyId = CryptoJS.AES.decrypt(encryptedId, secretKey).toString(CryptoJS.enc.Utf8);
const verifyPassword = CryptoJS.AES.decrypt(encryptedPassword, secretKey).toString(CryptoJS.enc.Utf8);

if (verifyId === inputId && verifyPassword === inputPassword) {
    console.log('\n✅ Auto-verificação: descriptografia OK');
    console.log(`   ID recuperado:    ${verifyId}`);
    console.log(`   Senha recuperada: ${verifyPassword}`);
} else {
    console.error('\n❌ FALHA na auto-verificação. Verifique a chave secreta.');
}
console.log();
