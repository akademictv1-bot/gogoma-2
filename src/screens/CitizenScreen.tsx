import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Linking, Platform, Modal, KeyboardAvoidingView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Shield, Car, CheckCircle, MapPin, Activity, RefreshCcw, Phone, Info, AlertTriangle, WifiOff, ArrowLeft, Camera, X } from 'lucide-react-native';
import tw from 'twrnc';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';

import Header from '../components/Header';
import SOSButton from '../components/SOSButton';
import AuthForm from '../components/AuthForm';

import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, getDoc, onSnapshot, query, where, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentLocation, watchLocation, getAddressFromCoords } from '../services/location';
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
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [uploadingImages, setUploadingImages] = useState(false);

    // Estados para qualidade do GPS
    const [gpsQuality, setGpsQuality] = useState<'excellent' | 'good' | 'poor' | 'none'>('none');
    const [lastGpsUpdate, setLastGpsUpdate] = useState<number>(Date.now());
    const [helpPhone, setHelpPhone] = useState('112');
    const [helpText, setHelpText] = useState('PEÇA SOCORRO IMEDIATO');
    
    // Controlo de Cooldown (Anti-Intruso)
    const [lastSOSSent, setLastSOSSent] = useState<number>(0);
    const COOLDOWN_MINUTES = 3;

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
            if (locationSubscription) {
                try {
                    locationSubscription.remove();
                } catch (e) {
                    console.warn('[GPS] Erro ao remover subscrição de localização:', e);
                }
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

        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
            setErrorMsg("Não foi possível conectar. Por favor, ligue sua internet e tente novamente.");
            return;
        }

        setWorking(true);
        setErrorMsg(null);
        try {
            let finalProfile: UserProfile;

            const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
                let timeoutHandle: any;
                const timeoutPromise = new Promise<T>((_, reject) => {
                    timeoutHandle = setTimeout(() => reject(new Error('TIMEOUT_ERROR')), timeoutMs);
                });
                return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
            };

            if (authMode === 'register') {
                if (!regCity.trim() || !regNeighborhood.trim()) {
                    throw new Error("Cidade e Bairro são obrigatórios.");
                }

                // Verificar existente com timeout
                const userDoc = await withTimeout(getDoc(doc(db, 'usuarios', regPhone)));
                if (userDoc.exists()) throw new Error('Este número de telemóvel já está cadastrado.');

                const q = query(collection(db, 'usuarios'), where('name', '==', regName));
                const qs = await withTimeout(getDocs(q));
                if (!qs.empty) throw new Error('Este nome já está em uso.');

                finalProfile = { name: regName, phoneNumber: regPhone, city: regCity, neighborhood: regNeighborhood };
                
                try {
                     await withTimeout(setDoc(doc(db, 'usuarios', regPhone), { ...finalProfile, dataRegisto: Date.now() }));
                     // "Conta criada com sucesso! Dados sincronizados." happen implicitly, could Toast it
                } catch (saveErr: any) {
                     if (saveErr.message === 'TIMEOUT_ERROR') {
                         // A criação de conta pode ficar pendente localmente (Firebase cache), mas para ser seguro mostramos q não acabou ainda.
                         throw saveErr; 
                     } else {
                         throw saveErr;
                     }
                }
            } else {
                const userDoc = await withTimeout(getDoc(doc(db, 'usuarios', regPhone)));
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
            if (err.message === 'TIMEOUT_ERROR') {
                 setErrorMsg("Sua rede não está disponível. Verifique sua conexão e tente novamente.");
            } else if (err.message && (
                err.message.includes('obrigatório') || 
                err.message.includes('cadastrado') || 
                err.message.includes('uso') || 
                err.message.includes('encontrado') || 
                err.message.includes('corresponde')
            )) {
                setErrorMsg(err.message);
            } else {
                setErrorMsg(authMode === 'register' ? "Falha ao criar conta. Tente novamente em alguns segundos." : "Algo deu errado. Verifique sua conexão de internet e tente novamente.");
            }
        } finally {
            setWorking(false);
        }
    };

    const pickImage = async () => {
        if (selectedImages.length >= 2) {
            Alert.alert("Limite", "Máximo 2 fotos.");
            return;
        }

        // No Web, a melhor experiência é abrir a galeria diretamente
        // O navegador já oferece a opção de ficheiro ou câmara se disponível
        if (Platform.OS === 'web') {
            try {
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.5,
                });
                if (!result.canceled) {
                    setSelectedImages([...selectedImages, result.assets[0].uri]);
                }
            } catch (err) {
                console.error("Erro ao abrir galeria no Web:", err);
            }
            return;
        }

        // No Telemóvel, abrimos a CÂMARA diretamente (regra: fotos reais do momento)
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permissão", "Precisamos de acesso à câmara.");
            return;
        }

        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.5,
            });
            if (!result.canceled) {
                setSelectedImages([...selectedImages, result.assets[0].uri]);
            }
        } catch (err) {
            console.error("Erro ao abrir câmara:", err);
            Alert.alert("Erro", "Não foi possível abrir a câmara.");
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...selectedImages];
        newImages.splice(index, 1);
        setSelectedImages(newImages);
    };

    const handleSOS = async () => {
        if (!profile) return;

        const currentAccuracy = gpsAccuracy || 999;
        const isLowAccuracy = !location || location.lat === 0 || currentAccuracy > 30;

        await sendSOSAlert(isLowAccuracy);
    };

    const sendSOSAlert = async (isLowAccuracy: boolean) => {
        // 0. Verificar Cooldown Local
        const now = Date.now();
        const timeElapsed = now - lastSOSSent;
        if (lastSOSSent > 0 && timeElapsed < COOLDOWN_MINUTES * 60 * 1000) {
            const secondsRemaining = Math.ceil((COOLDOWN_MINUTES * 60 * 1000 - timeElapsed) / 1000);
            const minutes = Math.floor(secondsRemaining / 60);
            const seconds = secondsRemaining % 60;
            Alert.alert(
                "Aguarde",
                `O seu socorro já está a caminho. Para evitar sobrecarga no sistema, aguarde ${minutes > 0 ? `${minutes}m ` : ""}${seconds}s antes de enviar outro alerta.`
            );
            return;
        }

        setSending(true);
        setErrorMsg(null);
        try {
            // 1. Atualizar o Cooldown na Base de Dados (Segurança Real)
            await updateDoc(doc(db, 'usuarios', profile!.phoneNumber), {
                ultimo_pedido_sos: serverTimestamp()
            });

            // 2. Criar o documento de emergência IMEDIATAMENTE
            const sosDoc = await addDoc(collection(db, 'emergencias'), {
                userName: profile!.name,
                contactNumber: profile!.phoneNumber,
                description: description || "SOS IMEDIATO",
                location: {
                    lat: location?.lat || null,
                    lng: location?.lng || null
                },
                gpsAccuracy: gpsAccuracy || null,
                isLowAccuracy: isLowAccuracy,
                type: selectedType || EmergencyType.GENERAL,
                neighborhood: profile!.neighborhood,
                manualAddress: `${profile!.city}, ${profile!.neighborhood}`,
                timestamp: Date.now(),
                status: AlertStatus.NEW,
                dataAtualizacao: Date.now(),
                images: [],
                
                // Novos campos para Controle de Alarme Robusto
                contador_toques: 0,
                timestamp_ultimo_alarme: Date.now(),
                estado_alarme: {
                    tocando: false,
                    despacho_silenciado: false,
                    despacho_timestamp_silencio: null,
                    alarmes_completados: 0
                } // IMPORTANTE: O Alarme toca sempre no primeiro pedido!
            });

            // 2. Transição visual imediata para sucesso
            setStep(2);
            setLastSOSSent(Date.now());

            // 3. Notificação Push SEMPRE disparada para pedidos novos
            sendPushNotification(
                `🚑 SOS: ${selectedType || 'Emergência'}`,
                `${profile!.name} em ${profile!.neighborhood} precisa de ajuda!`
            ).catch(() => { });

            // 4. Iniciar upload de fotos e RESOLUÇÃO DE ENDEREÇO em BACKGROUND (sem esperar)
            const backgroundTasks = async () => {
                // a) Upload de fotos
                if (selectedImages.length > 0) {
                    await uploadImagesInBackground(sosDoc.id, selectedImages);
                }

                // b) Resolução de Endereço Real (Reverse Geocode)
                if (location?.lat && location?.lng) {
                    const realAddress = await getAddressFromCoords(location.lat, location.lng);
                    if (realAddress) {
                        await updateDoc(doc(db, 'emergencias', sosDoc.id), {
                            manualAddress: `${realAddress} (Auto) | ${profile!.city}, ${profile!.neighborhood} (Perfil)`,
                            dataAtualizacao: Date.now()
                        });

                    }
                }
            };

            backgroundTasks().catch(err => {
                console.error("Erro em tarefas de background:", err);
            });
        } catch (err: any) {
            console.error("Erro ao enviar SOS:", err);
            let userError = "Ligue-se à internet para pedir socorro.";
            if (err.message?.includes('network') || err.message?.includes('offline')) {
                userError = "Sem sinal de rede. Verifique a sua ligação.";
            }
            Alert.alert("Falha no Envio", `${userError}\n\nUse a Central de Ajuda.`, [{ text: 'OK' }]);
            setErrorMsg(userError);
        } finally {
            setSending(false);
        }
    };

    // Função auxiliar para upload em background sem travar o UI
    const uploadImagesInBackground = async (docId: string, images: string[]) => {
        try {
            const imageUrls: string[] = [];
            for (let i = 0; i < images.length; i++) {
                const uri = images[i];
                const response = await fetch(uri);
                const blob = await response.blob();
                const fileName = `sos_${docId}_${i}.jpg`;
                const storageRef = ref(storage, `alertas/${fileName}`);
                await uploadBytes(storageRef, blob);
                const url = await getDownloadURL(storageRef);
                imageUrls.push(url);
            }

            // Atualizar o documento com os links das imagens
            if (imageUrls.length > 0) {
                await updateDoc(doc(db, 'emergencias', docId), {
                    images: imageUrls,
                    dataAtualizacao: Date.now()
                });

            }
        } catch (err) {
            console.error("[OSS] Erro ao enviar imagens em background:", err);
        }
    };

    const makeCall = (num: string) => {
        Linking.openURL(`tel:${num}`);
    };

    const handleLogout = async () => {
        if (Platform.OS === 'web') {
            if (window.confirm("Tem a certeza que deseja sair da conta?")) {
                await clearUserSession('gogoma_user_profile');
                setProfile(null);
                setIsRegistered(false);
                setShowHelp(false);
            }
        } else {
            Alert.alert(
                "Sair da Conta",
                "Tem a certeza que deseja sair?",
                [
                    { text: "Cancelar", style: "cancel" },
                    { 
                        text: "Sair", 
                        style: "destructive", 
                        onPress: async () => {
                            await clearUserSession('gogoma_user_profile');
                            setProfile(null);
                            setIsRegistered(false);
                            setShowHelp(false);
                        } 
                    }
                ]
            );
        }
    };

    if (!isRegistered) {
        return (
            <ScrollView contentContainerStyle={tw`flex-grow bg-[#050507] p-6`} keyboardShouldPersistTaps="handled">
                <View style={tw`items-center mb-6 pt-4`}>
                    <View style={[tw`w-32 h-32 bg-white/5 p-4 rounded-[32px] mb-6 border-2 border-[#fbff0022] backdrop-blur-xl items-center justify-center`, { shadowColor: NEON_YELLOW, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 30 }]}>
                        <Image source={{ uri: municipioLogo }} style={[tw`w-[85%] h-[85%]`]} contentFit="contain" transition={200} />
                    </View>
                    <Text style={[tw`text-4xl font-black uppercase tracking-tighter text-center`, { color: NEON_YELLOW, textShadowColor: `${NEON_YELLOW}44`, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30 }]}>PORTAL{"\n"}CIDADÃO</Text>
                    <Text style={tw`text-slate-500 text-[10px] font-black mt-3 uppercase tracking-[0.4em] opacity-60 text-center`}>Moçambique Digital • Governo Municipal</Text>
                </View>

                <View style={tw`flex-row bg-[#0d0d10] p-1.5 rounded-[24px] mb-6 border border-white/5`}>
                    <TouchableOpacity onPress={() => setAuthMode('register')} style={[tw`flex-1 py-3 rounded-[18px] items-center`, { backgroundColor: authMode === 'register' ? NEON_YELLOW : 'transparent' }]}>
                        <Text style={[tw`text-[10px] font-black uppercase`, { color: authMode === 'register' ? 'black' : '#64748b' }]}>REGISTAR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAuthMode('login')} style={[tw`flex-1 py-3 rounded-[18px] items-center`, { backgroundColor: authMode === 'login' ? NEON_YELLOW : 'transparent' }]}>
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




                {/* Spacer/Push para o rodapé ficar no fundo absoluto do ecrã */}
                <View style={tw`flex-1 min-h-[150px]`} />

                {Platform.OS === 'web' && (
                        <View style={tw`mt-auto pt-24 border-t border-white/5 pb-32`}>
                            <View style={tw`flex-col md:flex-row justify-center items-center gap-x-8 gap-y-3 mb-6 px-4`}>
                                <Text style={tw`text-slate-400 text-[11px] text-center`}>Contactar: akademictv@gmail.com</Text>
                                <Text style={tw`text-slate-400 text-[11px] text-center`}>Telefones: +258 82 148 1573 / +258 87 464 4289</Text>
                                <Text style={tw`text-slate-400 text-[11px] text-center`}>Endereço: Chimoio, Moçambique</Text>
                            </View>
                            <View style={tw`flex-row justify-center items-center flex-wrap gap-x-6 gap-y-4 mb-8 px-4`}>
                                <TouchableOpacity onPress={() => window.location.href='/privacy.html'} style={tw`px-2 py-1`}>
                                    <Text style={tw`text-[#fbff00] text-xs underline font-bold uppercase tracking-tighter`}>Política de Privacidade</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => window.location.href='/terms.html'} style={tw`px-2 py-1`}>
                                    <Text style={tw`text-[#fbff00] text-xs underline font-bold uppercase tracking-tighter`}>Termos de Uso</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => window.location.href='/contactos.html'} style={tw`px-2 py-1`}>
                                    <Text style={tw`text-[#fbff00] text-xs underline font-bold uppercase tracking-tighter`}>Contactos</Text>
                                </TouchableOpacity>
                            </View>
                        <Text style={tw`text-slate-500 text-[10px] text-center mt-2`}>
                            © 2026 Akademic TV. Todos os direitos reservados.
                        </Text>
                        <Text style={tw`text-slate-500 text-[10px] text-center`}>
                            O sistema também pertence ao Município de Chimoio (CMC).
                        </Text>
                    </View>
                )}

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
        <View style={tw`flex-1 bg-black`}>
            <Header
                title={profile?.name || "Cidadão"}
                subtitle={profile?.neighborhood}
                onAction={() => setShowHelp(!showHelp)}
                actionIcon={<Info size={18} color={NEON_YELLOW} />}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={tw`flex-1`}
            >
                <ScrollView 
                    contentContainerStyle={tw`flex-grow justify-between pb-6`} 
                    keyboardShouldPersistTaps="handled" 
                    showsVerticalScrollIndicator={false}
                >
                    {/* TOPO: GPS Badge */}
                    <View style={tw`pt-6 px-6 items-center`}>
                        <View style={[
                            tw`flex-row items-center justify-center gap-3 py-2 px-6 rounded-full border shadow-lg mb-2`,
                            location ? tw`bg-green-600/10 border-green-500/30` : tw`bg-[#fbff0010] border-[#fbff0033]`
                        ]}>
                            <MapPin size={12} color={location ? "#22c55e" : NEON_YELLOW} />
                            <Text style={[tw`text-[8px] font-black uppercase tracking-widest`, { color: location ? "#22c55e" : NEON_YELLOW }]}>
                                {location ? `GPS OPERACIONAL (±${Math.round(gpsAccuracy || 0)}m)` : 'OBTENDO COORDENADAS...'}
                            </Text>
                        </View>

                        {gpsDenied && (
                            <View style={tw`bg-red-600/20 border border-red-600/40 p-2 rounded-xl flex-row items-center justify-center gap-2`}>
                                <WifiOff size={12} color="#ef4444" />
                                <Text style={tw`text-[8px] font-black text-red-500 uppercase`}>GPS BLOQUEADO. ATIVE NAS CONFIGURAÇÕES.</Text>
                            </View>
                        )}
                    </View>

                    {/* CENTRO: SOS Button e Categorias */}
                    <View style={tw`flex-1 items-center justify-center px-4 py-8`}> 
                        <SOSButton onClick={handleSOS} loading={sending} />
                        
                        <View style={tw`flex-row flex-wrap justify-center gap-3 mt-8 w-full`}>
                            {[
                                { type: EmergencyType.POLICE_CIVIL, icon: <Shield size={24} color={selectedType === EmergencyType.POLICE_CIVIL ? "black" : "#64748b"} />, label: 'CIVIL', color: tw`bg-[#fbff00]` },
                                { type: EmergencyType.POLICE_TRAFFIC, icon: <Car size={24} color={selectedType === EmergencyType.POLICE_TRAFFIC ? "white" : "#64748b"} />, label: 'TRÂNSITO', color: tw`bg-orange-600` },
                                { type: EmergencyType.DISASTER, icon: <Activity size={24} color={selectedType === EmergencyType.DISASTER ? "white" : "#64748b"} />, label: 'CLIMA', color: tw`bg-teal-600` }
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.label}
                                    onPress={() => setSelectedType(item.type as EmergencyType)}
                                    style={[
                                        tw`p-4 rounded-3xl items-center gap-2 border-2 transition-all min-w-[30%]`,
                                        selectedType === item.type ? [item.color, tw`border-white/20 scale-105 shadow-xl`] : tw`bg-[#0d0d10] border-white/5`
                                    ]}
                                >
                                    {item.icon}
                                    <Text style={[tw`text-[8px] font-black uppercase tracking-widest mt-1`, selectedType === item.type ? tw`text-white` : tw`text-slate-500`, item.type === EmergencyType.POLICE_CIVIL && selectedType === item.type && tw`text-black`]}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* BASE: Detalhes e Fotos */}
                    <View style={tw`px-4 w-full`}>
                        <View style={tw`p-5 bg-[#0d0d10] border border-white/10 rounded-3xl`}>
                            {selectedImages.length > 0 && (
                                <View style={tw`flex-row gap-3 mb-3`}>
                                    {selectedImages.map((uri, idx) => (
                                        <View key={idx} style={tw`relative`}>
                                            <Image source={{ uri }} style={tw`w-14 h-14 rounded-xl border border-white/20`} transition={150} />
                                            <TouchableOpacity
                                                onPress={() => removeImage(idx)}
                                                style={tw`absolute -top-2 -right-2 bg-red-600 rounded-full p-1 border border-black shadow-lg`}
                                            >
                                                <X size={10} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                            <View style={tw`flex-row items-center gap-3`}>
                                <TouchableOpacity
                                    onPress={pickImage}
                                    style={tw`bg-white/5 p-3.5 rounded-2xl border border-white/10`}
                                >
                                    <Camera size={22} color={selectedImages.length > 0 ? NEON_YELLOW : "#64748b"} />
                                </TouchableOpacity>
                                <View style={tw`flex-1 relative flex-row items-center bg-black border border-white/5 rounded-2xl px-5 py-0`}>
                                    <TextInput
                                        placeholder="DÊ DETALHES OU FOTOS"
                                        placeholderTextColor="#475569"
                                        style={tw`flex-1 py-4 text-white text-xs font-bold uppercase`}
                                        value={description}
                                        onChangeText={setDescription}
                                    />
                                </View>
                            </View>
                            {uploadingImages && (
                                <Text style={tw`text-[10px] text-yellow-500 font-bold mt-2 text-center uppercase`}>Enviando fotos...</Text>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

                {/* Modal de Ajuda / Opções */}
                <Modal visible={showHelp} transparent animationType="fade">
                    <View style={tw`flex-1 bg-black/80 items-center justify-center p-6`}>
                        <View style={tw`w-full max-w-sm bg-[#0d0d10] p-8 rounded-[32px] border border-white/10 shadow-2xl relative`}>
                            <TouchableOpacity onPress={() => setShowHelp(false)} style={tw`absolute top-6 right-6 p-2 bg-white/5 rounded-full z-10`}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>

                            <View style={tw`items-center mb-8`}>
                                <View style={tw`w-16 h-16 bg-[#fbff0020] rounded-full items-center justify-center mb-4 border border-[#fbff0040]`}>
                                    <Info size={28} color={NEON_YELLOW} />
                                </View>
                                <Text style={tw`text-xl font-black uppercase text-white tracking-widest text-center`}>AJUDA / OPÇÕES</Text>
                            </View>

                            <View style={tw`bg-[#121216] p-6 rounded-2xl border border-white/5 mb-6`}>
                                <Text style={tw`text-[10px] font-black uppercase text-white/40 mb-2 text-center`}>Mensagem do Comando</Text>
                                <Text style={tw`text-sm font-bold text-white text-center leading-relaxed`}>{helpText}</Text>
                            </View>

                            <View style={tw`gap-4`}>
                                <TouchableOpacity onPress={() => makeCall(helpPhone)} style={tw`w-full py-4 bg-green-600 rounded-2xl items-center flex-row justify-center gap-3 shadow-xl`}>
                                    <Phone size={18} color="white" />
                                    <Text style={tw`text-white font-black uppercase text-xs tracking-widest`}>LIGAR: {helpPhone}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleLogout} style={tw`w-full py-4 bg-red-600/10 border border-red-500/30 rounded-2xl items-center flex-row justify-center gap-3`}>
                                    <AlertTriangle size={18} color="#ef4444" />
                                    <Text style={tw`text-red-500 font-black uppercase text-xs tracking-widest`}>SAIR DA CONTA</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
        </View>
    );
};

export default CitizenScreen;