import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, Linking, Platform, Modal, KeyboardAvoidingView } from 'react-native';
import { Shield, Car, CheckCircle, MapPin, Activity, RefreshCcw, Phone, Info, AlertTriangle, WifiOff, ArrowLeft } from 'lucide-react-native';
import tw from 'twrnc';

import Header from '../components/Header';
import SOSButton from '../components/SOSButton';
import AuthForm from '../components/AuthForm';

import { db } from '../services/firebase';
import { collection, addDoc, doc, getDoc, onSnapshot, query, where, getDocs, setDoc } from 'firebase/firestore';
import { getCurrentLocation, watchLocation } from '../services/location';
import { saveUserSession, getUserSession, clearUserSession } from '../services/storage';
import { validateMozambiquePhone } from '../services/cryptoUtils';
import { sendPushNotification } from '../services/notificationService';

import { EmergencyType, AlertStatus, UserProfile } from '../types';

const CitizenScreen: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
    const [municipioLogo, setMunicipioLogo] = useState("https://upload.wikimedia.org/wikipedia/commons/4/4b/Bras%C3%A3o_de_Chimoio.png");

    const [regName, setRegName] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regCity, setRegCity] = useState('');
    const [regNeighborhood, setRegNeighborhood] = useState('');

    const [description, setDescription] = useState('');
    const [selectedType, setSelectedType] = useState<EmergencyType | null>(null);
    const [step, setStep] = useState<0 | 1 | 2>(0);
    const [location, setLocation] = useState<any>(null);
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [gpsDenied, setGpsDenied] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [working, setWorking] = useState(false);
    const [sending, setSending] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Estados para qualidade do GPS
    const [gpsQuality, setGpsQuality] = useState<'excellent' | 'good' | 'poor' | 'none'>('none');
    const [lastGpsUpdate, setLastGpsUpdate] = useState<number>(Date.now());
    const [helpPhone, setHelpPhone] = useState('112');
    const [helpText, setHelpText] = useState('PEÇA SOCORRO IMEDIATO');

    const NEON_YELLOW = "#fbff00";

    const [configLoaded, setConfigLoaded] = useState(false);

    useEffect(() => {
        // 1. CARREGAMENTO IMEDIATO DO CACHE LOCAL (Instante 0)
        // Isso garante que o número de telefone correto apareça mesmo sem internet
        const loadCache = async () => {
            try {
                const [cachedConfig, savedProfile] = await Promise.all([
                    getUserSession('gogoma_config_cache'),
                    getUserSession('gogoma_user_profile')
                ]);

                if (cachedConfig) {
                    if (cachedConfig.logoUrl) setMunicipioLogo(cachedConfig.logoUrl);
                    if (cachedConfig.helpPhone) setHelpPhone(cachedConfig.helpPhone);
                    if (cachedConfig.helpText) setHelpText(cachedConfig.helpText);
                }

                if (savedProfile) {
                    setProfile(savedProfile);
                    setIsRegistered(true);
                }
                setConfigLoaded(true);
            } catch (e) {
                console.error("Erro ao carregar cache inicial:", e);
                setConfigLoaded(true);
            }
        };
        loadCache();

        // 2. CONFIGURAÇÃO REMOTA (Firestore + Listener)
        const docRef = doc(db, 'configuracoes', 'geral');
        const unsubConfig = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.logoUrl) setMunicipioLogo(data.logoUrl);
                if (data.helpPhone) setHelpPhone(data.helpPhone); // Prioridade máxima se vier do server
                if (data.helpText) setHelpText(data.helpText);

                // Atualizar cache apenas com dados válidos
                if (data.helpPhone || data.logoUrl) {
                    await saveUserSession('gogoma_config_cache', data);
                }
            }
        });

        // 3. LOCALIZAÇÃO PERSISTENTE (Watch)
        let locationSubscription: any = null;
        const startWatching = async () => {
            try {
                // Get initial location
                const initialLoc = await getCurrentLocation();
                if (initialLoc) {
                    setLocation(initialLoc);
                    setGpsAccuracy(initialLoc.accuracy);
                    setLastGpsUpdate(Date.now());
                    updateGpsQuality(initialLoc.accuracy);
                }

                // Start watching
                locationSubscription = await watchLocation((newLoc) => {
                    if (newLoc) {
                        setLocation(newLoc);
                        setGpsAccuracy(newLoc.accuracy);
                        setLastGpsUpdate(Date.now());
                        updateGpsQuality(newLoc.accuracy);
                    }
                });
            } catch (err) {
                setGpsDenied(true);
                console.error("Erro GPS:", err);
            }
        };
        startWatching();

        return () => {
            unsubConfig();
            if (locationSubscription && locationSubscription.remove) {
                locationSubscription.remove();
            }
        };
    }, []);

    // Função para atualizar qualidade do GPS
    const updateGpsQuality = (accuracy: number | null) => {
        if (!accuracy) {
            setGpsQuality('none');
            return;
        }

        if (accuracy < 10) {
            setGpsQuality('excellent'); // < 10m = Excelente
        } else if (accuracy < 30) {
            setGpsQuality('good'); // 10-30m = Bom
        } else if (accuracy < 100) {
            setGpsQuality('poor'); // 30-100m = Ruim
        } else {
            setGpsQuality('none'); // > 100m = Sem sinal
        }
    };

    const handleAuth = async () => {
        if (!regName.trim()) {
            setErrorMsg("O nome é obrigatório.");
            return;
        }
        if (!validateMozambiquePhone(regPhone)) {
            setErrorMsg("Número inválido. Use 9 dígitos começando por 82, 83, 84, 85, 86 ou 87.");
            return;
        }

        setWorking(true);
        setErrorMsg(null);
        try {
            let finalProfile: UserProfile;
            if (authMode === 'register') {
                if (!regCity.trim() || !regNeighborhood.trim()) {
                    throw new Error("Cidade e Bairro são obrigatórios.");
                }

                // Verificar existente
                const userDoc = await getDoc(doc(db, 'usuarios', regPhone));
                if (userDoc.exists()) throw new Error('Este número de telemóvel já está cadastrado.');

                const q = query(collection(db, 'usuarios'), where('name', '==', regName));
                const qs = await getDocs(q);
                if (!qs.empty) throw new Error('Este nome já está em uso.');

                finalProfile = { name: regName, phoneNumber: regPhone, city: regCity, neighborhood: regNeighborhood };
                await setDoc(doc(db, 'usuarios', regPhone), { ...finalProfile, dataRegisto: Date.now() });
            } else {
                const userDoc = await getDoc(doc(db, 'usuarios', regPhone));
                if (!userDoc.exists()) {
                    throw new Error("Telefone não encontrado. Por favor, registe-se.");
                }
                const user = userDoc.data() as UserProfile;
                if (user.name.toLowerCase().trim() !== regName.toLowerCase().trim()) {
                    throw new Error("O nome não corresponde ao número de telemóvel.");
                }
                finalProfile = user;
            }
            await saveUserSession('gogoma_user_profile', finalProfile);
            setProfile(finalProfile);
            setIsRegistered(true);
        } catch (err: any) {
            setErrorMsg(err.message || "Erro na autenticação. Verifique sua conexão.");
        } finally {
            setWorking(false);
        }
    };

    const handleSOS = async () => {
        if (!profile) return;

        const currentAccuracy = gpsAccuracy || 999;

        // Se o GPS está bom (< 30m), envia direto para ser ultra-rápido
        if (location && location.lat !== 0 && currentAccuracy <= 30) {
            await sendSOSAlert(false); // isLowAccuracy = false
            return;
        }

        // Se o GPS está ruim, negado ou demorando (>30m ou null)
        let message = "A sua localização exata está a ser obtida ou é imprecisa.";
        if (gpsDenied) message = "O acesso ao GPS foi negado.";
        else if (currentAccuracy > 30 && currentAccuracy < 999) message = `O sinal do GPS está fraco (precisão: ${currentAccuracy.toFixed(0)}m).`;
        else if (!location) message = "Ainda não conseguimos obter a sua localização.";

        Alert.alert(
            '🚨 AJUDA IMEDIATA',
            `${message}\n\nDeseja enviar o socorro agora com os seus dados de registo? O Comando poderá ligar para confirmar o local exato.`,
            [
                { text: 'Aguardar GPS', style: 'cancel' },
                {
                    text: 'Enviar Socorro Já',
                    style: 'destructive',
                    onPress: () => sendSOSAlert(true) // isLowAccuracy = true
                }
            ]
        );
    };

    // Função separada para enviar alerta (após validações)
    const sendSOSAlert = async (isLowAccuracy: boolean) => {
        setSending(true);
        setErrorMsg(null);
        try {
            await addDoc(collection(db, 'emergencias'), {
                userName: profile!.name,
                contactNumber: profile!.phoneNumber,
                description: description || "SOS IMEDIATO",
                location: {
                    lat: location?.lat || null,
                    lng: location?.lng || null
                },
                gpsAccuracy: gpsAccuracy || null,
                isLowAccuracy: isLowAccuracy, // Marcação para o operador
                type: selectedType || EmergencyType.GENERAL,
                neighborhood: profile!.neighborhood,
                manualAddress: `${profile!.city}, ${profile!.neighborhood}`,
                timestamp: Date.now(),
                status: AlertStatus.NEW,
                dataAtualizacao: Date.now()
            });

            // Enviar Notificação Push para Operadores
            sendPushNotification(
                `🚑 SOS: ${selectedType || 'Emergência'}`,
                `${profile!.name} em ${profile!.neighborhood} precisa de ajuda!${isLowAccuracy ? ' (Sinal GPS Fraco)' : ''}`
            );

            Alert.alert(
                '✅ SOS Enviado!',
                isLowAccuracy
                    ? "Alerta enviado com sinal de GPS fraco. Mantenha o telefone livre para uma possível chamada do Comando."
                    : `Alerta enviado com sucesso! Ajuda está a caminho do local identificado.`,
                [{ text: 'OK', onPress: () => setStep(2) }]
            );
        } catch (err: any) {
            console.error("Erro ao enviar SOS:", err);
            Alert.alert("Falha Crítica", `Não foi possível enviar o SOS: ${err.message || "Erro desconhecido"}.`);
            setErrorMsg("Falha ao enviar SOS. Verifique a sua ligação.");
        } finally {
            setSending(false);
        }
    };

    const makeCall = (num: string) => {
        Linking.openURL(`tel:${num}`);
    };

    if (!isRegistered) {
        return (
            <ScrollView contentContainerStyle={tw`flex-grow bg-[#050507] p-6`}>
                <View style={tw`items-center mb-8 pt-10`}>
                    <View style={[tw`w-40 h-40 bg-white/5 p-4 rounded-[48px] mb-8 border-2 border-[#fbff0022] backdrop-blur-xl items-center justify-center`, { shadowColor: NEON_YELLOW, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 30 }]}>
                        <Image source={{ uri: municipioLogo }} style={[tw`w-[85%] h-[85%]`, { resizeMode: 'contain' }]} />
                    </View>
                    <Text style={[tw`text-5xl font-black uppercase tracking-tighter text-center`, { color: NEON_YELLOW, textShadowColor: `${NEON_YELLOW}44`, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30 }]}>PORTAL{"\n"}CIDADÃO</Text>
                    <Text style={tw`text-slate-500 text-[10px] font-black mt-4 uppercase tracking-[0.4em] opacity-60 text-center`}>Moçambique Digital • Governo Municipal</Text>
                </View>

                <View style={tw`flex-row bg-[#0d0d10] p-1.5 rounded-[24px] mb-8 border border-white/5`}>
                    <TouchableOpacity onPress={() => setAuthMode('register')} style={[tw`flex-1 py-4 rounded-[18px] items-center`, { backgroundColor: authMode === 'register' ? NEON_YELLOW : 'transparent' }]}>
                        <Text style={[tw`text-[10px] font-black uppercase`, { color: authMode === 'register' ? 'black' : '#64748b' }]}>REGISTAR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAuthMode('login')} style={[tw`flex-1 py-4 rounded-[18px] items-center`, { backgroundColor: authMode === 'login' ? NEON_YELLOW : 'transparent' }]}>
                        <Text style={[tw`text-[10px] font-black uppercase`, { color: authMode === 'login' ? 'black' : '#64748b' }]}>ENTRAR</Text>
                    </TouchableOpacity>
                </View>

                <AuthForm
                    mode={authMode}
                    working={working}
                    onSubmit={handleAuth}
                    errorMsg={errorMsg}
                    fields={{
                        name: regName, setName: setRegName,
                        phone: regPhone, setPhone: setRegPhone,
                        city: regCity, setCity: setRegCity,
                        neighborhood: regNeighborhood, setNeighborhood: setRegNeighborhood
                    }}
                />
            </ScrollView>
        );
    }

    if (step === 2) {
        return (
            <View style={tw`flex-1 items-center justify-center bg-[#050507] p-8`}>
                <View style={[tw`bg-green-600 rounded-[40px] p-10 mb-8 shadow-xl`, { shadowColor: '#16a34a', shadowOpacity: 0.3, shadowRadius: 25 }]}>
                    <CheckCircle size={80} color="white" />
                </View>
                <Text style={tw`text-4xl font-black uppercase tracking-tighter text-green-500 text-center`}>SOS ENVIADO!</Text>
                <Text style={tw`text-slate-400 text-sm mt-4 text-center leading-relaxed font-bold`}>A polícia municipal recebeu o seu alerta.{"\n"}Mantenha a calma e aguarde no local se possível.</Text>
                <TouchableOpacity onPress={() => { setStep(0); setSelectedType(null); setDescription(''); }} style={tw`mt-12 flex-row items-center gap-3 bg-[#0d0d10] px-10 py-5 rounded-full border border-white/5`}>
                    <RefreshCcw size={16} color="white" />
                    <Text style={tw`text-white font-black uppercase text-[10px]`}>NOVO ALERTA</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={tw`flex-1 bg-black`}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <Header
                title={profile?.name || "Cidadão"}
                subtitle={profile?.neighborhood}
                onAction={() => setShowHelp(!showHelp)}
                actionIcon={<Info size={18} color={NEON_YELLOW} />}
            />

            {/* Modal de Ajuda / SOS Alternativo */}
            <Modal visible={showHelp} animationType="slide" transparent={false}>
                <View style={tw`flex-1 bg-[#0a0a0c]`}>
                    <View style={tw`p-4 bg-[#0d0d10] border-b border-white/10 flex-row items-center gap-4`}>
                        <TouchableOpacity onPress={() => setShowHelp(false)} style={tw`p-2 bg-white/5 rounded-xl`}>
                            <ArrowLeft size={20} color="white" />
                        </TouchableOpacity>
                        <Text style={tw`text-sm font-black uppercase text-red-600`}>CENTRAL DE AJUDA</Text>
                    </View>

                    {configLoaded ? (
                        <ScrollView style={tw`flex-1 p-8 gap-8`} keyboardShouldPersistTaps="handled">
                            <View style={tw`bg-[#121216] p-10 rounded-[40px] border border-white/5 shadow-2xl`}>
                                <View style={tw`w-20 h-20 bg-red-600/10 rounded-full items-center justify-center mb-8 self-center`}>
                                    <Phone size={40} color="#ef4444" />
                                </View>
                                <Text style={tw`text-[10px] font-black uppercase text-white/30 text-center mb-4 tracking-widest`}>LINHA DE EMERGÊNCIA</Text>
                                <Text style={tw`text-4xl font-black text-white text-center mb-2`}>{helpPhone}</Text>
                                <Text style={tw`text-[11px] font-bold text-red-500 text-center uppercase mb-10 tracking-widest`}>{helpText}</Text>

                                <TouchableOpacity
                                    onPress={() => Linking.openURL(`tel:${helpPhone}`)}
                                    style={tw`w-full py-6 bg-red-600 rounded-3xl items-center shadow-2xl flex-row justify-center gap-4`}
                                >
                                    <Phone size={20} color="white" />
                                    <Text style={tw`text-white font-black uppercase text-sm`}>LIGAR AGORA</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={tw`bg-[#121216] p-8 rounded-[32px] border border-white/5`}>
                                <View style={tw`flex-row items-center gap-3 mb-6`}>
                                    <Info size={18} color="#fbff00" />
                                    <Text style={tw`text-[10px] font-black uppercase text-white/40 tracking-widest`}>SOBRE O GOGOMA</Text>
                                </View>
                                <Text style={tw`text-sm text-white/80 leading-relaxed font-bold`}>Este aplicativo foi desenvolvido para agilizar o atendimento de emergências. Seus dados de localização e registro são enviados diretamente para o Centro de Operações.</Text>
                            </View>

                            <View style={tw`bg-red-600/5 p-8 rounded-[32px] border border-red-600/10 mb-20`}>
                                <View style={tw`flex-row items-center gap-3 mb-4`}>
                                    <AlertTriangle size={18} color="#ef4444" />
                                    <Text style={tw`text-[10px] font-black uppercase text-red-500 tracking-widest`}>AVISO LEGAL</Text>
                                </View>
                                <Text style={tw`text-[11px] text-white/50 font-bold leading-relaxed`}>O ABUSO DO SISTEMA E TROTES SÃO CRIMES. USE COM RESPONSABILIDADE PARA NÃO COMPROMETER O SOCORRO DE QUEM REALMENTE PRECISA.</Text>

                                <TouchableOpacity
                                    onPress={async () => {
                                        await clearUserSession('gogoma_user_profile');
                                        setIsRegistered(false);
                                        setProfile(null);
                                        setStep(0);
                                        setShowHelp(false);
                                    }}
                                    style={tw`flex-row items-center justify-center gap-3 p-6 bg-white/5 border border-white/10 rounded-2xl mt-8`}
                                >
                                    <RefreshCcw size={16} color="#ef4444" />
                                    <Text style={tw`text-[10px] font-black uppercase text-red-500`}>SAIR / MUDAR PERFIL</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    ) : (
                        <View style={tw`flex-1 items-center justify-center`}>
                            <RefreshCcw size={32} color={NEON_YELLOW} style={tw`opacity-20`} />
                        </View>
                    )}
                </View>
            </Modal>

            <View style={tw`flex-1 p-6 justify-center gap-6`}>
                <View style={[
                    tw`flex-row items-center justify-center gap-3 py-2.5 px-6 rounded-full self-center border text-[9px] font-black uppercase tracking-[0.2em] shadow-lg`,
                    location ? tw`bg-green-600/10 border-green-500/30` : tw`bg-[#fbff0010] border-[#fbff0033]`
                ]}>
                    <MapPin size={14} color={location ? "#22c55e" : NEON_YELLOW} />
                    <Text style={[tw`text-[9px] font-black uppercase tracking-widest`, { color: location ? "#22c55e" : NEON_YELLOW }]}>
                        {location ? `GPS OPERACIONAL (±${Math.round(gpsAccuracy || 0)}m)` : 'OBTENDO COORDENADAS...'}
                    </Text>
                </View>

                {gpsDenied && (
                    <View style={tw`bg-red-600/20 border border-red-600/40 p-3 rounded-xl flex-row items-center justify-center gap-2`}>
                        <WifiOff size={14} color="#ef4444" />
                        <Text style={tw`text-[8px] font-black text-red-500 uppercase`}>GPS BLOQUEADO. ATIVE NAS CONFIGURAÇÕES.</Text>
                    </View>
                )}

                <SOSButton onClick={handleSOS} loading={sending} />

                <View style={tw`flex-row flex-wrap justify-center gap-4`}>
                    {[
                        { type: EmergencyType.POLICE_CIVIL, icon: <Shield size={32} color={selectedType === EmergencyType.POLICE_CIVIL ? "black" : "#64748b"} />, label: 'CIVIL', color: tw`bg-[#fbff00]` },
                        { type: EmergencyType.POLICE_TRAFFIC, icon: <Car size={32} color={selectedType === EmergencyType.POLICE_TRAFFIC ? "white" : "#64748b"} />, label: 'TRÂNSITO', color: tw`bg-orange-600` },
                        { type: EmergencyType.DISASTER, icon: <Activity size={32} color={selectedType === EmergencyType.DISASTER ? "white" : "#64748b"} />, label: 'CLIMA', color: tw`bg-teal-600` }
                    ].map((item) => (
                        <TouchableOpacity
                            key={item.label}
                            onPress={() => setSelectedType(item.type as EmergencyType)}
                            style={[
                                tw`p-5 rounded-3xl items-center gap-3 border-2 transition-all`,
                                selectedType === item.type ? [item.color, tw`border-white/20 scale-105 shadow-xl`] : tw`bg-[#0d0d10] border-white/5`
                            ]}
                        >
                            {item.icon}
                            <Text style={[tw`text-[9px] font-black uppercase tracking-widest`, selectedType === item.type ? tw`text-white` : tw`text-slate-500`, item.type === EmergencyType.POLICE_CIVIL && selectedType === item.type && tw`text-black`]}>{item.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={tw`p-6 bg-[#0d0d10] border-t border-white/5`}>
                <View style={tw`relative flex-row items-center bg-black border border-white/5 rounded-3xl px-6 py-1`}>
                    <MapPin size={24} color="#64748b" style={tw`mr-3`} />
                    <TextInput
                        placeholder="DÊ DETALHES (OPCIONAL)"
                        placeholderTextColor="#475569"
                        style={tw`flex-1 py-5 text-white text-sm font-bold uppercase`}
                        value={description}
                        onChangeText={setDescription}
                    />
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default CitizenScreen;
