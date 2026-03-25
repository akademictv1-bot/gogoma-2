import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { audioManager, playAlarmWithRetry } from './AudioManager';
import { AlertStatus, EmergencyAlert } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════════════════════════
//  ARQUITECTURA: ALARME GLOBAL (Global Alarm State Machine)
//
//  Princípio: 1 alarme único → sinal de "há emergências activas"
//  Nunca 1 alarme por pedido — isso não escala e não faz sentido do
//  ponto de vista de UX (o operador ouve UM sinal, não 1000).
//
//  REGRAS:
//  1. Sem pedidos NEW nem stale  →  SEM SOM
//  2. ≥1 pedido NEW entra        →  alarme toca em ≤ 1 s
//  3. Ignorado 60 s              →  volta a tocar
//  4. Despachar todos            →  SEM SOM por 30 min
//  5. ≥1 stale (>30 min)         →  volta a tocar
//  6. Resolver o último          →  SEM SOM definitivo
//
//  ESCALABILIDADE:
//  - Com 1000 pedidos: 2 queries Firestore por ciclo (getDocs NEW + IN_PROGRESS)
//  - Zero writes durante alarme (só reads)
//  - Cada ciclo demora ~50-200 ms independentemente do nº de pedidos
//  - Writes apenas ao Despachar/Resolver (feitos pelo PoliceScreen)
// ═══════════════════════════════════════════════════════════════════

type AlarmState = 'IDLE' | 'PLAYING' | 'COOLDOWN';

class AlarmMonitor {
    private monitorInterval: number = 1000; // 1 s — reage a novos pedidos em ≤ 1 s
    private isRunning: boolean = false;
    private alarmState: AlarmState = 'IDLE';

    // Controlo de tempo global — sem writes no Firestore
    private lastAlarmPlayedAt: number = 0;
    private readonly REPEAT_INTERVAL_MS = 60_000; // 60 s entre repetições
    private readonly STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastAlarmPlayedAt = 0;
        this.run();
    }

    stop() {
        this.isRunning = false;
        this.alarmState = 'IDLE';
        audioManager.stopAllAlarms();
    }

    private async run() {
        while (this.isRunning) {
            try {
                await this.checkGlobalAlarmState();
            } catch (err) {
                console.error('[AlarmMonitor] Erro no ciclo:', err);
            }
            await delay(this.monitorInterval);
        }
    }

    private async checkGlobalAlarmState() {
        // ── PASSO 1: Buscar estado actual dos pedidos (2 queries, qualquer volume) ──
        const [snapNew, snapDispatch] = await Promise.all([
            getDocs(query(collection(db, 'emergencias'), where('status', '==', AlertStatus.NEW))),
            getDocs(query(collection(db, 'emergencias'), where('status', '==', AlertStatus.IN_PROGRESS))),
        ]);

        const agora = Date.now();

        // ── PASSO 2: Verificar se há pedidos stale (>30 min despachados sem conclusão) ──
        // Feito com .some() — para na primeira ocorrência, eficiente mesmo com 1000 docs
        const hasStaleDispatch = snapDispatch.docs.some(docSnap => {
            const data = docSnap.data() as EmergencyAlert;
            const tempoDespacho = agora - (data.timestamp_despacho || data.dataAtualizacao || agora);
            return tempoDespacho >= this.STALE_THRESHOLD_MS && !data.estado_alarme?.despacho_silenciado;
        });

        // ── PASSO 3: Reactivar pedidos stale no Firestore (batch, eficiente) ──
        // Apenas actualiza o campo necessário; faz isso de forma não-bloqueante
        if (hasStaleDispatch) {
            const staleIds = snapDispatch.docs
                .filter(docSnap => {
                    const data = docSnap.data() as EmergencyAlert;
                    const tempoDespacho = agora - (data.timestamp_despacho || data.dataAtualizacao || agora);
                    return tempoDespacho >= this.STALE_THRESHOLD_MS && data.estado_alarme?.despacho_silenciado === true;
                })
                .map(d => d.id);

            // Reactivar todos os stale em paralelo, sem bloquear o ciclo principal
            if (staleIds.length > 0) {
                Promise.all(
                    staleIds.map(id =>
                        updateDoc(doc(db, 'emergencias', id), {
                            'estado_alarme.despacho_silenciado': false,
                        }).catch(() => {}) // ignora erros individuais
                    )
                );
            }
        }

        // ── PASSO 4: Decidir se o alarme global deve tocar ──
        const hasActiveNew = snapNew.docs.length > 0;
        const shouldAlarm = hasActiveNew || hasStaleDispatch;

        if (!shouldAlarm) {
            // SEM pedidos urgentes → silêncio total
            if (this.alarmState !== 'IDLE') {
                this.alarmState = 'IDLE';
                audioManager.stopAllAlarms();
            }
            return;
        }

        // ── PASSO 5: Controlo de cadência — não tocar mais que 1x por minuto ──
        const tempoDesdeUltimoAlarme = agora - this.lastAlarmPlayedAt;
        const deveRepetir = this.lastAlarmPlayedAt === 0 || tempoDesdeUltimoAlarme >= this.REPEAT_INTERVAL_MS;

        if (!deveRepetir || this.alarmState === 'PLAYING') {
            return; // Dentro do período de cooldown ou já a tocar
        }

        // ── PASSO 6: Tocar alarme global (uma única sequência, independente do nº de pedidos) ──
        this.alarmState = 'PLAYING';
        this.lastAlarmPlayedAt = agora;

        this.playGlobalAlarme().finally(() => {
            // Só volta a IDLE se não ficou stale entretanto
            if (this.alarmState === 'PLAYING') {
                this.alarmState = 'COOLDOWN';
            }
        });
    }

    // Toca a sequência de som uma vez (3 toques) — completamente independente do nº de pedidos
    private async playGlobalAlarme() {
        try {
            for (let i = 1; i <= 3; i++) {
                // Verificar se o monitor ainda está activo e há pedidos
                if (!this.isRunning || this.alarmState !== 'PLAYING') break;
                await playAlarmWithRetry('global', 'emergency');
                await delay(400);
            }
        } catch (err) {
            console.error('[AlarmMonitor] Erro na sequência de som:', err);
        }
    }

    // Forçar silêncio imediato (chamado quando operador despacha/resolve)
    silenceNow() {
        audioManager.stopAllAlarms();
        this.alarmState = 'IDLE';
    }
}

export const alarmMonitor = new AlarmMonitor();
