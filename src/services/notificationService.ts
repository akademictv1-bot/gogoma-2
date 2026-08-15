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
        shouldShowBanner: true,
        shouldShowList: true
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
            projectId: '4602389c-b12e-46d5-96b1-e03713ad4468' // ID do projeto Expo em app.json
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

export const saveCitizenToken = async (phoneNumber: string, token: string) => {
    try {
        await setDoc(doc(db, 'citizenTokens', phoneNumber), {
            token,
            phoneNumber,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (error) {
        // Ignora erro ao salvar token
    }
};

const sendPushToTokens = async (title: string, body: string, collectionPath: string) => {
    try {
        const BATCH_SIZE = 500;
        const tokensSnapshot = await getDocs(collection(db, collectionPath));
        const allTokens = tokensSnapshot.docs.map(doc => doc.data().token);

        if (allTokens.length === 0) return;

        // Envia em lotes para evitar timeout e limites de taxa
        for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
            const batch = allTokens.slice(i, i + BATCH_SIZE);
            const messages = batch.map(token => ({
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
        }
    } catch (error) {
        console.error("Erro ao enviar notificações push:", error);
    }
};

export const sendPushNotification = async (title: string, body: string) => {
    await sendPushToTokens(title, body, 'operatorTokens');
};

export const sendPushToCitizens = async (title: string, body: string) => {
    await sendPushToTokens(title, body, 'citizenTokens');
};
