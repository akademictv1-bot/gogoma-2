import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RefreshCcw } from 'lucide-react-native';
import tw from 'twrnc';

interface AuthFormProps {
    mode: 'register' | 'login' | 'verification';
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
        smsCode?: string;
        setSmsCode?: (v: string) => void;
    };
    onResendSms?: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode, working, onSubmit, errorMsg, fields, onResendSms }) => {
    const NEON_YELLOW = "#fbff00";

    if (mode === 'verification') {
        return (
            <View style={tw`gap-4`}>
                <View style={tw`items-center mb-2`}>
                    <Text style={tw`text-white font-black text-lg uppercase`}>VERIFICAÇÃO SMS</Text>
                    <Text style={tw`text-slate-400 text-xs text-center mt-1`}>
                        Digite o código de 6 dígitos enviado para{'\n'}
                        <Text style={tw`text-[#fbff00]`}>{fields.phone}</Text>
                    </Text>
                </View>

                <TextInput
                    placeholder="000000"
                    placeholderTextColor="#475569"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={tw`w-full bg-[#0d0d10] border border-white/10 rounded-2xl p-4 text-white font-black text-3xl tracking-[1em] text-center`}
                    value={fields.smsCode}
                    onChangeText={v => fields.setSmsCode && fields.setSmsCode(v.replace(/\D/g, ''))}
                />

                {errorMsg && (
                    <View style={tw`bg-red-600/20 border border-red-600/30 p-3 rounded-2xl`}>
                        <Text style={tw`text-red-500 text-[10px] font-black text-center uppercase`}>{errorMsg}</Text>
                    </View>
                )}

                <TouchableOpacity
                    onPress={onSubmit}
                    disabled={working || (fields.smsCode?.length !== 6)}
                    style={[
                        tw`w-full py-5 rounded-3xl items-center justify-center mt-2 border-b-4`,
                        fields.smsCode?.length === 6 && !working 
                            ? [tw`border-black/20`, { backgroundColor: NEON_YELLOW, shadowColor: NEON_YELLOW, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 }]
                            : tw`bg-white/10 border-white/5`
                    ]}
                >
                    {working ? (
                        <ActivityIndicator color="black" />
                    ) : (
                        <Text style={[tw`font-black uppercase text-xs tracking-[0.2em]`, fields.smsCode?.length === 6 ? tw`text-black` : tw`text-white/50`]}>
                            CONFIRMAR CÓDIGO
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={onResendSms} disabled={working} style={tw`mt-4 items-center`}>
                    <Text style={tw`text-slate-400 text-xs underline font-bold`}>Não recebeu o código? Reenviar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={tw`gap-3`}>
            <TextInput
                placeholder="NOME COMPLETO"
                placeholderTextColor="#475569"
                style={tw`w-full bg-[#0d0d10] border border-white/10 rounded-2xl p-4 text-white text-sm font-bold uppercase`}
                value={fields.name}
                onChangeText={fields.setName}
            />
            <TextInput
                placeholder="TELEMÓVEL (EX: 841234567)"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                maxLength={9}
                style={tw`w-full bg-[#0d0d10] border border-white/10 rounded-2xl p-4 text-white font-bold text-xl`}
                value={fields.phone}
                onChangeText={v => fields.setPhone(v.replace(/\D/g, ''))}
            />

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
