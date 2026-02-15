import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { User, RefreshCcw } from 'lucide-react-native';
import tw from 'twrnc';

interface HeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    onAction?: () => void;
    actionIcon?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, icon, onAction, actionIcon }) => {
    const NEON_YELLOW = "#fbff00";

    return (
        <View style={tw`p-4 bg-[#0d0d10] border-b border-white/5 flex-row justify-between items-center`}>
            <View style={tw`flex-row items-center gap-3`}>
                <View style={[tw`w-10 h-10 rounded-xl items-center justify-center border border-[#fbff0033]`, { backgroundColor: '#fbff0010' }]}>
                    {icon || <User size={18} color={NEON_YELLOW} />}
                </View>
                <View>
                    <Text style={tw`text-[10px] font-black uppercase tracking-tight text-white`}>{title}</Text>
                    {subtitle && <Text style={tw`text-[8px] text-slate-500 font-bold uppercase`}>{subtitle}</Text>}
                </View>
            </View>
            {actionIcon ? (
                onAction ? (
                    <TouchableOpacity onPress={onAction} style={tw`p-2`}>
                        {actionIcon}
                    </TouchableOpacity>
                ) : (
                    <View style={tw`flex-row items-center`}>
                        {actionIcon}
                    </View>
                )
            ) : onAction ? (
                <TouchableOpacity onPress={onAction} style={tw`p-2`}>
                    <RefreshCcw size={18} color="#64748b" />
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

export default Header;
