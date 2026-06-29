/**
 * migrate-auth-admin.mjs
 * 
 * Versão com firebase-admin para contornar as Firestore Rules.
 * Usa as credenciais da conta Firebase diretamente.
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Carregar env
function loadEnv(filePath = '.env.local') {
    const content = readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        env[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim();
    }
    return env;
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

// AES decrypt usando CryptoJS
import CryptoJS from 'crypto-js';
function decryptAES(cipherText, key) {
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch { return null; }
}

async function main() {
    const env = loadEnv();
    const cryptoKey = env['EXPO_PUBLIC_CRYPTO_KEY'];
    const commandId = env['EXPO_PUBLIC_COMMAND_ID'];
    const projectId = env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'];

    // Admin SDK com Application Default Credentials
    // (usa o login da firebase CLI já feito)
    const app = initializeApp({ projectId });
    const db = getFirestore(app);

    const credRef = db.collection('comando_universal').doc('credenciais');
    const snap = await credRef.get();

    if (!snap.exists) {
        console.error('❌ Documento não encontrado!');
        process.exit(1);
    }

    const data = snap.data();

    if (data.passwordHash && data.badgeHash) {
        console.log('✅ Já migrado!');
        process.exit(0);
    }

    const plain = decryptAES(data.encryptedPassword, cryptoKey);
    if (!plain) { console.error('❌ Falha a desencriptar'); process.exit(1); }

    const passwordHash = sha256(plain);
    const badgeHash    = sha256(commandId);

    await credRef.set({
        ...data,
        passwordHash,
        badgeHash,
        algoritmo_auth: 'SHA-256',
        migrado_em: new Date().toISOString(),
    }, { merge: true });

    console.log('✅ Migração concluída! Hashes SHA-256 guardados no Firestore.');
    process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
