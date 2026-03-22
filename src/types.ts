
export enum EmergencyType {
    POLICE_CIVIL = 'Polícia Civil',
    POLICE_TRAFFIC = 'Polícia Trânsito',
    DISASTER = 'Clima/Desastre',
    GENERAL = 'Emergência Geral'
}

export enum AlertStatus {
    NEW = 'NOVO',
    IN_PROGRESS = 'EM TRÂNSITO',
    RESOLVED = 'RESOLVIDO'
}

export interface GeoLocation {
    lat: number | null;
    lng: number | null;
    accuracy?: number;
}

export interface UserProfile {
    name: string;
    phoneNumber: string;
    city: string;
    neighborhood: string;
}

export interface EmergencyAlert {
    id: string;
    type: EmergencyType;
    location: GeoLocation;
    timestamp: number; // timestamp_criacao
    status: AlertStatus;
    description?: string;
    contactNumber: string;
    userName?: string;
    aiAdvice?: string;
    manualAddress?: string;
    province?: string;
    district?: string;
    neighborhood?: string;
    dataAtualizacao?: number;
    isLowAccuracy?: boolean;
    images?: string[];
    
    // Novos campos para Controle de Alarme Robusto
    timestamp_despacho?: number;
    timestamp_conclusao?: number;
    timestamp_ultimo_alarme?: number;
    contador_toques?: number;
    estado_alarme?: {
        tocando: boolean;
        despacho_silenciado: boolean;
        despacho_timestamp_silencio: number | null;
        alarmes_completados: number;
        skip_sound_rule?: boolean;
    };
}
