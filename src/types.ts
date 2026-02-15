
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
    timestamp: number;
    status: AlertStatus;
    description?: string;
    contactNumber: string;
    userName?: string;
    aiAdvice?: string;
    manualAddress?: string;
    province?: string;
    district?: string;
    neighborhood?: string;
}
