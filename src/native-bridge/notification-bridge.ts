import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

const { NotificationModule } = NativeModules;

export interface NotificationPayload {
  title: string;
  message: string;
  isWarning?: boolean;
}

/**
 * Solicita el permiso POST_NOTIFICATIONS si la versión de Android es 13 (API 33) o superior.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 33) {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Permiso de Notificaciones QoS',
          message:
            'La aplicación necesita permiso para notificarte cuando la calidad de servicio o cobertura sufra degradaciones críticas.',
          buttonPositive: 'Permitir',
          buttonNegative: 'Cancelar',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Error al solicitar permiso POST_NOTIFICATIONS:', err);
      return false;
    }
  }

  return true;
}

/**
 * Verifica si las notificaciones están permitidas en el dispositivo.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 33) {
    try {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Emite una notificación nativa local en Android.
 */
export async function showQoSNotification(payload: NotificationPayload): Promise<boolean> {
  if (Platform.OS !== 'android' || !NotificationModule) {
    console.warn('NotificationModule no disponible en esta plataforma');
    return false;
  }

  try {
    const hasPerm = await hasNotificationPermission();
    if (!hasPerm) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        console.warn('Permiso de notificaciones denegado por el usuario');
        return false;
      }
    }

    await NotificationModule.postNotification(
      payload.title,
      payload.message,
      payload.isWarning ?? true
    );
    return true;
  } catch (error) {
    console.warn('Fallo al disparar notificación QoS:', error);
    return false;
  }
}
