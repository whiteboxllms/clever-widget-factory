# Observations: Core of Learning and Inference

## Purpose
Observations are the **primary point for learning and reflection** in the system. They capture the realized outcome of work or events, providing the foundation to:

- Assess alignment with company values and best practices
- Identify financial, safety, and operational impact
- Generate actionable insights for improvement

Observations are **more important than actions for long-term success**, because they show what actually happened, not just what was planned or assigned.

## Observation Workflow

1. **Capture the Observation**
   - Record the actual state of an asset, environment, or system (S').  
   - Include evidence where possible: photos, measurements, or other objective documentation.  
   - Focus on high-value items or events (both positive and negative).

2. **Pull Relevant Context**
   - Gather historical information about the asset or task, including:
     - Prior actions or tasks related to the asset
     - Roles of team members involved
     - Environmental conditions
   - This context allows more accurate analysis of the observation.

3. **Infer Likely Actions (Root Cause)**
   - If actions were not documented, the system can infer what likely occurred to result in the observed state.  
   - Example: Poorly poured concrete → inferred action: incorrect mixing or placement technique.  
   - These inferred actions can be recorded as actionable items for accountability and learning.

4. **Identify the New State**
   - Update the system with the new observed state (S').  
   - Capture deviations from best practice, asset condition, and risk exposure.

5. **Score Against Company Values**
   - Evaluate the observation and inferred actions across multiple dimensions:
     - **Best-practice adherence**  
     - **Financial impact**  
     - **Safety risk**  
     - **Team Operational Alignment**
   - The score serves as a reward signal (R) in the system and supports future learning.

## Key Principles
- **Observations drive learning**: Actions only show intent; observations reveal outcomes.  
- **Objective and high-value**: Score based on measurable deviation from policy, not personal blame.  
- **Context-aware**: Include history and roles to improve inference of root causes.  
- **Actionable**: Inferred or documented actions from observations feed the system for corrective measures, training, or preventive maintenance.  
- **Supports RL and feedback**: Observation + inferred actions + scoring create (S, A, S', R) tuples for AI and system improvement.

## Reward Structure

### Core Concept

Reward reflects how well the system (and human actions) preserved value, reduced risk, and aligned with operational standards.

**Key points:**
- Observation → S′ (actual observed state)
- Compare with expected state (S_expected) based on previous state and natural degradation
- Compute delta = S′ − S_expected
- Reward is a function of delta and inferred/documented actions

### Minimal Reward Formula

R = Σᵢ wᵢ × Δᵢ

Where Δᵢ are outcome deltas along different dimensions:

| Dimension | Δ Definition | Weight |
|-----------|--------------|--------|
| **Asset Stewardship** | Δ_condition = Condition_current − Condition_expected | w₁ = 0.4 |
| **Safety / Risk** | Δ_risk = Risk_baseline − Risk_observed | w₂ = 0.3 |
| **Team Operational Alignment** | Δ_team = +1 if issues reported/mitigated, −1 if ignored | w₃ = 0.3 |

### Reward Calculation Example: Ladder Scenario

**Last known state (S):** Ladder stored properly, minor rust on pivot  
**Expected state (S_expected):** Minor rust (normal degradation)  
**Observed state (S′):** Ladder outside in rain, rust accelerated, spring broken

**Compute deltas:**
- Δ_condition = Condition_current − Condition_expected → **-2** (asset degraded more than expected)
- Δ_risk = Risk_baseline − Risk_observed → **-2** (hazard present)
- Δ_team = +1 if person documented/assigned corrective task, −1 if ignored → **-1** (ignored)

**Reward:**
```
R = 0.4×(-2) + 0.3×(-2) + 0.3×(-1)
R = -0.8 - 0.6 - 0.3
R = -1.7
```

**Negative reward** → signals system "learning" that outcome was worse than expected

**If person had documented/mitigated risk:** Δ_team = +1
```
R = 0.4×(-2) + 0.3×(-2) + 0.3×(+1)
R = -0.8 - 0.6 + 0.3
R = -1.1
```
Reward partially offsets damage through proper documentation and response.

### Key Features of This Reward

- **Delta-based**: Differentiates pre-existing vs new damage
- **Outcome-focused**: No psychological inference, purely objective
- **Action-incentivized**: Documentation, escalation, and mitigation increase reward
- **Multi-dimensional**: Balances stewardship, safety, and operational alignment
- **RL-compatible**: Directly usable in (S, A, S′, R) tuples for learning algorithms

---

## Examples

### Example 1: Tool Maintenance Failure
A ladder left in the rain develops rust on pivot points, and the spring fails to return.  
- **Observation (S')**: Rust and broken spring detected  
- **Context pulled**: Ladder was last used by team member X; no maintenance recorded in last 7 days  
- **Expected action E[A]**: No storage or maintenance after use (inferred from lack of documentation)  
- **Scoring**:  
  - Best-practice adherence: -2  
  - Safety risk: High  
  - Financial impact: Medium negative  
  - Teamwork alignment: Low  
- **Next step**: Generate corrective actions and preventive maintenance tasks

### Example 2: Biological Asset Growth (Mani Mani Plant)
User creates a mani mani plant record with initial photo, then captures observation weeks later with new photo.
- **Initial state (S)**: Photo of newly planted mani mani seedling (Jan 15)
- **Observation (S')**: Photo of mature mani mani plant with visible growth (Feb 11)
- **Expected action E[A]**: Time passed + natural growth (biological process, no explicit human action)
- **Context**: For biological assets, the "action" can be the passage of time and natural processes
- **Future enhancement**: Image analysis could extract growth metrics (height, leaf count, health indicators)
- **Experience value**: Tracks growth rate, identifies anomalies (too fast/slow), supports yield prediction
- **Scoring dimensions**:
  - Growth rate vs. expected (surprise factor)
  - Health indicators (color, size, pest damage)
  - Resource efficiency (water, nutrients used)
  - Alignment with cultivation best practices
