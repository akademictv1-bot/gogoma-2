// Service Worker Firebase Messaging — GOGOMA Web Command Panel
//
// IMPORTANTE: O painel web usa alarme sonoro interno (AudioManager).
// Notificações nativas do SO (macOS, Windows) são DESATIVADAS intencionalmente
// para não criar pop-ups na área de notificações do computador do operador.
// As notificações push nativas só fazem sentido na app móvel (iOS/Android).

importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAiCRqKono7N2KxkCGpPD9lAlHRx-AUGKY",
  authDomain: "gogoma-2.firebaseapp.com",
  databaseURL: "https://gogoma-2-default-rtdb.firebaseio.com",
  projectId: "gogoma-2",
  storageBucket: "gogoma-2.firebasestorage.app",
  messagingSenderId: "50833835620",
  appId: "1:50833835620:web:c63b6def7f1ccc23ad8171"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Mensagens em background são recebidas mas NÃO mostradas como notificações do SO.
// O AlarmMonitor no painel deteta novas emergências via Firestore em tempo real
// e toca o alarme sonoro interno — sem popups no macOS/Windows.
messaging.onBackgroundMessage((_payload) => {
  // Silenciosamente ignorado — sem notificações nativas no web
  return;
});

// Handler de clique mantido por compatibilidade, mas não será acionado
// pois as notificações não são mostradas.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(self.location.origin)
  );
});