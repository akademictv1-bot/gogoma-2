import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let alarmSound: Audio.Sound | null = null;
let alarmInterval: NodeJS.Timeout | null = null;
let autoStopTimeout: NodeJS.Timeout | null = null;
let beepTimeoutIds: NodeJS.Timeout[] = [];
let isAudioUnlocked = Platform.OS !== 'web'; // No Mobile já é desbloqueado por padrão

// URL extremamente estável (freeCodeCamp CDN) - Verificada com 200 OK
const ALARM_URI = 'https://raw.githubusercontent.com/freeCodeCamp/cdn/master/build/testable-projects-fcc/audio/BeepSound.wav';

/**
 * No Web, navegadores bloqueiam som automático (Auto-play policy). 
 * Esta função DEVE ser chamada em um evento de clique direto do usuário (ex: ao clicar no botão de Login).
 */
export const unlockAudio = async () => {
    if (Platform.OS !== 'web' || isAudioUnlocked) return;

    try {
        // Tenta tocar um som curto e quase silencioso para ganhar a permissão do navegador
        const { sound } = await Audio.Sound.createAsync(
            { uri: ALARM_URI },
            { shouldPlay: true, volume: 0.001 }
        );

        await sound.unloadAsync();
        isAudioUnlocked = true;
    } catch (error) {
        // Ignora falha de áudio se não houver interação
    }
};

/**
 * Toca o padrão "beep-beep-beep" do alarme.
 * No Web, se o áudio não foi desbloqueado, apenas loga um aviso para evitar erros críticos.
 */
const playBeepPattern = async () => {
    if (Platform.OS === 'web' && !isAudioUnlocked) {
        return;
    }

    try {

        const executeBeep = async () => {
            const { sound } = await Audio.Sound.createAsync(
                { uri: ALARM_URI },
                { shouldPlay: true, volume: 1.0 }
            );

            // Define o descarregamento automático após o término
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        };

        // Padrão: Beep -> 600ms -> Beep -> 1200ms -> Beep
        await executeBeep();
        beepTimeoutIds.push(setTimeout(executeBeep, 600));
        beepTimeoutIds.push(setTimeout(executeBeep, 1200));

    } catch (error) {
        // Evita spam de erro 404 se a rede falhar
    }
};

/**
 * Toca o padrão "beep-beep-beep" do alarme imediatamente.
 * Pode ser chamada várias vezes se novos alertas chegarem.
 */
export const playImmediateBeep = async () => {
    await playBeepPattern();
};

/**
 * Inicia o loop do alarme (repetindo a cada 60 segundos).
 */
export const startAlarm = async () => {
    if (alarmInterval) return; // Já está rodando

    // Toca o primeiro conjunto de beeps imediatamente
    await playBeepPattern();

    // Repete a cada 60 segundos conforme regra de negócio
    alarmInterval = setInterval(playBeepPattern, 60000);

    // Auto-stop após 1 hora para segurança e economia de recursos
    autoStopTimeout = setTimeout(() => {
        stopAlarm();
    }, 3600000);
};

/**
 * Para imediatamente qualquer som e limpa os intervalos.
 */
export const stopAlarm = async () => {
    if (!alarmInterval && !alarmSound) return;

    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }

    if (autoStopTimeout) {
        clearTimeout(autoStopTimeout);
        autoStopTimeout = null;
    }

    // Limpar timeouts de beeps internos pendentes
    beepTimeoutIds.forEach(id => clearTimeout(id));
    beepTimeoutIds = [];

    if (alarmSound) {
        try {
            await alarmSound.stopAsync();
            await alarmSound.unloadAsync();
            alarmSound = null;
        } catch (error) {
            // Ignora erros ao parar som se ele já tiver sido descarregado
        }
    }
};
