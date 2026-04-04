import { describe, it, expect } from 'vitest';
import {
  validateStateSpaceJson,
  validateCrossReferences,
  validateExpressions,
  NonlinearModel,
} from './stateSpaceSchema';

/** Minimal valid NonlinearModel for testing */
function makeNonlinearModel(
  overrides?: Partial<NonlinearModel>
): NonlinearModel {
  return {
    model_metadata: {
      name: 'test-model',
      version: '1.0.0',
      author: 'tester',
      description: 'A minimal test model',
    },
    model_description_prompt: 'Minimal two-state test model.',
    constants: {
      k1: { value: 0.5, name: 'Rate constant', unit: '1/hr' },
    },
    state_definitions: {
      x1: { id: 'temp', name: 'Temperature', unit: '°C', default_value: 30 },
      x2: { id: 'mass', name: 'Mass', unit: 'kg', default_value: 10 },
    },
    input_vectors: {
      u_actuators: { u_fan: 'Fan duty cycle [0,1]' },
      v_shocks: { delta_x: 'Correction vector' },
    },
    non_linear_transitions: {
      rate: 'k1 * x1',
    },
    state_update_equations: {
      x1_next: 'x1 + rate * dt',
      x2_next: 'x2 - k1 * dt',
    },
    simulation_config: {
      dt: 1,
      total_days: 1,
    },
    ...overrides,
  };
}

/** Full Sapi-an composting test fixture from the design doc */
const SAPIAN_COMPOSTING_MODEL: NonlinearModel = {
  model_metadata: {
    name: 'sapi-an-1ton-siege',
    version: '3.0.0',
    author: 'CWF Digital Twin Team',
    description:
      'Nonlinear state-space model for Sapi-an 1-ton drum composting biological siege',
  },
  model_description_prompt:
    'This model simulates a 1-ton drum composting process at the Sapi-an facility. It tracks temperature, mesophilic and thermophilic microbial populations, sugar and lignin substrate consumption, nitrogen, moisture, oxygen, bio-availability, inert mass, drum capacity, and material volume over a 14-day composting cycle. The model captures nonlinear microbial growth kinetics with Gaussian temperature-dependent growth rates, Monod-type nutrient limitation, and lignin softening transitions. Operator inputs are fan duty cycle (aeration) and drum motor rotation.',
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
};

describe('validateStateSpaceJson', () => {
  it('validates the complete Sapi-an composting model', () => {
    const result = validateStateSpaceJson(JSON.stringify(SAPIAN_COMPOSTING_MODEL));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.model.model_metadata.name).toBe('sapi-an-1ton-siege');
      expect(Object.keys(result.model.state_definitions)).toHaveLength(10);
      expect(Object.keys(result.model.state_update_equations)).toHaveLength(10);
    }
  });

  it('validates a minimal nonlinear model', () => {
    const result = validateStateSpaceJson(JSON.stringify(makeNonlinearModel()));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.model.model_metadata.name).toBe('test-model');
    }
  });

  it('rejects old linear format with state_space.dimensions.matrices', () => {
    const oldFormat = {
      model_metadata: {
        name: 'old-model',
        version: '1.0',
        author: 'test',
        description: 'test',
      },
      model_description_prompt: 'Old linear model',
      state_space: {
        dimensions: { states: 2, inputs: 1, outputs: 1 },
        labels: {
          states: ['s0', 's1'],
          inputs: ['u0'],
          outputs: ['y0'],
        },
        matrices: {
          A: [[0, 0], [0, 0]],
          B: [[0], [0]],
          C: [[0, 0]],
          D: [[0]],
        },
      },
    };
    const result = validateStateSpaceJson(JSON.stringify(oldFormat));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes('old linear state-space format'))).toBe(true);
      expect(result.errors.some((e: string) => e.includes('state_space.dimensions'))).toBe(true);
      expect(result.errors.some((e: string) => e.includes('state_space.matrices'))).toBe(true);
    }
  });

  it('returns error for empty string', () => {
    const result = validateStateSpaceJson('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(['JSON input is required.']);
    }
  });

  it('returns error for whitespace-only string', () => {
    const result = validateStateSpaceJson('   \n\t  ');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(['JSON input is required.']);
    }
  });

  it('returns parse error for invalid JSON', () => {
    const result = validateStateSpaceJson('{ not valid json }');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toBeTruthy();
    }
  });

  it('rejects negative dt', () => {
    const model = makeNonlinearModel({
      simulation_config: { dt: -1, total_days: 1 },
    });
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes('simulation_config.dt'))).toBe(true);
    }
  });

  it('rejects negative total_days', () => {
    const model = makeNonlinearModel({
      simulation_config: { dt: 1, total_days: -5 },
    });
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e: string) => e.includes('simulation_config.total_days'))).toBe(true);
    }
  });

  it('validates empty constants and input_vectors', () => {
    const model = makeNonlinearModel({
      constants: {},
      input_vectors: { u_actuators: {}, v_shocks: {} },
      non_linear_transitions: {},
      state_update_equations: {
        x1_next: 'x1 + dt',
        x2_next: 'x2 + dt',
      },
    });
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(true);
  });

  it('returns Zod errors with paths for structurally invalid JSON', () => {
    const result = validateStateSpaceJson('{"model_metadata": 42}');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: string) => e.includes('model_metadata'))).toBe(true);
    }
  });
});

describe('validateCrossReferences', () => {
  it('returns no errors for a valid model', () => {
    const model = makeNonlinearModel();
    const errors = validateCrossReferences(model);
    expect(errors).toEqual([]);
  });

  it('detects orphaned equation key (x3_next without x3 in state_definitions)', () => {
    const model = makeNonlinearModel({
      state_update_equations: {
        x1_next: 'x1 + dt',
        x2_next: 'x2 + dt',
        x3_next: 'x1 + x2',
      },
    });
    const errors = validateCrossReferences(model);
    expect(errors.some((e) => e.includes('x3_next') && e.includes('Orphaned'))).toBe(true);
  });

  it('detects missing equation (x1 in state_definitions but no x1_next)', () => {
    const model = makeNonlinearModel({
      state_update_equations: {
        x2_next: 'x2 + dt',
      },
    });
    const errors = validateCrossReferences(model);
    expect(errors.some((e) => e.includes('x1') && e.includes('Missing equation'))).toBe(true);
  });
});

describe('validateExpressions', () => {
  it('returns no errors for valid expressions', () => {
    const model = makeNonlinearModel();
    const errors = validateExpressions(model);
    expect(errors).toEqual([]);
  });

  it('rejects unparseable expression (x1 ** x2)', () => {
    const model = makeNonlinearModel({
      non_linear_transitions: {
        bad_expr: 'x1 ** x2',
      },
      state_update_equations: {
        x1_next: 'x1 + dt',
        x2_next: 'x2 + dt',
      },
    });
    const errors = validateExpressions(model);
    expect(errors.some((e) => e.includes('bad_expr'))).toBe(true);
  });

  it('rejects undefined variable reference', () => {
    const model = makeNonlinearModel({
      non_linear_transitions: {
        rate: 'k1 * x1 + undefined_var',
      },
      state_update_equations: {
        x1_next: 'x1 + rate * dt',
        x2_next: 'x2 + dt',
      },
    });
    const errors = validateExpressions(model);
    expect(errors.some((e) => e.includes('undefined_var') && e.includes('undefined variable'))).toBe(true);
  });
});


/** Full Sapi-an composting model WITH control_policy and interventions (from design doc) */
function makeSapianWithGoldenPath(): NonlinearModel {
  return {
    ...SAPIAN_COMPOSTING_MODEL,
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

describe('Golden Path Schema Validation', () => {
  it('validates the full Sapi-an composting model with control_policy and interventions', () => {
    const model = makeSapianWithGoldenPath();
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.model.control_policy).toBeDefined();
      expect(result.model.control_policy!.phases).toHaveLength(3);
      expect(result.model.interventions).toHaveLength(4);
    }
  });

  it('rejects control_policy with initial_phase not matching any phase name', () => {
    const model = makeSapianWithGoldenPath();
    model.control_policy!.initial_phase = 'nonexistent_phase';
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('nonexistent_phase')])
      );
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('does not match any phase name')])
      );
    }
  });

  it('rejects actuator rule referencing non-existent actuator key', () => {
    const model = makeSapianWithGoldenPath();
    model.control_policy!.phases[0].rules[0].actuator = 'u_nonexistent';
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('u_nonexistent')])
      );
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('not found in u_actuators')])
      );
    }
  });

  it('rejects intervention with state_key not in state_definitions', () => {
    const model = makeSapianWithGoldenPath();
    model.interventions![0].state_key = 'x_bogus';
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('x_bogus')])
      );
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('not found in state_definitions')])
      );
    }
  });

  it('accepts model with empty interventions array', () => {
    const model = makeSapianWithGoldenPath();
    model.interventions = [];
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(true);
  });

  it('accepts model with control_policy but no interventions', () => {
    const model = makeSapianWithGoldenPath();
    delete (model as Partial<Pick<NonlinearModel, 'interventions'>> & Omit<NonlinearModel, 'interventions'>).interventions;
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.model.control_policy).toBeDefined();
      expect(result.model.interventions).toBeUndefined();
    }
  });

  it('rejects control_policy expression with undefined variable (error includes phase name)', () => {
    const model = makeSapianWithGoldenPath();
    model.control_policy!.phases[1].entry_condition = 'undefined_var > 10';
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('undefined_var')])
      );
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('phase_b_thermophilic_handover')])
      );
    }
  });

  it('accepts model without control_policy or interventions (backward compat)', () => {
    const result = validateStateSpaceJson(JSON.stringify(SAPIAN_COMPOSTING_MODEL));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.model.control_policy).toBeUndefined();
      expect(result.model.interventions).toBeUndefined();
    }
  });
});
