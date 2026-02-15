import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, setDoc, doc } from 'firebase/firestore';

// Configuração básica do comportamento da notificação (quando o app está aberto)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const registerForPushNotificationsAsync = async () => {
    let token;
    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            return;
        }
        token = (await Notifications.getExpoPushTokenAsync({
            projectId: '5426e25c-89a3-4b6c-b3a5-8e36d80989f6' // ID do projeto Expo (slug gogoma)
        })).data;
    }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return token;
};

export const saveOperatorToken = async (id: string, token: string) => {
    try {
        await setDoc(doc(db, 'operatorTokens', id), {
            token,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (error) {
        // Ignora erro ao salvar token
    }
};

export const sendPushNotification = async (title: string, body: string) => {
    try {
        const tokensSnapshot = await getDocs(collection(db, 'operatorTokens'));
        const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

        if (tokens.length === 0) return;

        const messages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title: title,
            body: body,
            data: { someData: 'goes here' },
        }));

        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });
    } catch (error) {
        // Ignora erro ao enviar notificação
    }
};
