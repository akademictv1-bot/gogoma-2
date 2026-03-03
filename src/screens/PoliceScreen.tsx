import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Linking, Image, Platform, AppState } from 'react-native';
import { Download, Trash2, Shield, X, RefreshCcw, ArrowLeft, Lock, LogOut, Archive, MapPin, User, Phone, Map, Navigation, BrainCircuit, CheckCircle, Settings, AlertCircle, Volume2, WifiOff } from 'lucide-react-native';
import tw from 'twrnc';
import { Audio } from 'expo-av';
import { Animated } from 'react-native';

import { db } from '../services/firebase';
import { collection, onSnapshot, doc, getDoc, updateDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
// Gemini service removido - feature de IA desabilitada
import { EmergencyAlert, AlertStatus } from '../types';
import { startAlarm, stopAlarm, unlockAudio, playImmediateBeep } from '../services/alarmService';
import { decryptValue } from '../services/cryptoUtils';
import { registerForPushNotificationsAsync, saveOperatorToken } from '../services/notificationService';

import Header from '../components/Header';

interface PoliceScreenProps {
    alerts: EmergencyAlert[];
}

const PoliceScreen: React.FC<PoliceScreenProps> = ({ alerts }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [badgeId, setBadgeId] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<EmergencyAlert | null>(null);
    // aiProtocol e loadingAi removidos - Gemini desabilitado
    const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
    const [showConfig, setShowConfig] = useState(false);
    const [newLogoUrl, setNewLogoUrl] = useState('');
    const [helpPhone, setHelpPhone] = useState('112');
    const [helpText, setHelpText] = useState('PEÇA SOCORRO IMEDIATO');
    const prevNewAlertsCount = useRef(0);

    // Animações de Botão (Elite Feedback)
    const dispatchScale = useRef(new Animated.Value(1)).current;
    const resolveScale = useRef(new Animated.Value(1)).current;

    const animatePress = (scaleVar: Animated.Value) => {
        Animated.sequence([
            Animated.timing(scaleVar, { toValue: 0.92, duration: 100, useNativeDriver: true }),
            Animated.spring(scaleVar, { toValue: 1, friction: 4, useNativeDriver: true })
        ]).start();
    };

    // Credenciais: ID local e Senha encriptada no Firestore
    const [dbPassword, setDbPassword] = useState<string | null>(null);
    const [loadingCreds, setLoadingCreds] = useState(true);

    const fetchCreds = async () => {
        setLoadingCreds(true);
        try {
            const docRef = doc(db, 'comando_universal', 'credenciais');
            const credSnap = await getDoc(docRef);

            if (credSnap.exists()) {
                const data = credSnap.data();
                const secretKey = process.env.EXPO_PUBLIC_CRYPTO_KEY;

                if (!secretKey) {
                    console.error("[PoliceAuth] ERRO: EXPO_PUBLIC_CRYPTO_KEY não encontrada.");
                    Alert.alert("Erro de Sistema", "Ocorreu um erro na configuração de segurança do Comando. Por favor, contacte o suporte técnico.");
                    return;
                }

                console.log("[PoliceAuth] Documento lido:", data);

                if (!data.encryptedPassword) {
                    Alert.alert("Configuração Incompleta", "Os dados de acesso ainda não foram configurados no servidor.");
                    return;
                }

                try {
                    const decryptedPassword = decryptValue(
                        data.encryptedPassword,
                        secretKey
                    );

                    if (!decryptedPassword) {
                        throw new Error("Desencriptação da senha falhou");
                    }

                    setDbPassword(decryptedPassword);
                } catch (decError) {
                    console.error("[PoliceAuth] Falha ao desencriptar senha:", decError);
                    Alert.alert("Segurança", "Não foi possível validar as chaves de segurança. Tente novamente ou verifique a sua ligação.");
                }
            } else {
                console.error("[PoliceAuth] ERRO: Documento não existe.");
                Alert.alert("Sistema Indisponível", "O Comando ainda não foi inicializado no servidor.");
            }
        } catch (err) {
            console.error("[PoliceAuth] Erro inesperado:", err);
            Alert.alert("Ligação Falhou", "Ligue-se à internet para aceder ao Comando.");
        } finally {
            setLoadingCreds(false);
        }
    };

    // Carregar e Desencriptar Credenciais do Firestore
    useEffect(() => {
        fetchCreds();
    }, []);

    const handleLogin = () => {
        if (loadingCreds) {
            Alert.alert("Aguarde", "O sistema ainda está a carregar os dados de segurança...");
            return;
        }

        const officialId = process.env.EXPO_PUBLIC_COMMAND_ID;
        console.log("[PoliceAuth] Tentativa de Login:", {
            badgeId: badgeId.trim(),
            officialId,
            hasDbPassword: !!dbPassword,
            cryptoKeyExists: !!process.env.EXPO_PUBLIC_CRYPTO_KEY
        });

        if (!dbPassword || !officialId) {
            Alert.alert("Rede Indisponível", "Ligue-se à internet para validar o seu acesso ao Comando.");
            return;
        }

        if (badgeId.trim() === officialId && password === dbPassword) {
            setIsAuthenticated(true);
            setAuthError(false);
            unlockAudio();
        } else {
            setAuthError(true);
            setPassword('');
            Alert.alert("Acesso Negado", "O ID ou a Senha inseridos estão incorretos.");
        }
    };

    const updateAlertStatus = async (id: string, status: AlertStatus) => {
        try {
            const docRef = doc(db, 'emergencias', id);
            await updateDoc(docRef, { status, dataAtualizacao: Date.now() });

            // SEMPRE fechar o modal após uma ação (conforme solicitado)
            setSelectedAlert(null);

            if (status === AlertStatus.IN_PROGRESS) {
                stopAlarm();
                Alert.alert('Despacho Enviado', 'Equipa a caminho. O alerta ficará amarelo para todos os operadores.');
            }
        } catch (err: any) {
            Alert.alert('Falha na Rede', `Ligue-se à internet para atualizar o alerta.`);
        }
    };

    // Função handleGenerateProtocol removida - Gemini AI desabilitado

    // Função para tocar som de alerta de emergência removida - movida para alarmService

    useEffect(() => {
        const docRef = doc(db, 'configuracoes', 'geral');
        const unsub = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.logoUrl) setNewLogoUrl(data.logoUrl);
                if (data.helpPhone) setHelpPhone(data.helpPhone);
                if (data.helpText) setHelpText(data.helpText);
            }
        });
        return unsub;
    }, []);

    const downloadCSV = () => {
        const historyAlerts = alerts.filter(a => a.status === AlertStatus.RESOLVED);
        if (historyAlerts.length === 0) {
            Alert.alert("Erro", "Não há dados para exportar no histórico.");
            return;
        }

        const headers = ["ID", "Tipo", "Cidadão", "Telefone", "Bairro", "Data", "Status"];
        const rows = historyAlerts.map(a => [
            a.id,
            a.type,
            a.userName || "Anônimo",
            a.contactNumber || "N/A",
            a.neighborhood || "N/A",
            new Date(a.timestamp).toLocaleString('pt-MZ'),
            a.status
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");

        if (Platform.OS === 'web') {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `relatorio_gogoma_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            Alert.alert("Exportar CSV", "Funcionalidade disponível na versão Web para Download.");
        }
    };

    const clearHistory = async () => {
        const historyAlerts = alerts.filter(a => a.status === AlertStatus.RESOLVED);
        if (historyAlerts.length === 0) {
            Alert.alert("Histórico Vazio", "Não existem registros resolvidos para apagar.");
            return;
        }

        const runClear = async () => {
            try {
                const chunkSize = 400;
                for (let i = 0; i < historyAlerts.length; i += chunkSize) {
                    const batch = writeBatch(db);
                    const chunk = historyAlerts.slice(i, i + chunkSize);
                    chunk.forEach(a => {
                        const docRef = doc(db, 'emergencias', a.id);
                        batch.delete(docRef);
                    });
                    await batch.commit();
                }
                Alert.alert("Sucesso", "Histórico limpo com sucesso.");
            } catch (error: any) {
                console.error("Erro ao apagar histórico:", error);
                Alert.alert("Erro", `Não foi possível apagar totalmente o histórico: ${error.message}`);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Deseja apagar permanentemente ${historyAlerts.length} registros do histórico?`)) {
                runClear();
            }
        } else {
            Alert.alert(
                "Limpar Histórico",
                `Deseja apagar permanentemente ${historyAlerts.length} registros do histórico?`,
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Apagar Tudo",
                        style: "destructive",
                        onPress: runClear
                    }
                ]
            );
        }
    };

    // ──────────── LÓGICA DE ÁUDIO PROFISSIONAL ────────────
    // Regras Mestre:
    // 1. SOS entra (NEW) → alarme toca IMEDIATAMENTE
    // 2. Sem ação (NEW) → repete a cada 60 segundos
    // 3. Despachar (IN_PROGRESS) → SILÊNCIO por 30 minutos (por pedido)
    // 4. Stale (>30 min em IN_PROGRESS) → Alarme VOLTA a tocar
    // 5. Resolver (RESOLVED) → Silêncio total para aquele pedido
    // 6. Alarme para APENAS se não houver NENHUM alerta NEW ou STALE

    useEffect(() => {
        if (!isAuthenticated) {
            stopAlarm();
            return;
        }

        const now = Date.now();

        // a) Pedidos NOVOS
        const newAlerts = alerts.filter(a => a.status === AlertStatus.NEW);

        // b) Pedidos STALE (Despacho parado há mais de 30 min)
        const staleDispatches = alerts.filter(a =>
            a.status === AlertStatus.IN_PROGRESS &&
            a.dataAtualizacao &&
            (now - a.dataAtualizacao > 1800000) // 30 minutos
        );

        const urgentCount = newAlerts.length + staleDispatches.length;

        // Gatilho imediato se o número de urgências aumentar (Novo SOS ou Novo Stale)
        if (urgentCount > prevNewAlertsCount.current) {
            playImmediateBeep();
        }

        // Gestão do Loop de 60 segundos
        if (urgentCount > 0) {
            startAlarm();
        } else {
            stopAlarm();
        }

        prevNewAlertsCount.current = urgentCount;
    }, [alerts, isAuthenticated]);

    // Verificação contínua para transformar IN_PROGRESS em STALE em tempo real
    useEffect(() => {
        if (!isAuthenticated) return;
        const interval = setInterval(() => {
            // Apenas forçamos o re-cálculo do useEffect acima
            // React vai detetar que o tempo mudou e as urgências podem ter mudado
            const now = Date.now();
            const hasStale = alerts.some(a =>
                a.status === AlertStatus.IN_PROGRESS &&
                a.dataAtualizacao &&
                (now - a.dataAtualizacao > 1800000)
            );
            if (hasStale) startAlarm();
        }, 30000); // Checar a cada 30 segundos
        return () => clearInterval(interval);
    }, [alerts, isAuthenticated]);

    // Verificação de AppState para re-alarme imediato ao voltar para o foco
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active' && isAuthenticated) {
                // Ao voltar para o app, se houver urgências, dispara bip imediato
                const now = Date.now();
                const urgentCount = alerts.filter(a =>
                    a.status === AlertStatus.NEW ||
                    (a.status === AlertStatus.IN_PROGRESS && a.dataAtualizacao && (now - a.dataAtualizacao > 1800000))
                ).length;

                if (urgentCount > 0) {
                    playImmediateBeep();
                }
            }
        });
        return () => subscription.remove();
    }, [alerts, isAuthenticated]);

    const filteredAlerts = alerts
        .filter(a => activeTab === 'pending' ? a.status !== AlertStatus.RESOLVED : a.status === AlertStatus.RESOLVED)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    useEffect(() => {
        if (isAuthenticated) {
            registerForPushNotificationsAsync().then(token => {
                if (token) saveOperatorToken(badgeId, token);
            });
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <View style={tw`flex-1 bg-black items-center justify-center p-6`}>
                <View style={tw`w-full max-w-sm bg-[#0d0d10] p-10 rounded-[40px] border border-white/5`}>
                    <View style={tw`absolute top-0 left-0 w-full h-1 bg-red-600`} />
                    <Lock color="#dc2626" size={56} style={tw`self-center mb-6`} />
                    <Text style={tw`text-xl font-black text-center mb-10 text-white tracking-[.2em] uppercase`}>CENTRAL PRM</Text>

                    <View style={tw`gap-6`}>
                        <TextInput
                            placeholder="ID DO AGENTE"
                            placeholderTextColor="#4b5563"
                            style={tw`w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white font-black text-xs uppercase`}
                            value={badgeId}
                            onChangeText={setBadgeId}
                        />
                        <TextInput
                            placeholder="PALAVRA-PASSE"
                            placeholderTextColor="#4b5563"
                            secureTextEntry
                            style={tw`w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white font-black text-xs uppercase`}
                            value={password}
                            onChangeText={setPassword}
                        />
                        {authError && <Text style={tw`text-red-600 text-[10px] font-black text-center uppercase`}>ACESSO NEGADO</Text>}
                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={loadingCreds}
                            style={tw`w-full bg-red-600 py-5 rounded-2xl items-center shadow-xl ${loadingCreds ? 'opacity-50' : ''}`}
                        >
                            <Text style={tw`text-white font-black uppercase text-xs`}>
                                {loadingCreds ? 'VERIFICANDO SERVIDOR...' : 'ENTRAR NO COMANDO'}
                            </Text>
                        </TouchableOpacity>

                        {!dbPassword && !loadingCreds && (
                            <TouchableOpacity
                                onPress={fetchCreds}
                                activeOpacity={0.7}
                                style={tw`mt-2 flex-row items-center justify-center gap-2`}
                            >
                                <RefreshCcw size={14} color="#4b5563" />
                                <Text style={tw`text-[#4b5563] text-[10px] font-bold uppercase`}>RECARREGAR SEGURANÇA</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={tw`flex-1 bg-[#0a0a0c]`}>
            <Header
                title="CENTRAL DE COMANDO"
                subtitle="SISTEMA GOGOMA"
                actionIcon={
                    <View style={tw`flex-row items-center gap-2`}>
                        <TouchableOpacity onPress={async () => {
                            setIsAuthenticated(false);
                            setBadgeId('');
                            setPassword('');
                        }} style={tw`p-2 bg-red-600/10 rounded-lg`}>
                            <LogOut size={16} color="#ef4444" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowConfig(true)} style={tw`p-2 bg-white/5 rounded-lg`}>
                            <Settings size={18} color="#fbff00" />
                        </TouchableOpacity>
                    </View>
                }
            />

            <View style={tw`flex-row bg-[#0d0d10] border-b border-white/5`}>
                <TouchableOpacity onPress={() => setActiveTab('pending')} style={[tw`flex-1 py-5 items-center relative`, activeTab === 'pending' && tw`border-b-2 border-red-600 bg-red-600/5`]}>
                    <Text style={[tw`text-[10px] font-black uppercase`, activeTab === 'pending' ? tw`text-red-500` : tw`text-white/20`]}>ATIVOS</Text>
                    {alerts.filter(a => a.status === AlertStatus.NEW).length > 0 && (
                        <View style={tw`absolute top-4 right-10 w-2 h-2 bg-red-600 rounded-full`} />
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('resolved')} style={[tw`flex-1 py-5 items-center`, activeTab === 'resolved' && tw`border-b-2 border-white bg-white/5`]}>
                    <Text style={[tw`text-[10px] font-black uppercase`, activeTab === 'resolved' ? tw`text-white` : tw`text-white/20`]}>HISTÓRICO</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'resolved' && filteredAlerts.length > 0 && (
                <View style={tw`flex-row gap-2 p-4 bg-black border-b border-white/5`}>
                    <TouchableOpacity
                        onPress={downloadCSV}
                        style={tw`flex-1 flex-row items-center justify-center gap-2 py-3 bg-blue-600/10 border border-blue-500/30 rounded-xl`}
                    >
                        <Download size={14} color="#60a5fa" />
                        <Text style={tw`text-blue-400 text-[9px] font-black uppercase`}>EXPORTAR CSV</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={clearHistory}
                        activeOpacity={0.7}
                        style={tw`flex-1 flex-row items-center justify-center gap-2 py-3 bg-red-600/10 border border-red-500/30 rounded-xl`}
                    >
                        <Trash2 size={14} color="#ef4444" />
                        <Text style={tw`text-red-500 text-[9px] font-black uppercase`}>LIMPAR TUDO</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView style={tw`flex-1`}>
                {filteredAlerts.length === 0 ? (
                    <View style={tw`p-20 opacity-10 items-center justify-center gap-4`}>
                        <Archive size={48} color="white" />
                        <Text style={tw`text-[10px] font-black uppercase tracking-widest text-white`}>SEM ALERTAS</Text>
                    </View>
                ) : (
                    filteredAlerts.map(alert => (
                        <TouchableOpacity
                            key={alert.id}
                            onPress={() => { setSelectedAlert(alert); }}
                            style={[
                                tw`w-full p-6 border-b border-white/5`,
                                selectedAlert?.id === alert.id && tw`bg-white/5 border-l-4 border-red-600`,
                                alert.status === AlertStatus.IN_PROGRESS && tw`border-l-4 border-amber-500 bg-amber-500/5`
                            ]}
                        >
                            <View style={tw`flex-row justify-between items-center mb-2`}>
                                <Text style={[
                                    tw`text-[8px] font-black px-2 py-1 rounded-full`,
                                    alert.status === AlertStatus.NEW ? tw`bg-red-600 text-white` :
                                        alert.status === AlertStatus.IN_PROGRESS ? tw`bg-amber-500 text-black` :
                                            tw`bg-white/10 text-white/40`
                                ]}>{alert.status === AlertStatus.IN_PROGRESS ? 'EM DESPACHO' : alert.status}</Text>
                                <Text style={tw`text-[9px] text-white/30 font-bold`}>{new Date(alert.timestamp).toLocaleTimeString()}</Text>
                            </View>
                            <Text style={tw`font-black text-sm uppercase text-white tracking-tight`}>{alert.type}</Text>
                            <View style={tw`flex-row items-center gap-1 mt-1`}>
                                <MapPin size={10} color="#dc2626" />
                                <Text style={tw`text-[10px] text-white/50 font-bold`}>{alert.neighborhood || 'LOCAL NÃO IDENTIFICADO'}</Text>
                                {alert.isLowAccuracy && (
                                    <View style={tw`ml-2 flex-row items-center gap-1 bg-red-600/10 px-2 py-0.5 rounded`}>
                                        <WifiOff size={8} color="#ef4444" />
                                        <Text style={tw`text-[7px] font-black text-red-500 uppercase`}>GPS FRACO</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Modal Detalhe (Mobile Style) */}
            <Modal visible={!!selectedAlert} animationType="slide">
                <View style={tw`flex-1 bg-[#0a0a0c]`}>
                    <View style={tw`p-4 bg-[#0d0d10] border-b border-white/10 flex-row items-center gap-4`}>
                        <TouchableOpacity onPress={() => setSelectedAlert(null)} style={tw`p-2 bg-white/5 rounded-xl`}>
                            <ArrowLeft size={20} color="white" />
                        </TouchableOpacity>
                        <Text style={tw`text-sm font-black uppercase text-red-600`}>{selectedAlert?.type}</Text>
                    </View>

                    <ScrollView style={tw`flex-1 p-6 gap-6`}>
                        <View style={tw`bg-[#121216] p-8 rounded-[32px] border border-white/5`}>
                            <Text style={tw`text-[10px] font-black uppercase text-white/30 mb-6 flex-row items-center gap-2`}>DADOS CIDADÃO</Text>
                            <Text style={tw`text-2xl font-black text-white`}>{selectedAlert?.userName || "ANÔNIMO"}</Text>
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedAlert?.contactNumber}`)}>
                                <Text style={tw`text-blue-500 font-bold text-xl mb-6`}>{selectedAlert?.contactNumber}</Text>
                            </TouchableOpacity>
                            <View style={tw`p-6 bg-black/40 rounded-2xl border border-white/5`}>
                                <Text style={tw`italic text-white/80 leading-relaxed text-sm font-bold`}>"{selectedAlert?.description || "Sem detalhes adicionais."}"</Text>
                            </View>
                        </View>

                        <View style={tw`bg-[#121216] p-8 rounded-[32px] border border-white/5`}>
                            <Text style={tw`text-[10px] font-black uppercase text-white/30 mb-6`}>LOCALIZAÇÃO</Text>
                            <Text style={tw`text-xl font-black uppercase text-white mb-1`}>{selectedAlert?.neighborhood || "LOCALIZAÇÃO REMOTA"}</Text>
                            <Text style={tw`text-xs text-white/40 mb-8 font-bold`}>{selectedAlert?.manualAddress}</Text>
                            {selectedAlert?.location?.lat && (
                                <TouchableOpacity
                                    onPress={() => Linking.openURL(`https://www.google.com/maps?q=${selectedAlert.location.lat},${selectedAlert.location.lng}`)}
                                    style={tw`w-full py-6 bg-blue-600/10 rounded-2xl items-center border border-blue-500/20`}
                                >
                                    <Text style={tw`text-blue-400 text-[10px] font-black uppercase tracking-widest`}>VER NO MAPA GOOGLE</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {selectedAlert?.images && selectedAlert.images.length > 0 && (
                            <View style={tw`bg-[#121216] p-8 rounded-[32px] border border-white/5`}>
                                <Text style={tw`text-[10px] font-black uppercase text-white/30 mb-6`}>EVIDÊNCIAS VISUAIS</Text>
                                <View style={tw`flex-row gap-4 flex-wrap justify-center`}>
                                    {selectedAlert.images.map((url: string, idx: number) => (
                                        <TouchableOpacity
                                            key={idx}
                                            onPress={() => Linking.openURL(url)}
                                            style={tw`w-[45%] aspect-square rounded-2xl overflow-hidden border border-white/10`}
                                        >
                                            <Image source={{ uri: url }} style={tw`w-full h-full`} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Seção de IA Gemini removida - Feature desabilitada */}
                    </ScrollView>

                    {/* Botões FORA do ScrollView para serem sempre clicáveis */}
                    <View style={tw`p-4 bg-[#0d0d10] border-t border-white/10 flex-row gap-3`}>
                        <Animated.View style={{ flex: 1, transform: [{ scale: dispatchScale }] }}>
                            <TouchableOpacity
                                onPress={() => {
                                    animatePress(dispatchScale);
                                    updateAlertStatus(selectedAlert!.id, AlertStatus.IN_PROGRESS);
                                }}
                                activeOpacity={0.6}
                                style={tw`w-full py-5 bg-white/10 border border-white/20 rounded-2xl items-center`}
                            >
                                <Text style={tw`text-white font-black uppercase text-[10px]`}>DESPACHAR</Text>
                            </TouchableOpacity>
                        </Animated.View>

                        <Animated.View style={{ flex: 1, transform: [{ scale: resolveScale }] }}>
                            <TouchableOpacity
                                onPress={() => {
                                    animatePress(resolveScale);
                                    updateAlertStatus(selectedAlert!.id, AlertStatus.RESOLVED);
                                }}
                                activeOpacity={0.6}
                                style={tw`w-full py-5 bg-green-600 rounded-2xl items-center`}
                            >
                                <Text style={tw`text-white font-black uppercase text-[10px]`}>RESOLVER</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </View>
            </Modal>

            {/* Modal Config */}
            <Modal visible={showConfig} transparent animationType="fade">
                <View style={tw`flex-1 items-center justify-center p-6 bg-black/95`}>
                    <View style={tw`w-full max-w-md bg-[#121216] rounded-[40px] p-10 border border-white/10 shadow-2xl relative`}>
                        <TouchableOpacity onPress={() => setShowConfig(false)} style={tw`absolute top-8 right-8`}>
                            <X size={24} color="#64748b" />
                        </TouchableOpacity>

                        <View style={tw`flex-row items-center gap-4 mb-10`}>
                            <Settings size={24} color="#fbff00" />
                            <Text style={tw`text-xl font-black uppercase tracking-widest text-[#fbff00]`}>CONFIGURAÇÕES</Text>
                        </View>

                        <View style={tw`gap-6`}>
                            <View>
                                <Text style={tw`text-[10px] font-black uppercase text-white/40 mb-3 ml-2`}>URL DO BRASÃO MUNICIPAL</Text>
                                <TextInput
                                    placeholder="https://exemplo.com/brasao.png"
                                    placeholderTextColor="#4b5563"
                                    style={tw`w-full bg-black border border-white/5 rounded-2xl py-5 px-6 text-sm font-bold text-white outline-none`}
                                    value={newLogoUrl}
                                    onChangeText={setNewLogoUrl}
                                />
                            </View>
                            <View>
                                <Text style={tw`text-[10px] font-black uppercase text-white/40 mb-3 ml-2`}>NÚMERO DE EMERGÊNCIA (MODAL)</Text>
                                <TextInput
                                    placeholder="Ex: 112 ou 911"
                                    placeholderTextColor="#4b5563"
                                    style={tw`w-full bg-black border border-white/5 rounded-2xl py-5 px-6 text-sm font-bold text-white outline-none`}
                                    value={helpPhone}
                                    onChangeText={setHelpPhone}
                                />
                            </View>
                            <View>
                                <Text style={tw`text-[10px] font-black uppercase text-white/40 mb-3 ml-2`}>TEXTO DE AJUDA (MODAL)</Text>
                                <TextInput
                                    placeholder="Ex: PEÇA SOCORRO IMEDIATO"
                                    placeholderTextColor="#4b5563"
                                    style={tw`w-full bg-black border border-white/5 rounded-2xl py-5 px-6 text-sm font-bold text-white outline-none`}
                                    value={helpText}
                                    onChangeText={setHelpText}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={async () => {
                                    const docRef = doc(db, 'configuracoes', 'geral');
                                    await setDoc(docRef, {
                                        logoUrl: newLogoUrl,
                                        helpPhone: helpPhone,
                                        helpText: helpText
                                    }, { merge: true });
                                    setShowConfig(false);
                                }}
                                style={tw`w-full py-6 bg-[#fbff00] rounded-3xl items-center shadow-2xl border-b-4 border-black/20`}
                            >
                                <Text style={tw`text-black font-black uppercase text-xs tracking-widest`}>SALVAR E APLICAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default PoliceScreen;
