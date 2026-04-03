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
    Y_n: { value: 0.1, name: 'Nitrogen Yield Coefficient', unit: 'kg_N/kg_bio' },
    x10: { value: 100.0, name: 'Inert Mass (fixed)', unit: 'kg' },
    x11: { value: 1.8, name: 'Drum Capacity (fixed)', unit: 'm³' },
  },
  state_definitions: {
    x1: { id: 't_k', name: 'Core Temperature', unit: '°C', default_value: 30.0 },
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
    x8_next: 'max(x8 + dt * (k_diff * u_fan * afp - q_resp * (x2 + x3)), 0)',
    x9_next: 'min(x9 + dt * (k_abr * u_motor * psi_soft), 1.0)',
    x12_next: 'max(x12 - dt * (k_settle * u_motor + 0.002 * abs((1 / Y_s) * mu_m * phi_lim * x2 + (1 / Y_l) * mu_t * phi_lim * x3 * x9 * psi_soft)), 0.1)',
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
