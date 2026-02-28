import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let alarmInterval: NodeJS.Timeout | null = null;
let beepTimeoutIds: NodeJS.Timeout[] = [];
let isAudioUnlocked = Platform.OS !== 'web';
let isAlarmActive = false;

// Som pré-carregado para latência zero
let preloadedSound: Audio.Sound | null = null;

const ALARM_URI = 'https://raw.githubusercontent.com/freeCodeCamp/cdn/master/build/testable-projects-fcc/audio/BeepSound.wav';

/**
 * Pré-carrega o áudio para que o "primeiro segundo" seja instantâneo.
 */
const preloadAlarm = async () => {
    try {
        if (preloadedSound) return;
        const { sound } = await Audio.Sound.createAsync(
            { uri: ALARM_URI },
            { shouldPlay: false, volume: 1.0 }
        );
        preloadedSound = sound;
    } catch (e) {
        console.error("Erro ao pré-carregar som:", e);
    }
};
preloadAlarm();

/**
 * No Web, navegadores bloqueiam som automático.
 * Deve ser chamada num evento de clique direto do usuário.
 */
export const unlockAudio = async () => {
    if (Platform.OS !== 'web' || isAudioUnlocked) return;
    try {
        await preloadAlarm();
        if (preloadedSound) {
            await preloadedSound.playAsync();
            await preloadedSound.stopAsync();
            isAudioUnlocked = true;
        }
    } catch (error) {
        // Ignora falha silenciosa
    }
};

/**
 * Executa UM ÚNICO padrão "beep-beep-beep-beep-beep" (5 bips) de forma ultra-robusta.
 */
const playBeepPattern = async () => {
    if (Platform.OS === 'web' && !isAudioUnlocked) return;

    try {
        if (!preloadedSound) await preloadAlarm();
        if (!preloadedSound) return;

        // Limpar timeouts pendentes antes de iniciar novo padrão
        beepTimeoutIds.forEach(id => clearTimeout(id));
        beepTimeoutIds = [];

        const play = async () => {
            try {
                await preloadedSound!.stopAsync().catch(() => { });
                await preloadedSound!.playAsync().catch(() => { });
            } catch (e) { /* ignore */ }
        };

        // Padrão de 5 bips (Urgência Elite)
        // Bip 1 (Garante o primeiro milissegundo)
        await play();

        const scheduleBip = (delay: number) => {
            const id = setTimeout(play, delay);
            beepTimeoutIds.push(id);
        };

        scheduleBip(400);  // Bip 2
        scheduleBip(800);  // Bip 3
        scheduleBip(1200); // Bip 4
        scheduleBip(1600); // Bip 5

    } catch (error) {
        console.error("Erro no playback elite:", error);
    }
};

/**
 * Toca um bip imediato avulso (Som Elite - 1º Segundo).
 */
export const playImmediateBeep = async () => {
    await playBeepPattern();
};

/**
 * Inicia o ciclo de alarme:
 */
export const startAlarm = async () => {
    if (isAlarmActive) {
        // Se já está ativo, garante pelo menos um bip imediato para sinalizar novo alerta
        await playBeepPattern();
        return;
    }

    isAlarmActive = true;

    // Primeiro disparo imediato
    await playBeepPattern();

    // Repetir a cada 3 minutos (180.000ms) conforme pedido final de produção
    alarmInterval = setInterval(async () => {
        if (isAlarmActive) {
            await playBeepPattern();
        }
    }, 180000);
};

/**
 * Para o alarme imediatamente e limpa tudo.
 */
export const stopAlarm = async () => {
    isAlarmActive = false;

    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }

    beepTimeoutIds.forEach(id => clearTimeout(id));
    beepTimeoutIds = [];
};

/**
 * Retorna se o alarme está activo.
 */
export const isAlarmRunning = () => isAlarmActive;
