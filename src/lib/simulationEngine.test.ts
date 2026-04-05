import { describe, it, expect } from 'vitest';
import {
  runSimulation,
  runGoldenPathSimulation,
  GoldenPathResult,
} from '@/lib/simulationEngine';
import type { NonlinearModel } from '@/lib/stateSpaceSchema';

/** Full Sapi-an composting model WITH control_policy and interventions */
function makeSapianGoldenPath(): NonlinearModel {
  return {
    model_metadata: {
      name: 'sapi-an-1ton-siege',
      version: '3.0.0',
      author: 'CWF Digital Twin Team',
      description:
        'Nonlinear state-space model for Sapi-an 1-ton drum composting biological siege',
    },
    model_description_prompt:
      'This model simulates a 1-ton drum composting process at the Sapi-an facility.',
    constants: {
      h_m: { value: 4800, name: 'Mesophilic Heat Generation', unit: 'J/kg' },
      h_t: { value: 7800, name: 'Thermophilic Heat Generation', unit: 'J/kg' },
      C_th: { value: 3.8, name: 'Thermal Capacity', unit: 'kJ/(kg·°C)' },
      k_loss_ambient: { value: 0.08, name: 'Ambient Heat Loss Coefficient', unit: '1/hr' },
      k_loss_active: { value: 1.0, name: 'Active Aeration Heat Loss Coefficient', unit: '1/hr' },
      mu_max_m: { value: 0.22, name: 'Max Mesophilic Growth Rate', unit: '1/hr' },
      mu_max_t: { value: 0.35, name: 'Max Thermophilic Growth Rate', unit: '1/hr' },
      K_o: { value: 0.1, name: 'Oxygen Half-Saturation', unit: 'kg' },
      K_s: { value: 8.0, name: 'Sugar Half-Saturation', unit: 'kg' },
      K_n: { value: 1.0, name: 'Nitrogen Half-Saturation', unit: 'kg' },
      k_soft: { value: 0.5, name: 'Lignin Softening Rate', unit: '1/°C' },
      Y_s: { value: 0.4, name: 'Sugar Yield Coefficient', unit: 'kg/kg' },
      Y_l: { value: 0.3, name: 'Lignin Yield Coefficient', unit: 'kg/kg' },
      k_evap: { value: 0.03, name: 'Moisture Evaporation Coefficient', unit: 'kg/(hr·°C)' },
      k_settle: { value: 0.015, name: 'Volume Settling Coefficient', unit: 'm³/hr' },
      t_amb: { value: 30.0, name: 'Ambient Temperature', unit: '°C' },
      k_diff: { value: 0.5, name: 'Oxygen Diffusion Rate', unit: 'kg/(hr)' },
      q_resp: { value: 0.02, name: 'Microbial Respiration Rate', unit: 'kg_O2/(kg_bio·hr)' },
      k_abr: { value: 0.005, name: 'Abrasion Rate', unit: '1/hr' },
      k_vol_loss: { value: 0.003, name: 'Volume Loss from Decomposition', unit: 'm³/(kg·hr)' },
      Y_n: { value: 0.1, name: 'Nitrogen Yield Coefficient', unit: 'kg_N/kg_bio' },
      x10: { value: 100.0, name: 'Inert Mass (fixed)', unit: 'kg' },
      x11: { value: 1.8, name: 'Drum Capacity (fixed)', unit: 'm³' },
    },
    state_definitions: {
      x1: { id: 't_k', name: 'Max Temperature', unit: '°C', default_value: 30.0 },
      x2: { id: 'm_meso', name: 'Mesophilic Mass', unit: 'kg', default_value: 0.8 },
      x3: { id: 'm_thermo', name: 'Thermophilic Mass', unit: 'kg', default_value: 0.005 },
      x4: { id: 's_k', name: 'Sugar Mass', unit: 'kg', default_value: 160.0 },
      x5: { id: 'l_k', name: 'Lignin Mass', unit: 'kg', default_value: 350.0 },
      x6: { id: 'n_k', name: 'Nitrogen Mass', unit: 'kg', default_value: 18.0 },
      x7: { id: 'w_k', name: 'Water Mass', unit: 'kg', default_value: 500.0 },
      x8: { id: 'o_mass', name: 'Oxygen Mass', unit: 'kg', default_value: 2.0 },
      x9: { id: 'alpha_k', name: 'Bio-Availability', unit: 'ratio', default_value: 0.1 },
      x12: { id: 'v_k', name: 'Material Volume', unit: 'm³', default_value: 1.5 },
    },
    input_vectors: {
      u_actuators: {
        u_fan: 'Fan duty cycle [0,1]',
        u_motor: 'Drum motor rotation toggle [0,1]',
      },
      v_shocks: {
        delta_x: 'AI-inferred correction vector from user observations',
      },
    },
    non_linear_transitions: {
      total_mass_M: 'x2 + x3 + x4 + x5 + x6 + x7 + x10',
      rho_bulk: 'total_mass_M / x12',
      phi_lim: '(x8 / (K_o + x8)) * (x4 / (K_s + x4)) * (x6 / (K_n + x6))',
      psi_soft: '1 / (1 + exp(-k_soft * (x1 - 55)))',
      mu_m: 'mu_max_m * exp(-(x1 - 35)^2 / (2 * 64))',
      mu_t: 'mu_max_t * exp(-(x1 - 60)^2 / (2 * 100))',
      dm: '0.02 + max(0, 0.25 * (x1 - 44))',
      death_rate_t: '0.02 + max(0, 0.4 * (x1 - 75))',
      k_now: 'k_loss_ambient + (k_loss_active - k_loss_ambient) * u_fan',
      afp: '(x11 - x12) / x11',
    },
    state_update_equations: {
      x1_next: 'max(x1 + dt * ((h_m * x2 + h_t * x3) / (C_th * rho_bulk) - k_now * u_fan * (x1 - t_amb)), t_amb)',
      x2_next: 'max(x2 + dt * (mu_m * phi_lim * x2 - dm * x2), 0.0001)',
      x3_next: 'max(x3 + dt * (mu_t * phi_lim * x3 - death_rate_t * x3), 0.005)',
      x4_next: 'max(x4 - dt * ((1 / Y_s) * mu_m * phi_lim * x2), 0)',
      x5_next: 'max(x5 - dt * ((1 / Y_l) * mu_t * phi_lim * x3 * x9 * psi_soft), 0)',
      x6_next: 'max(x6 - dt * (Y_n * (mu_m * phi_lim * x2 + mu_t * phi_lim * x3)), 0)',
      x7_next: 'max(x7 - dt * (k_evap * u_fan * (x1 - t_amb)), 0.1)',
      x8_next: 'max(x8 + dt * (k_diff * u_fan * afp - q_resp * (mu_m * phi_lim * x2 + mu_t * phi_lim * x3)), 0)',
      x9_next: 'min(x9 + dt * (k_abr * u_motor * psi_soft), 1.0)',
      x12_next: 'max(x12 - dt * (k_settle * u_motor * psi_soft + k_vol_loss * (mu_m * phi_lim * x2 + mu_t * phi_lim * x3)), 0.1)',
    },
    simulation_config: {
      dt: 0.05,
      total_days: 14,
    },
    control_policy: {
      initial_phase: 'phase_a_mesophilic_ignition',
      phases: [
        {
          name: 'phase_a_mesophilic_ignition',
          entry_condition: 'x1 < 45',
          rules: [
            { condition: 'x8 < 1.0', actuator: 'u_fan', value: 1, duration_steps: 2 },
            { condition: 'x9 < 0.3', actuator: 'u_motor', value: 1, duration_steps: 4 },
          ],
          exit_threshold: 'x1 >= 45',
        },
        {
          name: 'phase_b_thermophilic_handover',
          entry_condition: 'x1 >= 45',
          rules: [
            { condition: 'x8 < 0.8', actuator: 'u_fan', value: 1, duration_steps: 2 },
            { condition: 'x9 < 0.5', actuator: 'u_motor', value: 1, duration_steps: 3 },
          ],
          exit_threshold: 'x1 >= 55',
        },
        {
          name: 'phase_c_lignin_breach',
          entry_condition: 'x1 >= 55',
          rules: [
            { condition: 'x8 < 0.5', actuator: 'u_fan', value: 1, duration_steps: 2 },
            { condition: 'x7 / (x2 + x3 + x4 + x5 + x6 + x7 + x10) < 0.45', actuator: 'u_fan', value: 1, duration_steps: 3 },
            { condition: 'x9 < 0.7', actuator: 'u_motor', value: 1, duration_steps: 4 },
          ],
          exit_threshold: null,
        },
      ],
    },
    interventions: [
      { time_hours: 48, state_key: 'x4', delta: 20.0, label: 'Day 2: Add 20kg greens (sugar substrate)' },
      { time_hours: 48, state_key: 'x7', delta: 15.0, label: 'Day 2: Add 15kg moisture with greens' },
      { time_hours: 120, state_key: 'x7', delta: 25.0, label: 'Day 5: Moisture top-up (25kg water)' },
      { time_hours: 240, state_key: 'x4', delta: 10.0, label: 'Day 10: Add 10kg greens (late sugar boost)' },
    ],
  };
}


describe('Golden Path Simulation Engine', () => {
  it('runs the Sapi-an composting model and verifies phase transitions occur (Req 4.1-4.8)', () => {
    const model = makeSapianGoldenPath();
    const outcome = runGoldenPathSimulation(model);

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    const result = outcome.result;

    // phaseHistory should contain at least 2 distinct phase names
    // (temperature rises through 45°C threshold at minimum)
    const distinctPhases = new Set(result.phaseHistory);
    expect(distinctPhases.size).toBeGreaterThanOrEqual(2);

    // Verify the simulation starts in the initial phase
    expect(result.phaseHistory[0]).toBe('phase_a_mesophilic_ignition');

    // Verify phase_b appears (temperature crossed 45°C)
    expect(result.phaseHistory).toContain('phase_b_thermophilic_handover');
  });

  it('verifies intervention at t=48h adds delta to the correct state variable (Req 5.1-5.5)', () => {
    const model = makeSapianGoldenPath();
    const outcome = runGoldenPathSimulation(model);

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    const result = outcome.result;

    // Interventions at t=48h should appear in the log
    // step = Math.round(48 / 0.05) = 960
    const interventionsAt48h = result.interventionLog.filter(
      (entry: { timeHours: number }) => entry.timeHours === 48
    );
    expect(interventionsAt48h.length).toBe(2); // x4 +20 and x7 +15

    // Verify the correct state keys and deltas
    const x4Intervention = interventionsAt48h.find((e: { stateKey: string }) => e.stateKey === 'x4');
    expect(x4Intervention).toBeDefined();
    expect(x4Intervention!.delta).toBe(20.0);
    expect(x4Intervention!.timeStep).toBe(960);

    const x7Intervention = interventionsAt48h.find((e: { stateKey: string }) => e.stateKey === 'x7');
    expect(x7Intervention).toBeDefined();
    expect(x7Intervention!.delta).toBe(15.0);

    // Verify all 4 interventions were applied
    expect(result.interventionLog.length).toBe(4);
  });

  it('verifies actuator trace shows fan on/off pattern matching oxygen-based rules (Req 4.4-4.7)', () => {
    const model = makeSapianGoldenPath();
    const outcome = runGoldenPathSimulation(model);

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    const result = outcome.result;

    // u_fan trace should exist and contain both 0 and 1 values
    expect(result.actuatorTraces.u_fan).toBeDefined();
    const fanTrace = result.actuatorTraces.u_fan;
    expect(fanTrace.length).toBe(result.timePoints.length);

    const hasOn = fanTrace.some((v: number) => v === 1);
    const hasOff = fanTrace.some((v: number) => v === 0);
    expect(hasOn).toBe(true);
    expect(hasOff).toBe(true);

    // u_motor trace should also exist
    expect(result.actuatorTraces.u_motor).toBeDefined();
  });

  it('verifies simulation stops when a control policy expression produces NaN (Req 11.3)', () => {
    const model = makeSapianGoldenPath();
    // Replace the first phase's exit_threshold with a division-by-zero expression
    model.control_policy!.phases[0].exit_threshold = '1 / (x1 - x1)';

    const outcome = runGoldenPathSimulation(model);

    expect(outcome.success).toBe(false);
    if (outcome.success) return;

    // Error should identify the phase and the expression
    expect(outcome.error.expressionKey).toContain('phase_a_mesophilic_ignition');
    expect(outcome.error.timeStep).toBeGreaterThan(0);
    expect(outcome.error.message).toBeTruthy();
  });

  it('verifies runSimulation (not golden path) still works for models with control_policy present (Req 9.2)', () => {
    const model = makeSapianGoldenPath();

    // runSimulation should ignore control_policy and interventions
    const outcome = runSimulation(model);

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    // Should produce valid state trajectories
    const result = outcome.result;
    expect(result.timePoints.length).toBeGreaterThan(0);
    expect(Object.keys(result.stateHistory)).toHaveLength(10);

    // Should NOT have golden path fields (it's a plain SimulationResult)
    const resultAny = result as Record<string, unknown>;
    expect(resultAny.actuatorTraces).toBeUndefined();
    expect(resultAny.phaseHistory).toBeUndefined();
    expect(resultAny.interventionLog).toBeUndefined();
  });
});
