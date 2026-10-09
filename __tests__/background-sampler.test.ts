import {
  DEFAULT_THRESHOLDS,
  getSamplerStats,
  stopPeriodicSampling,
  startPeriodicSampling,
} from '../src/measurement-engine';

describe('Measurement Engine - Background Sampler & Degradation (RF-07)', () => {
  afterEach(() => {
    stopPeriodicSampling();
  });

  it('debe tener umbrales de degradación coherentes por defecto', () => {
    expect(DEFAULT_THRESHOLDS.criticalSignalDbm).toBe(-115);
    expect(DEFAULT_THRESHOLDS.maxLatencyMs).toBe(250);
    expect(DEFAULT_THRESHOLDS.notifyOnDisconnect).toBe(true);
  });

  it('debe reportar estado inactivo inicialmente', () => {
    const stats = getSamplerStats();
    expect(stats.running).toBe(false);
  });

  it('debe activar y detener el temporizador de muestreo periódico', () => {
    startPeriodicSampling(15, DEFAULT_THRESHOLDS);
    let stats = getSamplerStats();
    expect(stats.running).toBe(true);

    stopPeriodicSampling();
    stats = getSamplerStats();
    expect(stats.running).toBe(false);
  });
});
