const CryptoJS = require('crypto-js');

const SECRET_KEY = "WjH9lM4eN2aU7sK0oR5cT8vX"; // Sua chave do .env.local
const PASSWORD_REAL = "Gogoma@2024"; // A senha que você quer usar

const encryptedPassword = CryptoJS.AES.encrypt(PASSWORD_REAL, SECRET_KEY).toString();

console.log("\n==================================================");
console.log("SUA SENHA ENCRIPTADA PARA O FIRESTORE:");
console.log("==================================================");
console.log(encryptedPassword);
console.log("==================================================\n");
console.log("COMO COLOCAR NO FIREBASE:");
console.log("1. No Firestore, vá em: comando_universal -> credenciais");
console.log("2. Clique em 'Add Field' (ou edite o existente)");
console.log("3. Nome do campo: encryptedPassword");
console.log("4. Tipo: string");
console.log("5. Valor: Cole o código acima");
console.log("==================================================\n");
