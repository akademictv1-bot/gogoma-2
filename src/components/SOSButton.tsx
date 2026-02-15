import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';

interface SOSButtonProps {
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
}

const SOSButton: React.FC<SOSButtonProps> = ({ onClick, disabled, loading }) => {
    return (
        <View style={tw`items-center justify-center py-8`}>
            <TouchableOpacity
                onPress={onClick}
                disabled={disabled || loading}
                style={[
                    tw`w-64 h-64 rounded-full items-center justify-center bg-red-600 border-[12px] border-red-800 shadow-xl`,
                    { shadowColor: '#dc2626', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 40 },
                    loading && tw`opacity-50`
                ]}
            >
                <Text style={tw`text-7xl font-black tracking-tighter leading-none mb-1 text-white`}>SOS</Text>
                <Text style={tw`text-[10px] font-black uppercase tracking-[0.4em] text-white opacity-50`}>
                    {loading ? 'A ENVIAR...' : 'PEDIR AJUDA'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

export default SOSButton;
