import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import tw from 'twrnc';

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
                    <TextInput
                        placeholder="CIDADE"
                        placeholderTextColor="#475569"
                        style={tw`flex-1 bg-[#0d0d10] border border-white/10 rounded-2xl p-4 text-white text-[10px] font-bold uppercase`}
                        value={fields.city}
                        onChangeText={fields.setCity}
                    />
                    <TextInput
                        placeholder="BAIRRO"
                        placeholderTextColor="#475569"
                        style={tw`flex-1 bg-[#0d0d10] border border-white/10 rounded-2xl p-4 text-white text-[10px] font-bold uppercase`}
                        value={fields.neighborhood}
                        onChangeText={fields.setNeighborhood}
                    />
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
