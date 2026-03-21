import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { audioManager, playAlarmWithRetry } from './AudioManager';
import { AlertStatus, EmergencyAlert } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class AlarmMonitor {
    private monitorInterval: number = 5000;
    private isRunning: boolean = false;

    constructor() {
        // O monitor será iniciado manualmente pelo PoliceScreen para garantir contexto de áudio
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("[AlarmMonitor] Iniciando monitoramento contínuo...");
        this.run();
    }

    stop() {
        this.isRunning = false;
    }

    private async run() {
        while (this.isRunning) {
            try {
                await this.checkAlarms();
            } catch (err) {
                console.error("[AlarmMonitor] Erro no ciclo de monitoramento:", err);
            }
            await delay(this.monitorInterval);
        }
    }

    private async checkAlarms() {
        const qNew = query(collection(db, 'emergencias'), where('status', '==', AlertStatus.NEW));
        const qDispatch = query(collection(db, 'emergencias'), where('status', '==', AlertStatus.IN_PROGRESS));

        const [snapNew, snapDispatch] = await Promise.all([
            getDocs(qNew),
            getDocs(qDispatch)
        ]);

        for (const docSnap of snapNew.docs) {
            const data = docSnap.data() as EmergencyAlert;
            await this.validateAlarmState(docSnap.id, data);
        }

        for (const docSnap of snapDispatch.docs) {
            const data = docSnap.data() as EmergencyAlert;
            await this.validateAlarmState(docSnap.id, data);
        }
    }

    async validateAlarmState(pedidoId: string, pedidoData: EmergencyAlert) {
        const agora = Date.now();
        const ultimoAlarme = pedidoData.timestamp_ultimo_alarme || pedidoData.timestamp;
        const tempoDecorrido = agora - ultimoAlarme;
        const isFirstTime = (pedidoData.contador_toques || 0) === 0;

        // Se status é NOVO e (é a primeira vez OU passou 1 minuto)
        if (pedidoData.status === AlertStatus.NEW && (isFirstTime || tempoDecorrido >= 60000)) {
            console.log(`[AlarmMonitor] Ativando alarme para pedido NOVO: ${pedidoId} (First: ${isFirstTime})`);
            await this.playAlarmSequence(pedidoId);
        }

        // Se status é EM TRÂNSITO (Despachado) e passou 30 min (1.800.000ms)
        if (pedidoData.status === AlertStatus.IN_PROGRESS) {
            const tempoDespacho = agora - (pedidoData.timestamp_despacho || pedidoData.dataAtualizacao || agora);
            if (tempoDespacho >= 30 * 60 * 1000) {
                // Se ainda não foi silenciado ou o silêncio expirou
                if (!pedidoData.estado_alarme?.despacho_silenciado) {
                   console.log(`[AlarmMonitor] Alerta STALE (30min+): ${pedidoId}. Reativando avisos.`);
                   await audioManager.addAlarmToQueue(pedidoId, "warning");
                }
            }
        }
    }

    async playAlarmSequence(pedidoId: string) {
        // Tocar 3 vezes seguidas com delay de 500ms
        for (let i = 1; i <= 3; i++) {
            const pedidoRef = doc(db, 'emergencias', pedidoId);
            
            // Atualizar Firestore: tocando = true
            await updateDoc(pedidoRef, {
                contador_toques: increment(1),
                timestamp_ultimo_alarme: Date.now(),
                "estado_alarme.tocando": true
            });

            await playAlarmWithRetry(pedidoId, "emergency");
            await delay(500);
        }

        // Finalizou a sequência de 3
        const pedidoRef = doc(db, 'emergencias', pedidoId);
        await updateDoc(pedidoRef, {
                "estado_alarme.tocando": false,
                "estado_alarme.alarmes_completados": increment(1)
        });
    }
}

export const alarmMonitor = new AlarmMonitor();
