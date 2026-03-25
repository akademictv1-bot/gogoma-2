import { collection, doc, setDoc, getDocs, query, limit, where, addDoc } from 'firebase/firestore';
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

class HealthCheckSystem {
    private checkInterval: number = 30_000; // 30 s — evita write storms no Firestore
    public systemStatus: SystemStatus;
    public errorLog: ErrorLogEntry[] = [];
    private alertThreshold: number = 3;
    private lastQueueLength: number = 0;
    private isRunning: boolean = false;
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

    private startTime: number = 0;
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startTime = Date.now();
        this.performFullHealthCheck();
        setInterval(() => this.performFullHealthCheck(), this.checkInterval);

        // Relatório a cada 5 minutos
        setInterval(() => this.generateReport(), 300_000);
    }

    private async performFullHealthCheck() {
        try {
            await Promise.all([
                this.checkFirebaseConnection(),
                this.checkDatabaseAccess(),
                this.checkAudioManager(),
                this.checkAlarmMonitor(),
                this.checkActiveRequests(),
                this.checkQueueHealth(),
                this.checkOfflineMode()
            ]);

            // Verificações menos frequentes (recursos)
            if (Date.now() % 5000 < 1000) {
                await this.checkSystemResources();
            }

            await this.checkAlertConditions();
            
            // Log discreto a cada segundo (opcional, pode ser comentado se poluir)
            // this.printMiniStatus(); 

        } catch (err: any) {
            this.logError("INTERNAL_HEALTH_CHECK_ERROR", err.message, "high");
        }
    }

    private async checkFirebaseConnection() {
        const start = Date.now();
        const startupGrace = Date.now() - this.startTime < 15000;

        try {
            const testRef = doc(db, 'health_check', 'test');
            await setDoc(testRef, { timestamp: Date.now() }, { merge: true });
            this.systemStatus.firebase_connection = true;
            this.systemStatus.network_latency = Date.now() - start;
        } catch (err: any) {
            this.systemStatus.firebase_connection = false;
            this.logError("FIREBASE_CONNECTION", err.message, startupGrace ? "medium" : "critical");
            if (!startupGrace) this.triggerAlert("Firebase desconectado!");
        }
    }

    private async checkDatabaseAccess() {
        const startupGrace = Date.now() - this.startTime < 15000;
        try {
            // Tenta ler 3 coleções principais (adaptando nomes para o projeto)
            const checks = [
                getDocs(query(collection(db, 'emergencias'), limit(1))),
                getDocs(query(collection(db, 'usuarios'), limit(1))),
                getDocs(query(collection(db, 'configuracoes'), limit(1)))
            ];
            await Promise.all(checks);
            this.systemStatus.database_accessibility = true;
        } catch (err: any) {
            this.systemStatus.database_accessibility = false;
            this.logError("DATABASE_ACCESS", err.message, startupGrace ? "low" : "high");
            if (!startupGrace) this.triggerAlert("Banco de dados indisponível!");
        }
    }

    private async checkAudioManager() {
        if (!audioManager) {
            this.logError("AUDIO_MANAGER_MISSING", "audioManager não inicializado", "critical");
            this.systemStatus.audio_manager_active = false;
            return;
        }
        this.systemStatus.audio_manager_active = true;
        
        // No web, verificar se o contexto está parado
        if (Platform.OS === 'web') {
            // @ts-ignore
            if (audioManager.audioContext?.state === 'suspended') {
                // Tenta retomar se possível (pode falhar se não houve interação)
            }
        }
    }

    private async checkAlarmMonitor() {
        if (!alarmMonitor) {
            this.logError("ALARM_MONITOR_MISSING", "alarmMonitor não inicializado", "critical");
            this.systemStatus.alarm_monitor_active = false;
            return;
        }
        this.systemStatus.alarm_monitor_active = true;
        
        // Verifica se o monitor parou de responder (simulado por timestamp se adicionarmos um no monitor)
    }

    private async checkActiveRequests() {
        try {
            const q = query(collection(db, 'emergencias'), 
                where('status', 'in', [AlertStatus.NEW, AlertStatus.IN_PROGRESS]));
            const snap = await getDocs(q);
            this.systemStatus.active_requests_count = snap.size;

            if (snap.size > 500) {
                this.logError("CRITICAL_REQUEST_COUNT", `${snap.size} pedidos ativos`, "critical");
                this.triggerAlert("Sistema sobrecarregado!");
            } else if (snap.size > 100) {
                this.logError("HIGH_REQUEST_COUNT", `${snap.size} pedidos ativos`, "medium");
            }
        } catch (err: any) {
            this.logError("ACTIVE_REQUESTS_CHECK_FAILED", err.message, "medium");
        }
    }

    private async checkQueueHealth() {
        // @ts-ignore - acessando propriedade privada para health check
        const queueLength = audioManager.audioQueue?.length || 0;
        const diff = queueLength - this.lastQueueLength;
        this.systemStatus.queue_length = queueLength;

        if (diff > 50 && queueLength > 100) {
            this.logError("QUEUE_OVERFLOW", `Fila crescendo rápido: +${diff} itens`, "high");
        }
        
        if (queueLength > 1000) {
            this.logError("QUEUE_CRITICAL", "Fila com 1000+ itens ativos", "critical");
            this.triggerAlert("Fila de áudio transbordando!");
        }

        this.lastQueueLength = queueLength;
    }

    private async checkSystemResources() {
        if (Platform.OS !== 'web') return;

        try {
            // Memória (Chrome/Webkit)
            // @ts-ignore
            if (window.performance && window.performance.memory) {
                // @ts-ignore
                const mem = window.performance.memory;
                this.systemStatus.memory_usage = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
                
                if (this.systemStatus.memory_usage > 90) {
                    this.logError("CRITICAL_MEMORY", `${this.systemStatus.memory_usage.toFixed(1)}%`, "critical");
                    this.triggerAlert("Memória crítica!");
                }
            }

            // CPU estimada (latência do loop de eventos)
            const start = performance.now();
            setTimeout(() => {
                const end = performance.now();
                const lag = end - start - 0; // idealmente zero
                this.systemStatus.cpu_usage = Math.min(100, (lag / 100) * 100);
            }, 0);

        } catch (err) { }
    }

    private async checkOfflineMode() {
        if (Platform.OS === 'web') {
            if (!navigator.onLine) {
                this.logError("OFFLINE_MODE", "Navegador sem internet", "high");
            }
        }
    }

    private async checkAlertConditions() {
        // Reduzida a agressividade: apenas loga se houver problemas críticos, 
        // mas não re-dispara o alerta visual principal em loop.
        const recentErrors = this.errorLog.filter(e => Date.now() - e.timestamp < 30000);
        const criticalCount = recentErrors.filter(e => e.severity === 'critical').length;
        
        if (criticalCount > 0 && !this.isThrottled("check_conditions")) {
            console.warn(`[HealthCheck] ${criticalCount} problemas críticos detectados recentemente.`);
        }
    }

    public async logError(type: string, message: string, severity: ErrorLogEntry['severity']) {
        const entry: ErrorLogEntry = { type, message, severity, timestamp: Date.now() };
        this.errorLog.push(entry);
        this.systemStatus.last_error = `${type}: ${message}`;

        if (this.errorLog.length > 100) this.errorLog.shift();

        console.error(`[HealthCheck][${severity.toUpperCase()}] ${type}: ${message}`);

        // Registrar no Firestore para auditoria remota
        try {
            await addDoc(collection(db, 'system_logs'), entry);
        } catch (e) { }

        if (severity === 'critical') this.emergencyAlert(message);
        else if (severity === 'high') this.warningAlert(message);
    }

    private emergencyAlert(mensagem: string) {
        if (this.isThrottled("emergency")) return;

        console.error(`%c ⛔ EMERGÊNCIA GOGOMA: ${mensagem}`, "color: white; background: red; font-size: 16px; font-weight: bold;");
        
        // Alerta visual agressivo REMOVIDO para estabilidade da interface
        if (Platform.OS === 'web') {
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("⛔ EMERGÊNCIA GOGOMA", { body: mensagem, requireInteraction: true });
            }
        }
    }

    private warningAlert(mensagem: string) {
        if (this.isThrottled("warning")) return;
        console.warn(`%c ⚠️ AVISO GOGOMA: ${mensagem}`, "color: black; background: yellow; font-size: 14px; font-weight: bold;");
    }

    private triggerAlert(mensagem: string) {
        // Método genérico para alertas de verificação
        this.warningAlert(mensagem);
    }

    private isThrottled(type: string): boolean {
        const last = this.lastAlertTimestamp.get(type) || 0;
        if (Date.now() - last < 60000) return true;
        this.lastAlertTimestamp.set(type, Date.now());
        return false;
    }

    public getStatusColor(): string {
        const s = this.systemStatus;
        if (!s.firebase_connection || !s.database_accessibility) return '#ef4444'; // Red
        if (s.network_latency > 1000 || s.active_requests_count > 100) return '#fbbf24'; // Yellow
        return '#22c55e'; // Green
    }

    private printMiniStatus() {
        const s = this.systemStatus;
        const icons = {
            fb: s.firebase_connection ? '✅' : '❌',
            db: s.database_accessibility ? '🗄️' : '❌',
            au: s.audio_manager_active ? '🔊' : '❌',
            mon: s.alarm_monitor_active ? '👁️' : '❌'
        };
        // printMiniStatus desactivado em produção (evita spam no console)
    }

    private generateReport() {
        const s = this.systemStatus;
        const report = {
            status: this.errorLog.some(e => Date.now() - e.timestamp < 10000 && e.severity === 'critical') ? 'CRÍTICO' :
                   this.errorLog.some(e => Date.now() - e.timestamp < 10000 && e.severity === 'high') ? 'AVISO' : 'SAUDÁVEL',
            timestamp: new Date().toLocaleString(),
            pedidos_ativos: s.active_requests_count,
            fila_audio: s.queue_length,
            latencia_rede: `${s.network_latency}ms`,
            memoria: `${s.memory_usage.toFixed(1)}%`,
            cpu_estimada: `${s.cpu_usage.toFixed(1)}%`,
            ultimos_erros: this.errorLog.slice(-3).map(e => e.type)
        };

        // Guardar no Firestore para histórico remoto
        addDoc(collection(db, 'system_reports'), { ...report, raw_timestamp: Date.now() }).catch(() => {});
    }
}

export const healthCheck = new HealthCheckSystem();
