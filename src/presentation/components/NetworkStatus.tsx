import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useNetInfo, NetInfoCellularState, NetInfoWifiState } from '@react-native-community/netinfo';

export const NetworkStatus: React.FC = () => {
  const netInfo = useNetInfo();

  const getStatusColor = () => {
    if (!netInfo.isConnected) return '#EF4444'; // Red
    if (netInfo.isInternetReachable === false) return '#F59E0B'; // Amber
    if (netInfo.isInternetReachable === true) return '#10B981'; // Green
    return '#6B7280'; // Gray
  };

  const getStatusText = () => {
    if (netInfo.isConnected === null) return 'Detectando red...';
    if (!netInfo.isConnected) return 'Sin conexión a la red';
    if (netInfo.isInternetReachable === false) return 'Conectado (Sin acceso a Internet)';
    if (netInfo.isInternetReachable === true) return 'Conectado a Internet';
    return 'Conectado (Verificando acceso a Internet...)';
  };

  const renderDetails = () => {
    if (!netInfo.isConnected) {
      return (
        <Text style={styles.detailText}>
          El dispositivo no posee interfaces de red activas.
        </Text>
      );
    }

    if (netInfo.type === 'cellular') {
      const details = netInfo.details as NetInfoCellularState['details'];
      return (
        <View style={styles.detailsContainer}>
          <DetailRow label="Tipo de Red" value="Red Celular" />
          <DetailRow
            label="Generación móvil"
            value={details?.cellularGeneration ? details.cellularGeneration.toUpperCase() : 'No disponible'}
          />
          <DetailRow
            label="Operador (Carrier)"
            value={details?.carrier || 'No identificado'}
          />
        </View>
      );
    }

    if (netInfo.type === 'wifi') {
      const details = netInfo.details as NetInfoWifiState['details'];
      return (
        <View style={styles.detailsContainer}>
          <DetailRow label="Tipo de Red" value="Wi-Fi" />
          {details?.ssid && <DetailRow label="SSID (Red)" value={details.ssid} />}
          {details?.ipAddress && <DetailRow label="IP Local" value={details.ipAddress} />}
          {details?.strength !== null && details?.strength !== undefined && (
            <DetailRow label="Intensidad de señal" value={`${details.strength}%`} />
          )}
          {details?.frequency && (
            <DetailRow label="Frecuencia" value={`${details.frequency} MHz`} />
          )}
          {details?.linkSpeed && (
            <DetailRow label="Velocidad de enlace" value={`${details.linkSpeed} Mbps`} />
          )}
        </View>
      );
    }

    return (
      <View style={styles.detailsContainer}>
        <DetailRow label="Tipo de interfaz" value={netInfo.type.toUpperCase()} />
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.headerTitle}>{getStatusText()}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <DetailRow
          label="Interfaz activa"
          value={netInfo.type ? netInfo.type.toUpperCase() : 'Desconocido'}
        />
        <DetailRow
          label="Internet alcanzable"
          value={
            netInfo.isInternetReachable === null ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : netInfo.isInternetReachable ? (
              'Sí'
            ) : (
              'No'
            )
          }
        />
        {renderDetails()}
      </View>
    </View>
  );
};

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}:</Text>
    {typeof value === 'string' ? (
      <Text style={styles.rowValue}>{value}</Text>
    ) : (
      value
    )}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  content: {
    gap: 10,
  },
  detailsContainer: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  detailText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
