import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export interface CellularQoSData {
  operatorName: string;
  simOperatorName: string;
  isRoaming: boolean;
  networkType: string;
  signalDbm: number;
  signalLevel: number; // 0 (muy deficiente) a 4 (excelente), o -1 si no disponible
  asuLevel: number;
  cellId: number | null;
  tac: number | null;
  hasLocationPermission: boolean;
  hasPhoneStatePermission: boolean;
}

export interface CellularPermissionsStatus {
  hasLocationPermission: boolean;
  hasPhoneStatePermission: boolean;
}

const { TelephonyModule } = NativeModules;

/**
 * Verifica si los permisos requeridos para telemetría celular están concedidos.
 */
export async function checkCellularPermissions(): Promise<CellularPermissionsStatus> {
  if (Platform.OS !== 'android') {
    return { hasLocationPermission: true, hasPhoneStatePermission: true };
  }

  const [hasLocation, hasPhoneState] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE),
  ]);

  return {
    hasLocationPermission: hasLocation,
    hasPhoneStatePermission: hasPhoneState,
  };
}

/**
 * Solicita en tiempo de ejecución los permisos de ubicación y estado del teléfono.
 */
export async function requestCellularPermissions(): Promise<CellularPermissionsStatus> {
  if (Platform.OS !== 'android') {
    return { hasLocationPermission: true, hasPhoneStatePermission: true };
  }

  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ]);

    const hasLocation =
      granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;

    const hasPhoneState =
      granted[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] ===
      PermissionsAndroid.RESULTS.GRANTED;

    return {
      hasLocationPermission: hasLocation,
      hasPhoneStatePermission: hasPhoneState,
    };
  } catch (error) {
    console.warn('Error al solicitar permisos celulares:', error);
    return { hasLocationPermission: false, hasPhoneStatePermission: false };
  }
}

/**
 * Obtiene los detalles nativos de telemetría de red celular (RSSI, operador, celda, tipo de red).
 */
export async function getCellularQoSInfo(): Promise<CellularQoSData> {
  if (Platform.OS !== 'android') {
    return {
      operatorName: 'Plataforma no soportada',
      simOperatorName: 'N/A',
      isRoaming: false,
      networkType: 'N/A',
      signalDbm: -999,
      signalLevel: -1,
      asuLevel: -1,
      cellId: null,
      tac: null,
      hasLocationPermission: false,
      hasPhoneStatePermission: false,
    };
  }

  if (!TelephonyModule) {
    throw new Error(
      'TelephonyModule nativo no está registrado. Asegúrate de haber recompilado la app.'
    );
  }

  return await TelephonyModule.getCellularDetails();
}
