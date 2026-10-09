import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { getMeasurements, QoSMeasurementRecord } from '../../persistence';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64; // margen de la tarjeta
const CHART_HEIGHT = 160;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 25;
const PADDING_LEFT = 35;
const PADDING_RIGHT = 15;

type ChartMetricType = 'signal' | 'latency' | 'throughput';

export const TimeSeriesChart: React.FC = () => {
  const [metricType, setMetricType] = useState<ChartMetricType>('signal');
  const [dataPoints, setDataPoints] = useState<QoSMeasurementRecord[]>([]);

  const loadData = useCallback(async () => {
    const list = await getMeasurements();
    // Invertir para orden cronológico de izquierda a derecha (antiguo -> nuevo)
    const chronological = [...list].reverse();
    setDataPoints(chronological);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar y mapear puntos según la métrica seleccionada
  const points = dataPoints
    .map((item, idx) => {
      let val: number | null = null;
      if (metricType === 'signal') {
        val = item.signalDbm ?? null;
      } else if (metricType === 'latency') {
        val = item.rttAvgMs ?? (item.jitterMs ? item.jitterMs * 2 : null);
      } else {
        val = item.downloadSpeedMbps ?? item.uploadSpeedMbps ?? null;
      }
      return {
        index: idx,
        value: val,
        date: item.isoDate,
        type: item.connectionType,
      };
    })
    .filter((p): p is { index: number; value: number; date: string; type: string } => p.value !== null);

  const values = points.map(p => p.value);
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values, 1) : 100;
  const avgVal =
    values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : 0;

  // Escalar coordenadas a píxeles dentro del SVG
  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const getX = (idx: number) => {
    if (points.length <= 1) return PADDING_LEFT + plotWidth / 2;
    return PADDING_LEFT + (idx / (points.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    const normalized = (val - minVal) / range;
    return PADDING_TOP + plotHeight - normalized * plotHeight;
  };

  // Construir trayectorias SVG (Path)
  let linePath = '';
  let areaPath = '';

  if (points.length > 0) {
    linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.value).toFixed(1)}`)
      .join(' ');

    const firstX = getX(0).toFixed(1);
    const lastX = getX(points.length - 1).toFixed(1);
    const baselineY = (PADDING_TOP + plotHeight).toFixed(1);
    areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }

  const strokeColor =
    metricType === 'signal' ? '#0284C7' : metricType === 'latency' ? '#6366F1' : '#10B981';
  const unitLabel =
    metricType === 'signal' ? 'dBm' : metricType === 'latency' ? 'ms' : 'Mbps';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.badge}>SERIES TEMPORALES</Text>
          <Text style={styles.headerTitle}>Tendencias de QoS</Text>
        </View>

        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Selector de Serie (Señal, Latencia, Throughput) */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setMetricType('signal')}
          style={[styles.tabButton, metricType === 'signal' && styles.tabButtonActiveSignal]}>
          <Text
            style={[
              styles.tabButtonText,
              metricType === 'signal' && styles.tabButtonTextActiveSignal,
            ]}>
            Señal (dBm)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMetricType('latency')}
          style={[styles.tabButton, metricType === 'latency' && styles.tabButtonActiveLatency]}>
          <Text
            style={[
              styles.tabButtonText,
              metricType === 'latency' && styles.tabButtonTextActiveLatency,
            ]}>
            Latencia (ms)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMetricType('throughput')}
          style={[styles.tabButton, metricType === 'throughput' && styles.tabButtonActiveThroughput]}>
          <Text
            style={[
              styles.tabButtonText,
              metricType === 'throughput' && styles.tabButtonTextActiveThroughput,
            ]}>
            Throughput (Mbps)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Renderizado de Gráfico */}
      {points.length < 2 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Datos insuficientes para graficar</Text>
          <Text style={styles.emptySubtext}>
            Se requieren al menos 2 mediciones registradas con datos de{' '}
            {metricType === 'signal'
              ? 'señal móvil (dBm)'
              : metricType === 'latency'
              ? 'latencia (ms)'
              : 'velocidad (Mbps)'}{' '}
            para proyectar la serie temporal.
          </Text>
        </View>
      ) : (
        <View style={styles.chartContainer}>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Líneas de rejilla horizontales (Guías de escala) */}
            <Line
              x1={PADDING_LEFT}
              y1={PADDING_TOP}
              x2={CHART_WIDTH - PADDING_RIGHT}
              y2={PADDING_TOP}
              stroke="#E5E7EB"
              strokeDasharray="4 4"
            />
            <Line
              x1={PADDING_LEFT}
              y1={PADDING_TOP + plotHeight / 2}
              x2={CHART_WIDTH - PADDING_RIGHT}
              y2={PADDING_TOP + plotHeight / 2}
              stroke="#E5E7EB"
              strokeDasharray="4 4"
            />
            <Line
              x1={PADDING_LEFT}
              y1={PADDING_TOP + plotHeight}
              x2={CHART_WIDTH - PADDING_RIGHT}
              y2={PADDING_TOP + plotHeight}
              stroke="#D1D5DB"
            />

            {/* Etiquetas del eje Y */}
            <SvgText
              x={PADDING_LEFT - 6}
              y={PADDING_TOP + 4}
              fontSize="9"
              fill="#9CA3AF"
              textAnchor="end">
              {Math.round(maxVal)}
            </SvgText>
            <SvgText
              x={PADDING_LEFT - 6}
              y={PADDING_TOP + plotHeight / 2 + 3}
              fontSize="9"
              fill="#9CA3AF"
              textAnchor="end">
              {Math.round((maxVal + minVal) / 2)}
            </SvgText>
            <SvgText
              x={PADDING_LEFT - 6}
              y={PADDING_TOP + plotHeight + 3}
              fontSize="9"
              fill="#9CA3AF"
              textAnchor="end">
              {Math.round(minVal)}
            </SvgText>

            {/* Área sombreada bajo la curva */}
            <Path d={areaPath} fill="url(#gradientArea)" />

            {/* Línea de la serie temporal */}
            <Path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Marcadores circulares en cada punto de muestra */}
            {points.map((p, i) => (
              <Circle
                key={p.index}
                cx={getX(i)}
                cy={getY(p.value)}
                r="3.5"
                fill="#FFFFFF"
                stroke={strokeColor}
                strokeWidth="2"
              />
            ))}
          </Svg>

          {/* Estadísticas de la serie */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Mínimo</Text>
              <Text style={styles.statValue}>
                {minVal.toFixed(1)} {unitLabel}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Promedio</Text>
              <Text style={styles.statValue}>
                {avgVal.toFixed(1)} {unitLabel}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Pico Máx</Text>
              <Text style={styles.statValue}>
                {maxVal.toFixed(1)} {unitLabel}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  refreshButton: {
    flexShrink: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabButtonActiveSignal: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  tabButtonTextActiveSignal: {
    color: '#0284C7',
    fontWeight: '700',
  },
  tabButtonActiveLatency: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  tabButtonTextActiveLatency: {
    color: '#6366F1',
    fontWeight: '700',
  },
  tabButtonActiveThroughput: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  tabButtonTextActiveThroughput: {
    color: '#10B981',
    fontWeight: '700',
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  chartContainer: {
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
