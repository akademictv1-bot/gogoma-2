import { Platform, Linking, Vibration } from 'react-native';
import { Audio } from 'expo-av';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class AudioManager {
    private activeAlarms: Map<string, any>;
    private audioQueue: any[];
    private maxConcurrentAlarms: number;
    private audioContext: AudioContext | null;
    private nativeSound: Audio.Sound | null = null;
    private activeOscillators: OscillatorNode[] = [];

    constructor() {
        this.activeAlarms = new Map();
        this.audioQueue = [];
        this.maxConcurrentAlarms = 3;
        this.audioContext = null;
    }

    async resumeContext() {
        if (Platform.OS === 'web') {
            if (!this.audioContext || this.audioContext.state === 'closed') {
                // @ts-ignore
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } else {
            // No Mobile, garantir permissões e modo de áudio
            try {
                await Audio.setAudioModeAsync({
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false
                });
            } catch (e) {}
        }
    }

    async addAlarmToQueue(pedidoId: string, alarmType: string) {
        this.audioQueue.push({
            pedidoId,
            alarmType,
            timestamp: Date.now(),
            tentativas: 0
        });
        await this.processQueue();
    }

    async processQueue() {
        if (this.audioQueue.length === 0) return;
        
        if (this.activeAlarms.size < this.maxConcurrentAlarms) {
            const alarm = this.audioQueue.shift();
            if (alarm) {
                await this.playAlarm(alarm.pedidoId, alarm.alarmType);
                setTimeout(() => this.processQueue(), 2500);
            }
        }
    }

    async playAlarm(pedidoId: string, alarmType: string) {
        this.activeAlarms.set(pedidoId, {
            state: "tocando",
            startTime: Date.now(),
            type: alarmType
        });

        try {
            await this.playSound(alarmType);
            this.activeAlarms.delete(pedidoId);
        } catch (error) {
            console.error(`[AudioManager] Erro no alarme ${pedidoId}:`, error);
            this.activeAlarms.delete(pedidoId);
            await this.useFallback(pedidoId);
        }
    }

    async playSound(alarmType: string) {
        if (Platform.OS === 'web') {
            await this.playWebSound(alarmType);
        } else {
            await this.playMobileSound(alarmType);
        }
    }

    private async playMobileSound(alarmType: string) {
        try {
            // Em mobile, usamos som pré-gravado do sistema ou um asset (implementando buzzer padrão)
            if (this.nativeSound) {
                await this.nativeSound.unloadAsync();
            }
            
            // Aqui poderíamos carregar um asset (ex: require('../assets/siren.mp3'))
            // Por agora, usamos um fallback de sistema ou vibração potente
            Vibration.vibrate(alarmType === 'emergency' ? [500, 200, 500, 200, 500] : 500);
            
            // Simulação de som completado
            await delay(1200);
        } catch (e) {
            console.error("[AudioManager] Erro áudio mobile:", e);
        }
    }

    private async playWebSound(alarmType: string) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            // @ts-ignore
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const ctx = this.audioContext!;
        if (ctx.state === 'suspended') await ctx.resume();

        const now = ctx.currentTime;
        const duration = alarmType === 'emergency' ? 1.2 : 2.0;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        try {
            if (alarmType === 'emergency') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.6);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.9);
                osc.frequency.exponentialRampToValueAtTime(600, now + duration);
                
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
                gain.gain.linearRampToValueAtTime(0.35, now + duration - 0.1);
                gain.gain.linearRampToValueAtTime(0.01, now + duration);
            } else {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
            }

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + duration);
            this.activeOscillators.push(osc);
            
            await delay(duration * 1000);
        } finally {
            this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
            try { osc.disconnect(); } catch (_) {}
            try { gain.disconnect(); } catch (_) {}
        }
    }

    async playTestSound(alarmType: string = 'emergency') {
        // Método específico para o botão "TESTAR SOM" — NÃO regista em activeOscillators
        // para não ser morto pelo stopAllAlarms() do AlarmMonitor
        if (Platform.OS === 'web') {
            try {
                const ctx = this.audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
                if (ctx.state === 'suspended') await ctx.resume();
                const now = ctx.currentTime;
                const duration = alarmType === 'emergency' ? 1.2 : 2.0;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                if (alarmType === 'emergency') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
                    osc.frequency.exponentialRampToValueAtTime(600, now + 0.6);
                    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.9);
                    osc.frequency.exponentialRampToValueAtTime(600, now + duration);
                    gain.gain.setValueAtTime(0.01, now);
                    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
                    gain.gain.linearRampToValueAtTime(0.35, now + duration - 0.1);
                    gain.gain.linearRampToValueAtTime(0.01, now + duration);
                } else {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    gain.gain.setValueAtTime(0.3, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
                }
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + duration);
                await delay(duration * 1000);
                try { osc.disconnect(); } catch (_) {}
                try { gain.disconnect(); } catch (_) {}
            } catch (e) {
                console.error('[AudioManager] Erro no teste de som:', e);
            }
        } else {
            Vibration.vibrate(alarmType === 'emergency' ? [500, 200, 500, 200, 500] : 500);
        }
    }

    async playSuccessSound(durationMs: number = 1000) {
        if (Platform.OS === 'web') {
            try {
                const ctx = this.audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
                if (ctx.state === 'suspended') await ctx.resume();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.setValueAtTime(1200, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (durationMs/1000));
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(); await delay(durationMs);
                try { osc.disconnect(); } catch (_) {}
                try { gain.disconnect(); } catch (_) {}
            } catch (e) {
                console.error('[AudioManager] Erro no som de sucesso:', e);
            }
        } else {
            Vibration.vibrate(200);
        }
    }

    stopAlarm(pedidoId: string) {
        this.activeAlarms.delete(pedidoId);
        this.forceStopActiveSounds();
    }

    stopAllAlarms() {
        this.activeAlarms.clear();
        this.audioQueue = [];
        this.forceStopActiveSounds();
    }

    private forceStopActiveSounds() {
        this.activeOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
        });
        this.activeOscillators = [];
        if (Platform.OS !== 'web') {
            Vibration.cancel();
        }
    }

    async useFallback(pedidoId: string) {
        if (Platform.OS === 'web') {
            if (navigator.vibrate) navigator.vibrate([500, 100, 500]);
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("EMERGÊNCIA!", { body: "Novo SOS - Verifique a Central", tag: pedidoId });
            }
            this.flashScreen();
        } else {
            Vibration.vibrate([500, 200, 500]);
        }
    }

    private flashScreen() {
        if (Platform.OS !== 'web') return;
        try {
            const overlay = document.createElement("div");
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'red', opacity: '0.7', zIndex: '9999', pointerEvents: 'none'
            });
            document.body.appendChild(overlay);
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => document.body.removeChild(overlay), 500);
            }, 300);
        } catch (e) {}
    }
}

export const audioManager = new AudioManager();

export const playAlarmWithRetry = async (pedidoId: string, alarmType: string = "emergency", maxRetries: number = 3) => {
    for (let i = 1; i <= maxRetries; i++) {
        try {
            await audioManager.playAlarm(pedidoId, alarmType);
            return true;
        } catch (error) {
            if (i < maxRetries) await delay(500);
        }
    }
    await audioManager.useFallback(pedidoId);
    return false;
};
