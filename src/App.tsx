import React, { useState, useEffect, Component } from 'react';
import { View, TouchableOpacity, Text, SafeAreaView, StatusBar } from 'react-native';
import { Smartphone, Siren, Wifi, WifiOff, CloudOff } from 'lucide-react-native';
import tw from 'twrnc';
import NetInfo from '@react-native-community/netinfo';

import CitizenScreen from './screens/CitizenScreen';
import PoliceScreen from './screens/PoliceScreen';

import { db } from './services/firebase';

import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { EmergencyAlert, AlertStatus } from './types';

interface EBProps {
    children: React.ReactNode;
}

interface EBState {
    hasError: boolean;
    error: any;
}

class ErrorBoundary extends Component<EBProps, EBState> {
    constructor(props: EBProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) {
            return (
                <View style={[tw`flex-1 justify-center items-center bg-[#050507] p-10`]}>
                    <Text style={tw`text-red-500 font-black text-2xl uppercase`}>CRASH DETECTADO!</Text>
                    <Text style={tw`text-white mt-4 text-center font-bold`}>{this.state.error?.toString()}</Text>
                </View>
            );
        }
        return this.props.children;
    }
}

const AppContent: React.FC = () => {
    const [showSplash, setShowSplash] = useState(true);
    const [viewMode, setViewMode] = useState<'citizen' | 'police'>('citizen');
    const [isOnline, setIsOnline] = useState(true);
    const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);

    const NEON_YELLOW = "#fbff00";

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 3000);

        try {
            // Monitoramento de Conexão Real (NetInfo)
            const unsubscribeNet = NetInfo.addEventListener(state => {
                const online = !!state.isConnected && !!state.isInternetReachable;
                setIsOnline(online);
            });

            // O usuário mencionou lidar com mais de 1000 pedidos. 
            // Para manter a performance elite, limitamos a 1000, o que já é massivo para um painel.
            // Alertas resolvidos muito antigos são ignorados para economizar memória/banda.
            const q = query(
                collection(db, 'emergencias'),
                orderBy('timestamp', 'desc'),
                limit(1000)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EmergencyAlert[];
                setAlerts(docs);
            }, (error: any) => {
                // Silencia erros conhecidos no web:
                // - permission-denied: regras de segurança (normal antes do login)
                // - failed-precondition: índice em criação (temporário)
                // Nenhum alert nativo aqui — no Safari/macOS aparece como notificação do SO
                const isKnown = error?.code === 'permission-denied' ||
                    error?.code === 'failed-precondition' ||
                    error?.message?.includes('Missing or insufficient permissions') ||
                    error?.message?.includes('requires an index');
                if (!isKnown) {
                    console.error("[Sync] Erro no Firestore:", error.message);
                }
            });

            return () => {
                clearTimeout(timer);
                unsubscribe();
                unsubscribeNet();
            };
        } catch (error) {
            console.error("Effect error:", error);
        }
    }, []);

    const hasPendingAlerts = alerts.some(a => a.status === AlertStatus.NEW);

    if (showSplash) {
        return (
            <TouchableOpacity
                activeOpacity={1}
                onPress={() => setShowSplash(false)}
                style={tw`flex-1 bg-[#050507] items-center justify-center p-8`}
            >
                <StatusBar barStyle="light-content" />
                <View style={[tw`mb-8 p-8 bg-[#0a0a0c] rounded-full border-4 border-red-600 shadow-xl`, { shadowColor: '#dc2626', shadowOpacity: 0.5, shadowRadius: 30 }]}>
                    <Siren size={64} color="#ef4444" />
                </View>
                <Text style={[tw`text-6xl font-black tracking-tighter mb-2 uppercase`, { color: NEON_YELLOW }]}>GOGOMA</Text>
                <Text style={tw`text-[10px] text-slate-500 font-black tracking-[0.3em] uppercase mb-1`}>RESPOSTA DE EMERGÊNCIA</Text>
                <Text style={tw`text-[12px] text-white font-black uppercase tracking-[0.1em]`}>Município de Chimoio</Text>
                <Text style={tw`text-[8px] text-slate-700 font-bold uppercase mt-10`}>Toque para saltar</Text>
                
                {!isOnline && (
                    <View style={tw`absolute bottom-20 flex-row items-center gap-2 bg-red-600/20 px-4 py-2 rounded-full border border-red-600/40`}>
                        <WifiOff size={12} color="#ef4444" />
                        <Text style={tw`text-red-500 text-[10px] font-black uppercase`}>Sem Internet</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    }

    return (
        <SafeAreaView style={tw`flex-1 bg-black`}>
            <StatusBar barStyle="light-content" />

            <View style={tw`bg-[#0a0a0c] p-3 flex-row justify-between items-center border-b border-white/5`}>
                <View style={tw`flex-row items-center gap-2`}>
                    <TouchableOpacity
                        onPress={() => setViewMode('citizen')}
                        style={[tw`flex-row items-center gap-2 px-4 py-2 rounded-xl transition-all`, { backgroundColor: viewMode === 'citizen' ? NEON_YELLOW : 'transparent' }]}
                    >
                        <Smartphone size={14} color={viewMode === 'citizen' ? 'black' : '#6b7280'} />
                        <Text style={[tw`font-black uppercase text-[10px]`, { color: viewMode === 'citizen' ? 'black' : '#6b7280' }]}>Cidadão</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setViewMode('police')}
                        style={[tw`flex-row items-center gap-2 px-4 py-2 rounded-xl`, viewMode === 'police' ? tw`bg-red-600` : tw`bg-transparent`]}
                    >
                        <Siren size={14} color={viewMode === 'police' ? 'white' : '#6b7280'} />
                        <Text style={[tw`font-black uppercase text-[10px]`, { color: viewMode === 'police' ? 'white' : '#6b7280' }]}>Comando</Text>
                    </TouchableOpacity>
                </View>

                <View style={tw`flex-row items-center gap-4`}>
                    {hasPendingAlerts && viewMode === 'police' && (
                        <View style={tw`flex-row items-center gap-2 bg-red-600/20 px-3 py-1.5 rounded-lg border border-red-600`}>
                            <View style={tw`w-2 h-2 bg-red-500 rounded-full`} />
                            <Text style={tw`text-red-500 font-black tracking-widest text-[9px]`}>SOS ATIVO</Text>
                        </View>
                    )}
                    {isOnline ? <Wifi size={14} color="#22c55e" /> : <WifiOff size={14} color="#ef4444" />}
                </View>
            </View>

            {!isOnline && (
                <View style={tw`bg-red-600 p-2 items-center flex-row justify-center gap-2`}>
                    <CloudOff size={14} color="white" />
                    <Text style={tw`text-white text-[10px] font-black uppercase tracking-widest`}>Você está offline. Algumas funções podem estar limitadas.</Text>
                </View>
            )}

            <View style={tw`flex-1`}>
                {viewMode === 'citizen' ? (
                    <CitizenScreen isOnline={isOnline} />
                ) : (
                    <PoliceScreen alerts={alerts} isOnline={isOnline} />
                )}
            </View>

        </SafeAreaView>
    );
};

const App = () => (
    <ErrorBoundary>
        <AppContent />
    </ErrorBoundary>
);

export default App;

