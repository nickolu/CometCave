# Secret Word Scoring Feature

## Overview

A comprehensive scoring system has been implemented for the Secret Word game that factors in word difficulty, efficiency, and speed to provide players with a meaningful score when they win.

## Implementation Details

### Changes Made

1. **Player Interface Extension** (`src/app/secret-word/page.tsx`)

   - Added `wordScore?: number` field to the `Player` interface
   - Modified `handleSetupComplete` to accept and store the word score

2. **Setup Component Updates** (`src/app/secret-word/components/SecretWordSetup.tsx`)

   - Updated `SecretWordSetupProps` to pass word score in `onSetupComplete` callback
   - Modified `handleProceed` to include the word score when advancing to gameplay

3. **End Component Enhancements** (`src/app/secret-word/components/SecretWordEnd.tsx`)
   - Added `calculateFinalScore()` function for score computation
   - Added `getScoreBreakdown()` function for detailed scoring display
   - Updated UI to show final score and breakdown when player wins

### Scoring Algorithm

The final score is calculated using the following formula:

```
Final Score = Base Word Score + Message Bonus + Time Bonus
```

#### Base Word Score

- Derived from the word's rarity/difficulty as determined by the existing scoring API
- Ranges from minimum 10 points (common words) to higher values for rare words

#### Message Bonus (Efficiency)

- Maximum 50 bonus points for fewer messages
- Formula: `Math.max(0, 50 - Math.floor(messageCount / 2))`
- Rewards players who can win with fewer conversational exchanges

#### Time Bonus (Speed)

- Maximum 30 bonus points for faster completion
- Formula: `Math.max(0, 30 - Math.max(0, gameDurationMinutes - 1) * 5)`
- First minute is "free", then 5 points deducted per additional minute
- Rewards players who can win quickly

#### Score Floor

- The final score is always at least equal to the base word score
- Ensures players are never penalized below their word's inherent difficulty value

### Scoring Examples

**Example 1: Efficient Win**

- Base word score: 25 points (word: "elephant")
- Messages: 3 total
- Time: 1 minute
- Message bonus: 50 - floor(3/2) = 49 points
- Time bonus: 30 - 0 = 30 points
- **Final Score: 104 points**

**Example 2: Long Game**

- Base word score: 15 points (word: "garden")
- Messages: 20 total
- Time: 8 minutes
- Message bonus: 50 - floor(20/2) = 40 points
- Time bonus: 30 - (8-1) \* 5 = -5 → 0 points (floor at 0)
- **Final Score: 55 points**

**Example 3: Very Long Game**

- Base word score: 50 points (word: "serendipity")
- Messages: 100 total
- Time: 20 minutes
- Message bonus: 50 - floor(100/2) = 0 points (floor at 0)
- Time bonus: 30 - (20-1) \* 5 = -65 → 0 points (floor at 0)
- **Final Score: 50 points** (base score floor)

### UI Features

1. **Score Display**: Large, prominent final score when player wins
2. **Score Breakdown**: Detailed breakdown showing:
   - Word difficulty points
   - Efficiency bonus (with message count)
   - Speed bonus (with duration)
   - Total calculation
3. **Word Difficulty Indicator**: Shows base word score in the game summary
4. **Visual Design**: Green-colored score display to indicate success

### Technical Notes

- Scoring is only calculated and displayed when the player wins
- All score calculations use integer math for consistency
- Time calculations round to the nearest minute
- The feature is backward compatible - games without word scores won't display scoring
- Score calculation is pure and testable (no side effects)
