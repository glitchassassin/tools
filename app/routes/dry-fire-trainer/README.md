# Dry-Fire Trainer

A timed drill training app for dry-fire practice with audio cues and shot
detection.

## Features

### Core Functionality

- **Timed Drills**: Start beep, par time countdown, end beep
- **Shot Detection**: Uses device microphone to detect trigger click and record
  time
- **Hit/Miss Recording**: Self-report results after each rep
- **Auto-Advance**: Next rep starts automatically after marking result
- **Ignore Time Option**: Mark shots with incorrect timing to exclude from stats
- **Results Visualization**: Bar chart showing hit (green) / miss (red) with
  shot times

### Default Drills

- **Low Ready**: 1.5s par time, 20 reps
- **Draw**: 2.0s par time, 20 reps
- **Draw from Concealment**: 2.5s par time, 20 reps

### Drill Management

- Create custom drills with configurable par time and rep count
- Edit existing drills
- Delete drills (only if no sessions exist)
- Par time range: 0.1s - 60s
- Reps range: 1 - 100

### History Tracking

- View all completed sessions
- Session details: date, drill name, hit rate, average time
- Detailed results view with bar chart
- Delete individual sessions

### Data Management

- All data is centralized in the database
- Uses versioned data models for future migrations

## Architecture

### Data Layer (`data.client.ts`)

- Zod schemas for type-safe data validation
- `useDryFireTracker()` custom hook for state management
- Uses `declareModel` for versioned data persistence
- Helper functions for calculations and formatting

### Context (`context.client.tsx`)

- React Context provider wrapping all routes
- Shares data and helper functions across components

### Routes

- `_layout.tsx` - Tab navigation layout
- `_index/route.tsx` - Drill selection screen
- `session.$sessionId/route.tsx` - Active drill execution
- `history/route.tsx` - Past sessions list and details
- `settings/route.tsx` - Drill CRUD and configuration

### Audio System

- **Web Audio API** for beep generation
- **Randomized delay** between Start button press and start beep (5-10 seconds)
- Start beep: 800Hz sine wave, 0.1s duration
- End beep: 400Hz sine wave, 0.2s duration

### Shot Detection

- **MediaStream API** for microphone access
- **AnalyserNode** for real-time audio analysis
- Peak detection algorithm with configurable threshold (0.7)
- Listens during rep and up to 5 seconds after par time
- Stops listening when Hit/Miss is selected

## Usage

### Starting a Drill

1. Navigate to Dry-Fire Trainer
2. Select a drill from the list
3. Grant microphone permission when prompted (optional)
4. Click "Start" to begin first rep

### During a Rep

1. Click "Start" button
2. System displays "Get ready..." message
3. After randomized delay (5-10 seconds), start beep plays
4. Draw and fire after beep
5. End beep plays at par time
6. Shot time is displayed (if detected)
7. Select Hit or Miss
8. Check "Ignore time" if needed
9. Next rep starts automatically
10. Repeat for all reps

### Viewing Results

- After completing all reps, see:
  - Hit rate percentage
  - Bar chart of all shots
  - Green bars = hit shots
  - Red bars = missed shots
  - Bar length = shot time
  - Half opacity = ignored/missing time

### Managing Drills

1. Navigate to Settings tab
2. Click "Add Drill" to create new drill
3. Click "Edit" to modify existing drill
4. Click "Delete" to remove drill (if no sessions exist)


## Technical Details

### Microphone Permission Handling

- Gracefully handles denied permissions
- Continues drill without shot detection
- User can still complete reps manually
- Shows warning message when permission denied

### Data Structure

```typescript
{
  drills: [
    {
      id: string
      name: string
      parTime: number // seconds
      reps: number
    }
  ],
  sessions: [
    {
      id: string
      date: string // ISO 8601
      drillId: string
      drillName: string
      parTime: number
      shots: [
        {
          time: number | null // seconds
          hit: boolean | null
          ignored: boolean
        }
      ],
      completed: boolean
    }
  ]
}
```

### Browser Compatibility

- Requires modern browser with Web Audio API support
- Requires MediaStream API for microphone access
- Tested on latest Chrome, Firefox, Safari, Edge

## Testing

E2E tests located in `/tests/dry-fire-trainer.spec.ts`

Tests cover:

- Drill selection and navigation
- Custom drill creation and editing
- Session execution (manual mode)
- Hit/Miss recording
- Auto-advance to next rep
- Ignore time functionality
- History viewing and deletion
- Accessibility (Axe)
- Keyboard navigation

Run tests with:

```bash
npm run test:e2e
```
