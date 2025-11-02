# Example: Action vs Best Practice Contrast

## Current Problem
Options like:
- "The fixture may have been selected without considering weather exposure"
- "The fixture was improperly selected for the application"
- "Cost-cutting measures led to lower-quality materials"

These don't provide accountability or contrast with best practice.

## What We Want Instead

**Example User Answer:** "Insufficient weatherproofing on the fixture"

**Good Why Question:**
```
Why #3 of 5: Why was insufficient weatherproofing used instead of following best practice of verifying weather rating before installation?

1. The installer did not check weather rating specifications before installation (best practice: verify rating matches environment)
2. Management approved purchase of indoor-rated fixture for outdoor use without reviewing specifications (best practice: procurement requires rating verification)
3. The purchasing process skipped weather rating verification to save time (best practice: always verify specifications before ordering)
```

**Each option shows:**
- WHO did WHAT (specific, accountable)
- Best practice contrast (what should have happened)
- The gap (why didn't we follow best practice)

## Template for AI

For each user answer, the AI should:
1. Identify the ACTION taken
2. Identify the BEST PRACTICE
3. Ask: Why did [action] instead of [best practice]?
4. Provide 3 options that each explain WHO didn't follow best practice

## Example Template:

User says: "X happened"
AI thinks: 
- Action taken: X
- Best practice would be: Y
- Question: Why did X happen instead of Y?
- Options: WHO didn't follow best practice Y

User says: "insufficient weatherproofing"
AI thinks:
- Action: Used insufficient weatherproofing
- Best practice: Verify weather rating before installation
- Question: Why did insufficient weatherproofing get used instead of verifying weather rating before installation?
- Options: WHO didn't verify (installer? procurement? management?)

