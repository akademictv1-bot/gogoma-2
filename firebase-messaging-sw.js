// Scripts do Firebase dentro do Service Worker
// Scripts do Firebase dentro do Service Worker
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

messaging.onBackgroundMessage((payload) => {
  if (payload.notification) {
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: payload.notification.icon || '/icon.png',
      vibrate: [200, 100, 200],
      data: payload.data
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(self.location.origin)
  );
});