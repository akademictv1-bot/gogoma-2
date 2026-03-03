# GOGOMA — Sistema de Gestão de Ocorrências Municipais

<div align="center">
<img width="1200" height="475" alt="GOGOMA Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Sobre o Projeto

O **GOGOMA** é uma plataforma de emergência municipal que liga cidadãos em situação de risco à Central de Comando da Polícia da República de Moçambique (PRM). O sistema permite:

- 🚨 **Envio de SOS imediato** com localização GPS e fotos como evidência
- 📡 **Painel de Comando em tempo real** para operadores da PRM
- 🔐 **Autenticação segura** para o acesso ao centro de controlo
- 🔔 **Alertas sonoros** automáticos para novas ocorrências

---

## Tecnologias

- **React Native + Expo (SDK 50)** — App para Android, iOS e Web
- **Firebase Firestore** — Base de dados em tempo real
- **Firebase Storage** — Armazenamento de evidências fotográficas
- **TypeScript** — Código seguro e bem tipado

---

## Como Executar Localmente

**Pré-requisitos:** Node.js e Expo CLI

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
# Crie um ficheiro .env.local com as seguintes variáveis:
# EXPO_PUBLIC_COMMAND_ID=<id_do_operador>
# EXPO_PUBLIC_CRYPTO_KEY=<chave_de_encriptacao>

# 3. Iniciar o servidor de desenvolvimento
npx expo start -c
```

---

## Segurança

- As credenciais de acesso ao Comando são protegidas por encriptação AES-256.
- O ID do operador é armazenado localmente via variáveis de ambiente.
- A palavra-passe é encriptada e guardada no Firebase Firestore.

---

## Licença

Projeto desenvolvido para uso institucional da PRM — Mozambique.
