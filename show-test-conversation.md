# Test Conversation Example

## Scenario: "Light does not turn on after rain"

### Exchange 1: Collecting Facts
**User:** "Light was on yesterday at 8pm, off at 4am today, it rained overnight"

**AI:** "Okay, got it. So the key facts are:
- The light was on yesterday at 8pm
- The light was off this morning at 4am
- It rained overnight"

Stage: `collecting_facts` ✓

---

### Exchange 2: More Facts
**User:** "Other lights on the same circuit work fine"

**AI:** "Okay, good additional detail. So the key facts are:
1. Faulty light fixture - The light itself may have an electrical issue or damage from the rain.
2. Tripped circuit breaker - The rain may have caused the circuit breaker to trip.
3. Water damage to wiring - Moisture may have damaged the wiring specific to that light.

Which of these potential causes seems most likely to you based on the information provided?"

Stage: `proposing_causes` ✓ (transitioned automatically after 2 exchanges)

---

### Exchange 3: Selecting Cause
**User:** "1"

**AI:** "**Why #1 of 5:** Why is the light sensor/switch malfunctioning and not detecting daylight properly?

1. The fixture was installed improperly, leaving it vulnerable to water damage
2. The fixture was not rated for outdoor use or environmental conditions
3. There is a loose or faulty electrical connection within the fixture"

Stage: `selecting_cause` ✓ (AI provided "Why #1 of 5" with 3 options)

---

### Exchange 4: First Why Answered
**User:** "Moisture entered the fixture"

**AI:** "**Why #2 of 5:** Why did moisture enter the light fixture?

1. The fixture was not properly sealed or weatherproofed during installation
2. There is damage or a gap in the fixture that allows water intrusion
3. The fixture seal was damaged or worn out over time"

Stage: `five_whys` ✓ (transitioned from selecting_cause)
Why Count: Should be 1 (currently bugged to show 0)

---

### Exchange 5: Second Why Answered
**User:** "Insufficient weatherproofing on the fixture"

**AI:** "**Why #3 of 5:** Why was the light fixture not properly weatherproofed during installation?

1. The fixture was not designed with proper weatherproofing features
2. The installation process did not include proper sealing steps
3. There were no clear guidelines or standards for weatherproofing the fixture"

Stage: `five_whys` ✓
Why Count: Should be 2 (currently bugged to show 1)

---

### Exchange 6: Third Why Answered  
**User:** "Fixture was rated for indoor use only"

**AI:** "**Why #4 of 5:** Why was an indoor-rated light fixture used in an outdoor location?

1. The location requirements were not properly assessed before purchasing the fixture
2. The fixture specifications or rating were not checked before installation
3. There was no procurement guideline to ensure the right fixture type was selected for the location"

Stage: `five_whys` ✓
Why Count: Should be 3 (currently bugged to show 2)

---

### Exchange 7: Fourth Why Answered
**User:** "Wrong fixture was purchased without checking weather rating"

**AI:** "**Why #5 of 5:** Why was a light fixture purchased without checking the weather rating or suitability for the outdoor location?

1. There was a lack of attention to detail in the purchasing process
2. The person responsible didn't have proper training or knowledge about fixture specifications
3. There were no purchasing guidelines or procurement standards to follow"

Stage: `five_whys` ✓
Why Count: Should be 4 (currently bugged to show 3)

---

### Exchange 8: Fifth Why Answered
**User:** "No purchase guidelines specified outdoor rating requirements"

**AI:** "Okay, let's review the root cause we've identified through the 5 Whys:

[AI provides summary of the root cause chain]

The actionable root cause appears to be: [Lack of procurement standards for outdoor equipment specifications]"

Stage: `root_cause_identified` ✓

---

## Observations:

✅ **What's Working:**
- Stage transitions are correct
- AI provides "Why #X of 5" format
- AI provides exactly 3 options for each why
- AI asks one question at a time (not multiple)
- AI focuses on what WE CAN CONTROL (our processes, decisions)
- AI transitions to root cause summary after 5 whys

⚠️ **Known Issues:**
- Why count increment timing is off by 1 (shows 1 less than expected)
- This is a timing issue in the state updates, not the logic

## Key Improvements Made:

1. **Focus on Control**: AI now asks about "our decisions" not "manufacturer decisions"
   - Good: "Why was an indoor-rated fixture used outdoors?"
   - Bad: "Why didn't the manufacturer make it weatherproof?"

2. **Proper Format**: AI follows the exact format with "Why #X of 5" and 3 numbered options

3. **Single Question**: AI asks one why at a time, not multiple

