/**
 * migrate-sha256.mjs
 * Migra as credenciais do Firestore de AES → SHA-256 (hash sem chave secreta).
 * Usa o firebase client SDK com regras temporariamente abertas.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import CryptoJS from 'crypto-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Carregar .env.local manualmente
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key) env[key.trim()] = rest.join('=').trim();
    }
}

const CRYPTO_KEY = env['EXPO_PUBLIC_CRYPTO_KEY'];
const COMMAND_ID = env['EXPO_PUBLIC_COMMAND_ID'];

console.log('\n🔐 GOGOMA — Migração de Segurança: AES → SHA-256\n');

if (!CRYPTO_KEY || !COMMAND_ID) {
    console.error('❌ Variáveis de ambiente não encontradas!');
    process.exit(1);
}

console.log(`✅ CRYPTO_KEY carregada (${CRYPTO_KEY.length} chars)`);
console.log(`✅ COMMAND_ID: ${COMMAND_ID}\n`);

// Configuração Firebase (Web)
const firebaseConfig = {
    apiKey:            env['EXPO_PUBLIC_FIREBASE_API_KEY_WEB'],
    authDomain:        env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'],
    projectId:         env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'],
    storageBucket:     env['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'],
    messagingSenderId: env['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
    appId:             env['EXPO_PUBLIC_FIREBASE_APP_ID_WEB'],
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);

async function migrate() {
    try {
        const docRef  = doc(db, 'comando_universal', 'credenciais');
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.error('❌ Documento comando_universal/credenciais não existe!');
            console.log('\n📋 Solução: Cria manualmente no Firebase Console o documento');
            console.log('   Coleção: comando_universal');
            console.log('   Documento: credenciais');
            console.log('   Com os campos mostrados abaixo.\n');
            printManualSteps();
            return;
        }

        const data = docSnap.data();
        console.log('✅ Documento encontrado.\n');

        // Verificar se já foi migrado
        if (data.badgeHash && data.passwordHash) {
            console.log('✅ Migração JÁ FOI FEITA! O sistema já usa SHA-256.');
            console.log(`   badgeHash:    ${data.badgeHash.substring(0, 16)}...`);
            console.log(`   passwordHash: ${data.passwordHash.substring(0, 16)}...`);
            return;
        }

        // Desencriptar a senha AES atual
        if (!data.encryptedPassword) {
            console.log('ℹ️  Não encontrou encryptedPassword. A gerar hashes diretamente.\n');
            printManualSteps();
            return;
        }

        let plainPassword;
        try {
            const bytes = CryptoJS.AES.decrypt(data.encryptedPassword, CRYPTO_KEY);
            plainPassword = bytes.toString(CryptoJS.enc.Utf8);
            if (!plainPassword) throw new Error('Desencriptação retornou string vazia');
            console.log(`✅ Senha desencriptada com sucesso (${plainPassword.length} chars).`);
        } catch (e) {
            console.error('❌ Erro ao desencriptar:', e.message);
            console.log('\nℹ️  Vou calcular os hashes para inserção manual:\n');
            printManualSteps();
            return;
        }

        // Calcular hashes SHA-256
        const badgeHash    = CryptoJS.SHA256(COMMAND_ID).toString(CryptoJS.enc.Hex);
        const passwordHash = CryptoJS.SHA256(plainPassword).toString(CryptoJS.enc.Hex);

        console.log('🔒 Hashes SHA-256 gerados:');
        console.log(`   badgeHash:    ${badgeHash.substring(0, 32)}...`);
        console.log(`   passwordHash: ${passwordHash.substring(0, 32)}...`);

        // Tentar escrever
        console.log('\n📝 A tentar atualizar Firestore...');
        try {
            await updateDoc(docRef, {
                badgeHash,
                passwordHash,
                algoritmo: 'SHA-256',
                migradoEm: new Date().toISOString(),
                // Manter AES como fallback durante transição
                encryptedPassword: data.encryptedPassword,
            });
            console.log('\n✅ ✅ ✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO! ✅ ✅ ✅');
            console.log('   O Firestore agora usa SHA-256 — sem chave secreta exposta.');
        } catch (writeErr) {
            console.error('\n⚠️  Não foi possível escrever (regras de segurança ativas).');
            console.log('\n📋 COPIA ESTES VALORES E COLA NO FIREBASE CONSOLE MANUALMENTE:');
            console.log('   Caminho: comando_universal → credenciais');
            console.log('   (Clica em "Editar documento" e adiciona os campos)\n');
            console.log(`   badgeHash    = "${badgeHash}"`);
            console.log(`   passwordHash = "${passwordHash}"`);
            console.log(`   algoritmo    = "SHA-256"`);
            console.log(`   migradoEm    = "${new Date().toISOString()}"`);
            console.log('\n   Depois é só guardar — o sistema começa a usar SHA-256 automaticamente.');
        }
    } catch (err) {
        console.error('❌ Erro geral:', err.message);
        printManualSteps();
    }

    process.exit(0);
}

function printManualSteps() {
    const badgeHash    = CryptoJS.SHA256(COMMAND_ID).toString(CryptoJS.enc.Hex);
    console.log('📋 PASSOS MANUAIS NO FIREBASE CONSOLE:');
    console.log('   1. Abre: https://console.firebase.google.com/project/gogoma-2/firestore');
    console.log('   2. Vai a: comando_universal → credenciais');
    console.log('   3. Clica em "Editar documento"');
    console.log('   4. Adiciona estes campos:\n');
    console.log(`   badgeHash    = "${badgeHash}"`);
    console.log(`   passwordHash = "(hash SHA-256 da tua senha atual)"`);
    console.log(`   algoritmo    = "SHA-256"`);
}

migrate();
