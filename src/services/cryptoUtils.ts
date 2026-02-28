/**
 * cryptoUtils.ts
 * Utilitários de criptografia AES-256 e validação de números de Moçambique.
 *
 * ATENÇÃO: A chave secreta NUNCA deve ser hardcoded em produção.
 * Use a variável de ambiente: EXPO_PUBLIC_CRYPTO_KEY
 */
import CryptoJS from 'crypto-js';

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

/** Prefixos válidos para operadoras moçambicanas (Vodacom, Tmcel, Movitel) */
const MOZAMBIQUE_PREFIXES = ['82', '83', '84', '85', '86', '87'];

/** Comprimento exacto do número local (sem código do país) */
const MOZAMBIQUE_PHONE_LENGTH = 9;

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
 * @param secretKey - Chave secreta (≥32 caracteres recomendado)
 * @returns String encriptada (base64-encoded ciphertext)
 */
export const encryptValue = (plainText: string, secretKey: string): string => {
    return CryptoJS.AES.encrypt(plainText, secretKey).toString();
};

/**
 * Desencripta um valor encriptado com AES-256.
 * @param cipherText - Valor encriptado (retornado por encryptValue)
 * @param secretKey - Mesma chave secreta usada na encriptação
 * @returns Texto original
 */
export const decryptValue = (cipherText: string, secretKey: string): string => {
    const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Encripta as credenciais universais (ID + senha).
 * @param id       - ID universal (ex: "PRM_9922")
 * @param password - Senha universal (ex: "Gogoma@2024")
 * @param secretKey - Chave secreta AES
 */
export const encryptCredentials = (
    id: string,
    password: string,
    secretKey: string
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
 * @param secretKey         - Chave secreta AES
 */
export const decryptCredentials = (
    encryptedId: string,
    encryptedPassword: string,
    secretKey: string
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
    password: string,
    secretKey: string
): Record<string, string> => {
    const { encryptedId, encryptedPassword } = encryptCredentials(id, password, secretKey);
    return {
        encryptedId,
        encryptedPassword,
        algoritmo: 'AES-256',
        criadoEm: new Date().toISOString(), // Use serverTimestamp() se inserir via SDK admin
    };
};
