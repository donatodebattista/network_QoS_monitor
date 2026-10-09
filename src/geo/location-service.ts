import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, { GeoPosition, GeoError } from 'react-native-geolocation-service';
import { GeoLocationData } from './types';

/**
 * Verifica si el permiso de ubicación precisa está concedido.
 */
export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  return await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
}

/**
 * Solicita en tiempo de ejecución el permiso de ubicación precisa.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Permiso de Ubicación Precisa',
        message:
          'Network QoS Monitor requiere acceso al GPS para correlacionar y mapear las mediciones de red con su posición geográfica.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Cancelar',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('Error al solicitar permiso de ubicación:', error);
    return false;
  }
}

/**
 * Obtiene las coordenadas geográficas actuales del dispositivo.
 * Si falla la alta precisión (ej. interiores sin señal satelital directa),
 * recurre automáticamente a la ubicación por red celular/Wi-Fi como respaldo.
 */
export async function getCurrentCoordinates(): Promise<GeoLocationData> {
  const permitted = await hasLocationPermission();
  if (!permitted) {
    const granted = await requestLocationPermission();
    if (!granted) {
      throw new Error('Permiso de ubicación no concedido');
    }
  }

  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position: GeoPosition) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy * 10) / 10,
          altitude: position.coords.altitude ? Math.round(position.coords.altitude) : null,
          speed: position.coords.speed ? Math.round(position.coords.speed * 10) / 10 : null,
          heading: position.coords.heading,
          timestamp: position.timestamp,
          provider: position.provider,
        });
      },
      (primaryError: GeoError) => {
        // Fallback: intentar con baja precisión (torres celulares / Wi-Fi)
        Geolocation.getCurrentPosition(
          (fallbackPos: GeoPosition) => {
            resolve({
              latitude: fallbackPos.coords.latitude,
              longitude: fallbackPos.coords.longitude,
              accuracy: Math.round(fallbackPos.coords.accuracy * 10) / 10,
              altitude: fallbackPos.coords.altitude ? Math.round(fallbackPos.coords.altitude) : null,
              speed: fallbackPos.coords.speed ? Math.round(fallbackPos.coords.speed * 10) / 10 : null,
              heading: fallbackPos.coords.heading,
              timestamp: fallbackPos.timestamp,
              provider: fallbackPos.provider || 'network',
            });
          },
          (fallbackError: GeoError) => {
            reject(
              new Error(
                `Error GPS (${primaryError.code}): ${primaryError.message || fallbackError.message}`
              )
            );
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 30000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        showLocationDialog: true,
        forceRequestLocation: true,
      }
    );
  });
}
