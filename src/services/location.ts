import * as Location from 'expo-location';

export const requestLocationPermissions = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
};

export const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
        throw new Error('Permissão de localização negada');
    }

    try {
        // 1. Tentar cache recente com boa precisão (resposta instantânea)
        const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 30000,
        });

        if (lastKnown && lastKnown.coords.accuracy && lastKnown.coords.accuracy < 50) {
            return {
                lat: lastKnown.coords.latitude,
                lng: lastKnown.coords.longitude,
                accuracy: lastKnown.coords.accuracy,
            };
        }
    } catch (e) {
        // Ignora erro no cache e segue para busca real
    }

    // 2. Busca real com precisão máxima — força o chip GPS nativo (funciona offline)
    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
    });

    return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
    };
};

export const getHighAccuracyLocation = async () => {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
        throw new Error('Permissão de localização negada');
    }

    // Tenta até 3 vezes com 2s de espera para o GPS convergir para melhor precisão
    for (let i = 0; i < 3; i++) {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
            });

            const acc = location.coords.accuracy;
            // Se a precisão for boa (≤15m) ou já é a última tentativa, devolve
            if (acc !== null && acc <= 15) {
                return {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    accuracy: acc,
                };
            }

            if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (e) {
            if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    // Última tentativa — devolve o que vier
    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
    });

    return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
    };
};

export const watchLocation = async (callback: (loc: any) => void) => {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) return null;

    try {
        const subscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.Highest,
                timeInterval: 2000,
                distanceInterval: 3,
            },
            (location) => {
                callback({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    accuracy: location.coords.accuracy,
                });
            }
        );
        return subscription;
    } catch (err) {
        console.error('[GPS] Erro ao iniciar watchLocation:', err);
        return null;
    }
};

export const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
        const [address] = await Location.reverseGeocodeAsync({
            latitude: lat,
            longitude: lng,
        });

        if (address) {
            const street = address.street || '';
            const district = address.district || address.subregion || '';
            const city = address.city || '';
            const formatted = [street, district, city].filter(Boolean).join(', ');
            return formatted || 'Endereço não identificado';
        }
        return 'Endereço não identificado';
    } catch (error) {
        console.error("Erro ao obter endereço:", error);
        return 'Falha ao obter endereço';
    }
};

