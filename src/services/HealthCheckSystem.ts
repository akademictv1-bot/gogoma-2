import { collection, doc, getDoc, getDocs, query, limit, where } from 'firebase/firestore';
import { db } from './firebase';
import { audioManager } from './AudioManager';
import { alarmMonitor } from './AlarmMonitor';
import { AlertStatus } from '../types';
import { Platform } from 'react-native';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface SystemStatus {
    firebase_connection: boolean;
    database_accessibility: boolean;
    audio_manager_active: boolean;
    alarm_monitor_active: boolean;
    active_requests_count: number;
    queue_length: number;
    last_successful_alarm: number;
    last_error: string;
    cpu_usage: number;
    memory_usage: number;
    network_latency: number;
}

export interface ErrorLogEntry {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: number;
}

// Códigos de erro do Firestore que NÃO devem ser tratados como falha de sistema
const PERMISSION_CODES = ['permission-denied', 'PERMISSION_DENIED'];
const PERMISSION_MSGS  = ['Missing or insufficient permissions', 'Permission denied'];

function isPermissionError(err: any): boolean {
    if (!err) return false;
    if (PERMISSION_CODES.includes(err.code)) return true;
    return PERMISSION_MSGS.some(m => err.message?.includes(m));
}

class HealthCheckSystem {
    private checkInterval: number = 60_000; // 60 s — evita leituras desnecessárias
    public systemStatus: SystemStatus;
    public errorLog: ErrorLogEntry[] = [];
    private isRunning: boolean = false;
    private startTime: number = 0;
    private lastAlertTimestamp: Map<string, number> = new Map();

    constructor() {
        this.systemStatus = {
            firebase_connection: false,
            database_accessibility: false,
            audio_manager_active: false,
            alarm_monitor_active: false,
            active_requests_count: 0,
            queue_length: 0,
            last_successful_alarm: 0,
            last_error: '',
            cpu_usage: 0,
            memory_usage: 0,
            network_latency: 0
        };
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startTime = Date.now();
        // Aguarda 5 s antes do primeiro check — deixa o Firebase ligar sem stress
        setTimeout(() => this.performFullHealthCheck(), 5000);
        setInterval(() => this.performFullHealthCheck(), this.checkInterval);
    }

    private async performFullHealthCheck() {
        try {
            await Promise.all([
                this.checkFirebaseConnection(),
                this.checkDatabaseAccess(),
                this.checkAudioManager(),
                this.checkAlarmMonitor(),
                this.checkQueueHealth(),
            ]);

            if (Platform.OS === 'web') {
                await this.checkSystemResources();
                this.checkOfflineMode();
            }

        } catch (err: any) {
            // Erro interno do próprio health check — só loga, nunca dispara notificação
            console.warn('[HealthCheck] Erro interno:', err?.message);
        }
    }

    // ── Verificação 1: Conectividade Firebase (leitura simples, sem write) ──────
    private async checkFirebaseConnection() {
        const start = Date.now();
        try {
            // Leitura de um documento que os operadores têm permissão de ler
            await getDoc(doc(db, 'emergencias', '_ping_'));
            this.systemStatus.firebase_connection = true;
            this.systemStatus.network_latency = Date.now() - start;
        } catch (err: any) {
            this.systemStatus.network_latency = Date.now() - start;

            // Erro de permissão = Firebase está OK, apenas documento protegido
            if (isPermissionError(err)) {
                this.systemStatus.firebase_connection = true;
                return;
            }

            // Só marca como desconectado em erros reais de rede/Firebase
            this.systemStatus.firebase_connection = false;
            this._log('FIREBASE_CONNECTION', err.message, 'medium');
        }
    }

    // ── Verificação 2: Acesso ao banco de dados ───────────────────────────────
    private async checkDatabaseAccess() {
        try {
            await getDocs(query(collection(db, 'emergencias'), limit(1)));
            this.systemStatus.database_accessibility = true;
        } catch (err: any) {
            // Permissão recusada = banco acessível, apenas regras restritivas
            if (isPermissionError(err)) {
                this.systemStatus.database_accessibility = true;
                return;
            }
            this.systemStatus.database_accessibility = false;
            this._log('DATABASE_ACCESS', err.message, 'medium');
        }
    }

    // ── Verificação 3: AudioManager ───────────────────────────────────────────
    private async checkAudioManager() {
        this.systemStatus.audio_manager_active = !!audioManager;
    }

    // ── Verificação 4: AlarmMonitor ───────────────────────────────────────────
    private async checkAlarmMonitor() {
        this.systemStatus.alarm_monitor_active = !!alarmMonitor;
    }

    // ── Verificação 5: Fila de áudio ──────────────────────────────────────────
    private async checkQueueHealth() {
        // @ts-ignore — acesso para health check
        const queueLength = audioManager.audioQueue?.length || 0;
        this.systemStatus.queue_length = queueLength;

        if (queueLength > 1000) {
            this._log('QUEUE_CRITICAL', `Fila com ${queueLength} itens`, 'high');
        }
    }

    // ── Verificação 6: Recursos do sistema (web only) ─────────────────────────
    private async checkSystemResources() {
        try {
            // @ts-ignore
            if (window.performance?.memory) {
                // @ts-ignore
                const mem = window.performance.memory;
                this.systemStatus.memory_usage = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;

                if (this.systemStatus.memory_usage > 90) {
                    this._log('CRITICAL_MEMORY', `${this.systemStatus.memory_usage.toFixed(1)}%`, 'high');
                }
            }
        } catch (_) {}
    }

    // ── Verificação 7: Modo offline (web only) ────────────────────────────────
    private checkOfflineMode() {
        if (!navigator.onLine) {
            this._log('OFFLINE_MODE', 'Navegador sem internet', 'high');
        }
    }

    // ── Logger interno (apenas console — SEM writes Firestore, SEM Notification) ─
    public _log(type: string, message: string, severity: ErrorLogEntry['severity']) {
        const entry: ErrorLogEntry = { type, message, severity, timestamp: Date.now() };
        this.errorLog.push(entry);
        this.systemStatus.last_error = `${type}: ${message}`;

        if (this.errorLog.length > 100) this.errorLog.shift();

        if (severity === 'critical' || severity === 'high') {
            console.warn(`[HealthCheck][${severity.toUpperCase()}] ${type}: ${message}`);
        }
        // Nenhum write Firestore aqui — evita loops de erro (erro → log → erro de permissão → log → ...)
        // Nenhuma Notification do browser aqui — o AlarmMonitor trata de pedidos SOS reais
    }

    // Mantemos o método público legado para compatibilidade
    public async logError(type: string, message: string, severity: ErrorLogEntry['severity']) {
        this._log(type, message, severity);
    }

    public getStatusColor(): string {
        const s = this.systemStatus;
        if (!s.firebase_connection || !s.database_accessibility) return '#ef4444';
        if (s.network_latency > 1000) return '#fbbf24';
        return '#22c55e';
    }
}

export const healthCheck = new HealthCheckSystem();
