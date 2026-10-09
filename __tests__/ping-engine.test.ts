import {
  calculateStats,
  DEFAULT_PING_TARGETS,
  SingleProbeResult,
} from '../src/measurement-engine';

describe('Measurement Engine - Ping & Jitter (RFC 3550)', () => {
  it('debe tener los 3 hosts de referencia predeterminados según el PRD', () => {
    expect(DEFAULT_PING_TARGETS.length).toBeGreaterThanOrEqual(3);
    const hosts = DEFAULT_PING_TARGETS.map(t => t.host);
    expect(hosts).toContain('1.1.1.1');
    expect(hosts).toContain('8.8.8.8');
    expect(hosts).toContain('208.67.222.222');
  });

  it('debe devolver nulls cuando no hay sondas exitosas', () => {
    const failedProbes: SingleProbeResult[] = [
      { sequence: 1, rttMs: -1, timestamp: 1000, success: false, error: 'Timeout' },
      { sequence: 2, rttMs: -1, timestamp: 1200, success: false, error: 'Connection refused' },
    ];

    const stats = calculateStats(failedProbes);
    expect(stats.minRttMs).toBeNull();
    expect(stats.maxRttMs).toBeNull();
    expect(stats.avgRttMs).toBeNull();
    expect(stats.jitterMs).toBeNull();
  });

  it('debe calcular correctamente RTT min, max y avg con sondas exitosas', () => {
    const probes: SingleProbeResult[] = [
      { sequence: 1, rttMs: 40, timestamp: 1000, success: true },
      { sequence: 2, rttMs: 60, timestamp: 1200, success: true },
      { sequence: 3, rttMs: 50, timestamp: 1400, success: true },
    ];

    const stats = calculateStats(probes);
    expect(stats.minRttMs).toBe(40);
    expect(stats.maxRttMs).toBe(60);
    expect(stats.avgRttMs).toBe(50);
  });

  it('debe calcular el jitter de acuerdo con el algoritmo RFC 3550', () => {
    // Si la latencia es constante, el jitter debe ser 0
    const constantProbes: SingleProbeResult[] = [
      { sequence: 1, rttMs: 30, timestamp: 1000, success: true },
      { sequence: 2, rttMs: 30, timestamp: 1200, success: true },
      { sequence: 3, rttMs: 30, timestamp: 1400, success: true },
    ];

    const statsConstant = calculateStats(constantProbes);
    expect(statsConstant.jitterMs).toBe(0);

    // Con variación de RTT, el jitter acumulativo debe ser un valor positivo mayor a 0
    const variableProbes: SingleProbeResult[] = [
      { sequence: 1, rttMs: 20, timestamp: 1000, success: true },
      { sequence: 2, rttMs: 80, timestamp: 1200, success: true },
      { sequence: 3, rttMs: 30, timestamp: 1400, success: true },
    ];

    const statsVariable = calculateStats(variableProbes);
    expect(statsVariable.jitterMs).toBeGreaterThan(0);
    expect(typeof statsVariable.jitterMs).toBe('number');
  });
});
