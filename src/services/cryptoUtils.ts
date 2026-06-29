/**
 * cryptoUtils.ts
 * Utilitários de criptografia e validação para o sistema GOGOMA.
 *
 * - hashValue(): SHA-256 sem chave secreta — seguro para autenticação web/mobile
 * - encryptValue()/decryptValue(): AES-256 para dados em trânsito (uso interno)
 * - validateMozambiquePhone(): validação de números moçambicanos
 */
import CryptoJS from 'crypto-js';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────

/** Prefixos válidos para operadoras moçambicanas (Vodacom, Tmcel, Movitel) */
const MOZAMBIQUE_PREFIXES = ['82', '83', '84', '85', '86', '87'];

/** Comprimento exacto do número local (sem código do país) */
const MOZAMBIQUE_PHONE_LENGTH = 9;

/** Obter chave de ambiente - Requerida em produção */
const getCryptoKey = (): string | undefined => {
    return process.env.EXPO_PUBLIC_CRYPTO_KEY;
};

/** Verificar se chave está configurada */
export const isCryptoKeyConfigured = (): boolean => {
    const key = getCryptoKey();
    return !!(key && key.length >= 16);
};

// ─────────────────────────────────────────────
// Hashing SHA-256 (Autenticação Segura)
// ─────────────────────────────────────────────

/**
 * Gera um hash SHA-256 de um valor.
 * Não requer chave secreta — seguro para usar na Web sem exposição.
 * Usado para verificar credenciais do Comando (badgeId e password).
 * @param value - Valor a transformar em hash
 * @returns String hexadecimal do hash SHA-256
 */
export const hashValue = (value: string): string => {
    return CryptoJS.SHA256(value).toString(CryptoJS.enc.Hex);
};

// ─────────────────────────────────────────────
// Validação de Telefone
// ─────────────────────────────────────────────

/**
 * Valida se um número de telemóvel é moçambicano.
 * Regras:
 *  - Exatamente 9 dígitos
 *  - Começa com 82, 83, 84, 85, 86 ou 87
 */
export const validateMozambiquePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== MOZAMBIQUE_PHONE_LENGTH) return false;
    const prefix = cleaned.substring(0, 2);
    return MOZAMBIQUE_PREFIXES.includes(prefix);
};

// ─────────────────────────────────────────────
// Criptografia AES-256
// ─────────────────────────────────────────────

/**
 * Encripta um valor em texto claro usando AES-256.
 * @param plainText - Valor a encriptar
 * @param secretKey - Chave secreta (≥16 caracteres)
 * @returns String encriptada (base64-encoded ciphertext)
 */
export const encryptValue = (plainText: string, secretKey?: string): string => {
    const key = secretKey || getCryptoKey();
    if (!key) {
        throw new Error('CRYPTO_KEY não configurada. Defina EXPO_PUBLIC_CRYPTO_KEY no .env.local');
    }
    return CryptoJS.AES.encrypt(plainText, key).toString();
};

/**
 * Desencripta um valor encriptado com AES-256.
 * @param cipherText - Valor encriptado (retornado por encryptValue)
 * @param secretKey - Mesma chave secreta usada na encriptação
 * @returns Texto original ou string vazia se falhar
 */
export const decryptValue = (cipherText: string, secretKey?: string): string => {
    const key = secretKey || getCryptoKey();
    if (!key) {
        console.warn('[cryptoUtils] CRYPTO_KEY não configurada');
        return '';
    }
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
        return '';
    }
};

/**
 * Encripta as credenciais universais (ID + senha).
 * @param id       - ID universal (ex: "PRM_9922")
 * @param password - Senha universal (ex: "Gogoma@2024")
 * @param secretKey - Chave secreta AES (opcional - usa getCryptoKey se não passado)
 */
export const encryptCredentials = (
    id: string,
    password: string,
    secretKey?: string
): { encryptedId: string; encryptedPassword: string } => {
    return {
        encryptedId: encryptValue(id, secretKey),
        encryptedPassword: encryptValue(password, secretKey),
    };
};

/**
 * Desencripta as credenciais universais.
 * @param encryptedId       - ID encriptado
 * @param encryptedPassword - Senha encriptada
 * @param secretKey         - Chave secreta AES (opcional)
 */
export const decryptCredentials = (
    encryptedId: string,
    encryptedPassword: string,
    secretKey?: string
): { id: string; password: string } => {
    return {
        id: decryptValue(encryptedId, secretKey),
        password: decryptValue(encryptedPassword, secretKey),
    };
};

/**
 * Gera o objeto pronto para colar no Firestore
 * (coleção: comando_universal, documento: credenciais).
 *
 * Uso em ambiente Node.js ou admin:
 *   const data = generateFirestoreCredentials('PRM_9922', 'Gogoma@2024', process.env.EXPO_PUBLIC_CRYPTO_KEY!);
 */
export const generateFirestoreCredentials = (
    id: string,
    password: string
): Record<string, string> => {
    const key = getCryptoKey();
    if (!key) {
        throw new Error('CRYPTO_KEY não configurada. Defina EXPO_PUBLIC_CRYPTO_KEY no .env.local');
    }
    const { encryptedId, encryptedPassword } = encryptCredentials(id, password, key);
    return {
        encryptedId,
        encryptedPassword,
        algoritmo: 'AES-256',
        criadoEm: new Date().toISOString(),
    };
};
