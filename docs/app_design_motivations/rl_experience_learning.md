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
     - **Teamwork and values alignment**
   - The score serves as a reward signal (R) in the system and supports future learning.

## Key Principles
- **Observations drive learning**: Actions only show intent; observations reveal outcomes.  
- **Objective and high-value**: Score based on measurable deviation from policy, not personal blame.  
- **Context-aware**: Include history and roles to improve inference of root causes.  
- **Actionable**: Inferred or documented actions from observations feed the system for corrective measures, training, or preventive maintenance.  
- **Supports RL and feedback**: Observation + inferred actions + scoring create (S, A, S', R) tuples for AI and system improvement.

---

**Example:**  
A ladder left in the rain develops rust on pivot points, and the spring fails to return.  
- **Observation**: Rust and broken spring detected (S')  
- **Context pulled**: Ladder was last used by team member X; no maintenance recorded in last 7 days  
- **Inferred action**: No storage or maintenance after use (A)  
- **Scoring**:  
  - Best-practice adherence: -2  
  - Safety risk: High  
  - Financial impact: Medium negative  
  - Teamwork alignment: Low  
- **Next step**: Generate corrective actions and preventive maintenance tasks
