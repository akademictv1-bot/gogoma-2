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
        // 1. Tentar pegar a última localização conhecida (Cache) para resposta instantânea
        const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 60000, // Aceitar cache de até 1 minuto
        });

        if (lastKnown && lastKnown.coords.accuracy && lastKnown.coords.accuracy < 100) {
            return {
                lat: lastKnown.coords.latitude,
                lng: lastKnown.coords.longitude,
                accuracy: lastKnown.coords.accuracy,
            };
        }
    } catch (e) {
        // Ignora erro no cache e segue para busca real
    }

    // 2. Busca Real com TIMEOUT de 15 segundos para não travar celulares fracos
    // Usamos Balanced para ser mais rápido que Highest mas ainda preciso o suficiente
    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
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

    // MÁXIMA PRECISÃO para rastreamento contínuo
    return await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.BestForNavigation, // MÁXIMA PRECISÃO
            timeInterval: 1000, // Atualizar a cada 1 segundo
            distanceInterval: 1, // Atualizar a cada 1 metro
        },
        (location) => {
            callback({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                accuracy: location.coords.accuracy,
            });
        }
    );
};

