# Clever Widget Factory - Adaptive Accountability Framework

A farm management system built on the **Adaptive Accountability Framework**, designed to align worker behavior with company values through data-driven accountability and progressive responsibility.

## Core Philosophy

The Adaptive Accountability Framework is based on **Situational Leadership Theory** (Hersey & Blanchard) and **Reinforcement Learning** principles, creating a system where:

- **Accountability adapts** to each person's competence and commitment levels
- **Values-aligned behavior** is the foundation for advancement
- **AI-generated policies** provide context-specific best practices
- **Objective measurement** replaces subjective judgment

## Framework Components

### 1. Two-Dimensional Assessment

**Policy-Aligned Behavior** (Competence)
- Ability to follow AI-generated, context-specific policies listed in actions.
- Measured through solution quality and adherence to best practices

**Values-Aligned Behavior** (Commitment)  
- Actions that align with company values, even when inconvenient
- Measured through proactive issue reporting, cleanup, and transparency
- More important than policy alignment - values-aligned people won't undermine the system

### 2. Employee Levels - Dual Track System

**Policy-Aligned Behavior Track:**
- **Level 1: Policy Learner** - Learning AI-generated policies
- **Level 2: Policy Follower** - Consistently follows policies
- **Level 3: Policy Improver** - Suggests policy improvements
- **Level 4: Policy Teacher** - Mentors others on policies

**Values-Aligned Behavior Track:**
- **Level 1: Values Observer** - Learning company values
- **Level 2: Values Reporter** - Proactively reports issues
- **Level 3: Values Steward** - Takes ownership of asset care
- **Level 4: Values Leader** - Models values for others


### 3. Asset Accountability

Each asset has an **`accountable_person`** who is responsible for:
- **Issue tracking** - Identifying and reporting new issues. If Stefan is the first to document issues, it will count against the responsible owners commitment. 
- **Teamwork** - Coordinating with leadership on issue actions, resources and priority of resolutions. Issues without actions for more than 1 week will start counting against competence.
- **Documentation** - Justifying any deviations from best practices. If there is a deviation from best practices not documented, or if implementation is not documented, it will count against commitment and competence.
- **Follow-through** - Ensuring issues are properly resolved

### 4. AI-Generated Policies

The system uses a **Farm AI** that:
- **Generates policies** based on your specific priorities, resources, and capabilities
- **Considers constraints** - policies tailored to your unique situation
- **Evolves over time** - policies improve based on outcomes and feedback
- **Provides context** - specific guidance for each responsibility level

## System Features

### Automatic Issue Detection
- **Root cause analysis** - Every issue automatically analyzed for underlying causes
- **Values measurement** - Actions evaluated against company values (asset stewardship, best practices)
- **Pattern recognition** - Detects short-term solutions that create new problems
- **Deviation tracking** - Requires documentation for any policy deviation

### Accountability Tracking
- **Issue history** - Complete audit trail of all issues and actions
- **Resolution metrics** - Time to resolution, quality of solutions
- **Pattern analysis** - Frequency and types of issues per accountable person
- **Values alignment scoring** - Objective measurement of values-consistent behavior

### Progressive Responsibility
- **Clear advancement criteria** - Based on measurable performance data
- **Context-specific authority** - Authority matches readiness for specific tasks
- **Teamwork requirements** - Higher levels require coordination and mentoring
- **Values-based progression** - Advancement requires both competence AND values alignment



## Key Benefits

- **Objective assessment** - No subjective judgment, just data-driven evaluation
- **Clear expectations** - AI policies provide specific, contextual guidance
- **Values alignment** - System rewards behavior that benefits the company
- **Scalable accountability** - Stefan can delegate without losing oversight
- **Continuous improvement** - Policies and levels evolve based on performance

## Technology Stack

- **Frontend:** React, TypeScript, Vite, shadcn-ui, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Real-time)
- **AI Integration:** Farm-specific AI for policy generation
- **Performance:** Virtualized lists, lazy loading, parallel API calls

## Development

```sh
# Install dependencies
npm i

# Start development server
npm run dev

# Build for production
npm run build
```
### Issue Reporting Scoring

When someone reports an issue, **two people are evaluated** against company values through a comprehensive AI scoring system:

**1. Reporter Evaluation (Commitment)**
- **AI prompt analyzes** the reporter's behavior against company values
- **Considers factors** like:
  - Proactive issue identification
  - Transparency and honesty
  - Acting in company interest
  - Timeliness of reporting
  - Quality of issue documentation

**2. Responsible Person Evaluation (Competence + Commitment)**
- **System identifies** most likely responsible person based on work history and asset assignments
- **AI prompt analyzes** their behavior against company values and policies
- **Considers factors** like:
  - Adherence to policy OR documented implementation deviation
  - Quality of work execution
  - Asset stewardship and care
  - Documentation of deviations
  - Pattern of similar issues

**Key Principle:** Deviations from policy are acceptable if properly documented as implementation decisions

**Example:** Worker reports "Ladder left in rain overnight"
- **Reporter:** AI evaluates their commitment based on reporting behavior
- **Responsible person:** AI evaluates their competence and commitment based on work quality and planning
- **System check:** Was leaving ladder out documented in the work plan? AI considers this in scoring

**Key Benefits:**
- **Nuanced evaluation** - AI considers multiple factors, not just binary scoring
- **Context-aware** - Considers circumstances and patterns
- **Comprehensive analysis** - Looks at behavior holistically
- **Consistent standards** - AI applies same criteria across all evaluations
## Additional Implementation Examples

### Example 1: Stefan Finds Trash and Documents Issue

**Scenario:** Stefan finds trash on the ground after a worker completed work, cleans it up, documents it as an issue, and takes a picture.

**System Response:**
1. **Issue created** - "Trash left behind after work completion"
2. **Accountable person identified** - System determines most likely responsible worker
3. **Values assessment** - Poor values alignment (didn't clean up after work)
4. **Documentation** - Photo and description provide evidence
5. **Scoring impact:**
   - **Reporter (Stefan):** Commitment increase (showed values alignment by reporting)
   - **Responsible worker:** Values alignment decrease (poor cleanup), competence impact depends on whether cleanup was documented as expected

### Example 2: Worker Leaves Ladder in Rain Overnight

**Scenario:** Worker leaves a ladder outside in the rain overnight, causing rust and damage.

**System Response:**
1. **Issue created** - "Ladder left in rain overnight, showing rust damage"
2. **Accountable person identified** - System determines who was last using the ladder
3. **Values assessment** - Poor asset stewardship (didn't protect company equipment)
4. **Policy comparison** - Check against AI-generated policy for tool storage
5. **Documentation check** - Was there a documented reason for leaving it out?
6. **Scoring impact:**
   - **Responsible worker:** Values alignment decrease (poor asset care), competence impact depends on whether deviation was documented

### Example 3: Worker Documents Deviation from Policy

**Scenario:** Worker needs to use a different tool than specified in the policy due to availability, but documents the deviation with justification.

**System Response:**
1. **Issue created** - "Used alternative tool due to availability constraints"
2. **Deviation documented** - Worker explains why standard tool wasn't available
3. **Values assessment** - Good values alignment (transparent about deviation)
4. **Policy assessment** - Good competence (followed policy by documenting deviation)
5. **Scoring impact:**
   - **Worker:** Values alignment increase (transparency), competence maintained (proper documentation)

### Example 4: Repeated Short-term Solutions

**Scenario:** Worker repeatedly uses temporary fixes that fail quickly, creating a pattern of issues.

**System Response:**
1. **Pattern detected** - System identifies repeated short-term solutions
2. **Root cause analysis** - "Consistent use of temporary fixes instead of permanent solutions"
3. **Values assessment** - Poor values alignment (not investing in proper solutions)
4. **Competence assessment** - Poor competence (not following best practices)
5. **Scoring impact:**
   - **Worker:** Values alignment decrease (pattern of poor stewardship), competence decrease (pattern of poor problem-solving)