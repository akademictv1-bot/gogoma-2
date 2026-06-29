/**
 * migrate-auth.mjs
 * 
 * Script de migração: converte as credenciais do Comando
 * de AES-256 (chave exposta no browser) para SHA-256 (sem chave, seguro).
 * 
 * Executar UMA VEZ: node scripts/migrate-auth.mjs
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import CryptoJS from 'crypto-js';

// ─── Carregar variáveis de ambiente do .env.local ───────────────────────────
function loadEnv(filePath = '.env.local') {
    try {
        const content = readFileSync(filePath, 'utf8');
        const env = {};
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) continue;
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();
            env[key] = value;
        }
        return env;
    } catch (e) {
        console.error('❌ Não foi possível ler .env.local:', e.message);
        process.exit(1);
    }
}

// ─── SHA-256 (sem chave secreta — seguro para produção) ─────────────────────
function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

// ─── Desencriptar AES legado ─────────────────────────────────────────────────
function decryptAES(cipherText, key) {
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
        return null;
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n🔐 GOGOMA — Migração de Segurança: AES → SHA-256\n');

    const env = loadEnv();

    const cryptoKey   = env['EXPO_PUBLIC_CRYPTO_KEY'];
    const commandId   = env['EXPO_PUBLIC_COMMAND_ID'];

    if (!cryptoKey || !commandId) {
        console.error('❌ EXPO_PUBLIC_CRYPTO_KEY ou EXPO_PUBLIC_COMMAND_ID não encontrados no .env.local');
        process.exit(1);
    }

    console.log('✅ Variáveis de ambiente carregadas.');
    console.log(`   ID do Comando: ${commandId}`);

    // ─── Inicializar Firebase ────────────────────────────────────────────
    const firebaseConfig = {
        apiKey:            env['EXPO_PUBLIC_FIREBASE_API_KEY_WEB'],
        authDomain:        env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'],
        projectId:         env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'],
        storageBucket:     env['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'],
        messagingSenderId: env['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
        appId:             env['EXPO_PUBLIC_FIREBASE_APP_ID_WEB'],
    };

    const app = initializeApp(firebaseConfig);
    const db  = getFirestore(app);

    // ─── Ler credenciais atuais do Firestore ─────────────────────────────
    console.log('\n📡 A ler credenciais do Firestore...');
    const credRef  = doc(db, 'comando_universal', 'credenciais');
    const credSnap = await getDoc(credRef);

    if (!credSnap.exists()) {
        console.error('❌ Documento "comando_universal/credenciais" não encontrado!');
        console.log('   Cria o documento no Firebase Console primeiro com o campo encryptedPassword.');
        process.exit(1);
    }

    const data = credSnap.data();
    console.log('✅ Documento encontrado.');

    // Verificar se já foi migrado
    if (data.passwordHash && data.badgeHash) {
        console.log('\n✅ MIGRAÇÃO JÁ CONCLUÍDA anteriormente!');
        console.log('   Os campos passwordHash e badgeHash já existem no Firestore.');
        console.log('   Não é necessário correr este script novamente.\n');
        process.exit(0);
    }

    // ─── Desencriptar senha atual ─────────────────────────────────────────
    if (!data.encryptedPassword) {
        console.error('❌ Campo "encryptedPassword" não encontrado no documento Firestore!');
        process.exit(1);
    }

    const plainPassword = decryptAES(data.encryptedPassword, cryptoKey);
    if (!plainPassword) {
        console.error('❌ Falha ao desencriptar a senha! Verifica se a EXPO_PUBLIC_CRYPTO_KEY está correta.');
        process.exit(1);
    }

    console.log('✅ Senha desencriptada com sucesso.');
    console.log(`   Tamanho da senha: ${plainPassword.length} caracteres`);

    // ─── Gerar hashes SHA-256 ────────────────────────────────────────────
    const passwordHash = sha256(plainPassword);
    const badgeHash    = sha256(commandId);

    console.log('\n🔒 Hashes SHA-256 gerados:');
    console.log(`   badgeHash:    ${badgeHash.substring(0, 16)}...`);
    console.log(`   passwordHash: ${passwordHash.substring(0, 16)}...`);

    // ─── Guardar novos hashes no Firestore ───────────────────────────────
    console.log('\n📝 A guardar hashes no Firestore...');
    await setDoc(credRef, {
        ...data,
        passwordHash,
        badgeHash,
        algoritmo_auth: 'SHA-256',
        migrado_em: new Date().toISOString(),
    }, { merge: true });

    console.log('✅ Hashes guardados no Firestore com sucesso!');
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('🎉 MIGRAÇÃO CONCLUÍDA!');
    console.log('');
    console.log('   Próximos passos:');
    console.log('   1. O código da app já foi atualizado para usar SHA-256.');
    console.log('   2. A EXPO_PUBLIC_CRYPTO_KEY foi removida do .env.local.');
    console.log('   3. Faz um novo build para produção (eas build --platform android).');
    console.log('─────────────────────────────────────────────────────────\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro inesperado:', err);
    process.exit(1);
});
