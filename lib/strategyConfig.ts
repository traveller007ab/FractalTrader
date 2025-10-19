import type { StrategySettings } from '../types';

export const defaultStrategySettings: StrategySettings = {
  // Detection
  shiftAtrMultiplier: 0.25,
  shiftPctThreshold: 0.002, // 0.2%
  // Trend
  smaPeriod: 20,
  // Daily Structure
  proximityAtrMultiplier: 0.5,
  // Volatility
  atrPeriod: 14,
  atrFilterMultiplier: 0.75,
  // Volume
  volumeFilterMultiplier: 2.0,
  // Risk
  stopLossAtrMultiplier: 1.5,
  takeProfitR_R: 2.0, // R:R = 2.0
  riskPercent: 0.005, // 0.5%
  exposureCapPercent: 0.20, // 20%
  // Emission
  confidenceThreshold: 0.60,
  cooldownBars: 5, // 5 * 15m = 75 mins
  duplicateThresholdPct: 0.0025, // 0.25%
};
