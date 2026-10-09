import {
  saveMeasurement,
  getMeasurements,
  deleteMeasurement,
  clearAllMeasurements,
  getHistorySummary,
  exportToJSON,
  exportToCSV,
  QoSMeasurementRecord,
} from '../src/persistence';

describe('Persistence Layer - Storage Engine & Export (RF-08 & RF-09)', () => {
  beforeEach(async () => {
    await clearAllMeasurements();
  });

  const sample1: QoSMeasurementRecord = {
    id: 'test_1',
    timestamp: 1000,
    isoDate: '2026-10-09 10:00:00',
    connectionType: 'cellular',
    isInternetReachable: true,
    carrierName: 'Personal',
    cellularGeneration: '4G LTE',
    signalDbm: -85,
    signalLevel: 3,
    rttAvgMs: 45,
    downloadSpeedMbps: 25.5,
    uploadSpeedMbps: 10.2,
    latitude: -32.4812,
    longitude: -58.2341,
    accuracy: 8,
  };

  const sample2: QoSMeasurementRecord = {
    id: 'test_2',
    timestamp: 2000,
    isoDate: '2026-10-09 10:15:00',
    connectionType: 'wifi',
    isInternetReachable: true,
    rttAvgMs: 25,
    downloadSpeedMbps: 80.0,
    uploadSpeedMbps: 30.0,
    latitude: -32.4820,
    longitude: -58.2350,
    accuracy: 5,
  };

  it('debe guardar y recuperar mediciones correctamente', async () => {
    await saveMeasurement(sample1);
    await saveMeasurement(sample2);

    const list = await getMeasurements();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe('test_2'); // Orden descendente (más reciente primero)
  });

  it('debe filtrar mediciones por tipo de conexión (RF-09)', async () => {
    await saveMeasurement(sample1);
    await saveMeasurement(sample2);

    const cellularOnly = await getMeasurements({ connectionType: 'cellular' });
    expect(cellularOnly.length).toBe(1);
    expect(cellularOnly[0].connectionType).toBe('cellular');

    const wifiOnly = await getMeasurements({ connectionType: 'wifi' });
    expect(wifiOnly.length).toBe(1);
    expect(wifiOnly[0].connectionType).toBe('wifi');
  });

  it('debe calcular métricas agregadas en getHistorySummary', async () => {
    await saveMeasurement(sample1);
    await saveMeasurement(sample2);

    const summary = await getHistorySummary();
    expect(summary.totalRecords).toBe(2);
    expect(summary.cellularCount).toBe(1);
    expect(summary.wifiCount).toBe(1);
    expect(summary.avgLatency).toBe(35);
    expect(summary.avgDownload).toBe(52.8);
  });

  it('debe exportar los datos en formato JSON válido (RF-08)', async () => {
    await saveMeasurement(sample1);
    const jsonStr = await exportToJSON();
    const parsed = JSON.parse(jsonStr);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe('test_1');
  });

  it('debe exportar los datos en formato CSV con cabeceras estándar (RF-08)', async () => {
    await saveMeasurement(sample1);
    const csvStr = await exportToCSV();

    const lines = csvStr.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toContain('id,timestamp,isoDate,connectionType');
    expect(lines[1]).toContain('test_1,1000');
  });

  it('debe permitir eliminar una medición por su ID', async () => {
    await saveMeasurement(sample1);
    await saveMeasurement(sample2);

    await deleteMeasurement('test_1');
    const remaining = await getMeasurements();

    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('test_2');
  });
});
