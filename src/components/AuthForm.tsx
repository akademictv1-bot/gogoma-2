import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import tw from 'twrnc';
import { ChevronDown } from 'lucide-react-native';

const BAIRROS_CHIMOIO = [
    'Machava', 'Espangano', '25 de Setembro', 'Cateme', 'Itaquenha',
    'Muelha', 'Vila Nova', 'Zona Verde', 'Trângulo', 'Missão',
    'Matica', 'Sambai', 'Fazenda', 'Maguanha', 'Nhamachaca',
];

interface AuthFormProps {
    mode: 'register' | 'login';
    working: boolean;
    onSubmit: () => void;
    errorMsg: string | null;
    fields: {
        name: string;
        setName: (v: string) => void;
        phone: string;
        setPhone: (v: string) => void;
        city?: string;
        setCity?: (v: string) => void;
        neighborhood?: string;
        setNeighborhood?: (v: string) => void;
    };
}

const AuthForm: React.FC<AuthFormProps> = ({ mode, working, onSubmit, errorMsg, fields }) => {
    const NEON_YELLOW = "#fbff00";
    const [showBairroPicker, setShowBairroPicker] = useState(false);

    return (
        <View style={tw`gap-3`}>
            <TextInput
                placeholder="NOME COMPLETO"
                placeholderTextColor="#475569"
                style={tw`w-full bg-[#0d0d10] border border-white/10 rounded-2xl p-4 text-white text-sm font-bold uppercase`}
                value={fields.name}
                onChangeText={fields.setName}
            />
            <View style={tw`w-full bg-[#0d0d10] border border-white/10 rounded-2xl flex-row items-center px-4`}>
                <Text style={tw`text-white/40 font-bold text-xl mr-1`}>+258</Text>
                <TextInput
                    placeholder="841234567"
                    placeholderTextColor="#475569"
                    keyboardType="phone-pad"
                    maxLength={9}
                    style={tw`flex-1 py-4 text-white font-bold text-xl`}
                    value={fields.phone}
                    onChangeText={v => fields.setPhone(v.replace(/\D/g, ''))}
                />
            </View>

            {mode === 'register' && fields.setCity && fields.setNeighborhood && (
                <View style={tw`flex-row gap-3`}>
                    <TouchableOpacity
                        onPress={() => { if (fields.setCity) fields.setCity('Chimoio'); }}
                        style={tw`flex-1 bg-[#0d0d10] border border-white/10 rounded-2xl p-4 flex-row items-center justify-between`}
                    >
                        <Text style={[tw`text-[10px] font-bold uppercase`, fields.city ? tw`text-white` : tw`text-[#475569]`]}>
                            {fields.city || 'CIDADE'}
                        </Text>
                        <ChevronDown size={14} color="#475569" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setShowBairroPicker(true)}
                        style={tw`flex-1 bg-[#0d0d10] border border-white/10 rounded-2xl p-4 flex-row items-center justify-between`}
                    >
                        <Text style={[tw`text-[10px] font-bold uppercase`, fields.neighborhood ? tw`text-white` : tw`text-[#475569]`]}>
                            {fields.neighborhood || 'BAIRRO'}
                        </Text>
                        <ChevronDown size={14} color="#475569" />
                    </TouchableOpacity>

                    <Modal visible={showBairroPicker} transparent animationType="fade">
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setShowBairroPicker(false)}
                            style={tw`flex-1 bg-black/80 items-center justify-center p-6`}
                        >
                            <View style={tw`w-full max-w-sm bg-[#0d0d10] rounded-[32px] border border-white/10 overflow-hidden`}>
                                <View style={tw`p-6 border-b border-white/5`}>
                                    <Text style={tw`text-white font-black uppercase text-xs tracking-widest text-center`}>SELECIONA O BAIRRO</Text>
                                </View>
                                <ScrollView style={tw`max-h-80`}>
                                    {BAIRROS_CHIMOIO.map((bairro) => (
                                        <TouchableOpacity
                                            key={bairro}
                                            onPress={() => {
                                                fields.setNeighborhood?.(bairro);
                                                setShowBairroPicker(false);
                                            }}
                                            style={[tw`p-5 border-b border-white/5`, fields.neighborhood === bairro && tw`bg-[#fbff00]/10`]}
                                        >
                                            <Text style={[tw`text-sm font-bold uppercase`, fields.neighborhood === bairro ? tw`text-[#fbff00]` : tw`text-white`]}>
                                                {bairro}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                </View>
            )}

            {errorMsg && (
                <View style={tw`bg-red-600/20 border border-red-600/30 p-3 rounded-2xl`}>
                    <Text style={tw`text-red-500 text-[10px] font-black text-center uppercase`}>{errorMsg}</Text>
                </View>
            )}

            <TouchableOpacity
                onPress={onSubmit}
                disabled={working}
                style={[
                    tw`w-full py-5 rounded-3xl items-center justify-center mt-2 border-b-4 border-black/20`,
                    { backgroundColor: NEON_YELLOW, shadowColor: NEON_YELLOW, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 }
                ]}
            >
                {working ? (
                    <ActivityIndicator color="black" />
                ) : (
                    <Text style={tw`text-black font-black uppercase text-xs tracking-[0.2em]`}>
                        {mode === 'register' ? 'CRIAR CONTA MUNICIPAL' : 'ENTRAR NO PORTAL'}
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

export default AuthForm;
