# Dry-Fire Trainer Test Scenarios

## Test Scenario 1: Starting and Completing a Drill

### Happy Path

1. Navigate to Dry-Fire Trainer tool
2. Select a drill from the available drills list
3. Click "Start" button
4. Grant microphone permission when prompted
5. System displays "Get ready..." message
6. After randomized delay (5-10 seconds), system plays start beep for first rep
7. User performs dry-fire action (microphone detects click sound)
8. System records the shot time
9. System plays end beep at par time
10. System displays Hit/Miss buttons
11. User selects Hit or Miss based on their performance
12. Next rep starts automatically after button selection
13. Steps 5-12 repeat for all configured reps (default 20)
14. After final rep, system displays results bar chart
15. Verify green bars for hit shots, red bars for missed shots
16. Verify bar lengths correspond to shot times
17. User can return to drill selection screen

### Error Scenarios

- **No microphone permission**: Display clear error message, allow retry or
  manual mode
- **Lost microphone access mid-drill**: Gracefully handle, offer to continue
  without detection
- **User navigates away mid-drill**: Session is saved as incomplete, can be
  resumed

## Test Scenario 2: Shot Detection and Result Recording

### Shot Detected

1. Start a drill
2. Perform dry-fire action after start beep, before end beep
3. Verify shot time is displayed on Hit/Miss screen
4. Mark as Hit
5. Verify result shows green bar with correct time length
6. Next rep starts automatically

### Shot Detected After Par Time

1. Start a drill
2. Perform dry-fire action after end beep (within 5 seconds)
3. Verify shot time is displayed on Hit/Miss screen
4. Mark as Miss
5. Verify result shows red bar with correct time length
6. Next rep starts automatically

### No Shot Detected

1. Start a drill
2. Do not perform dry-fire action (or microphone fails to detect)
3. Wait for end beep and 5-second listening window
4. Verify Hit/Miss screen shows "No time recorded"
5. Mark as Hit or Miss
6. Verify result shows full-length bar at half opacity (green or red based on
   selection)
7. Next rep starts automatically

### Ignore Incorrect Time

1. Start a drill
2. Shot is detected with incorrect timing (e.g., accidental noise)
3. Check "Ignore time" checkbox
4. Mark as Hit or Miss
5. Verify result shows full-length bar at half opacity, time is not used in
   statistics
6. Next rep starts automatically

## Test Scenario 3: Results Visualization

### Bar Chart Display

1. Complete a drill with mix of passed/failed shots
2. Verify results screen displays:
   - Title shows drill name and date
   - Each shot numbered (1-20 or configured count)
   - Green bars for passed shots
   - Red bars for failed shots
   - Bar length represents shot time relative to par time
   - Half-opacity bars for shots with ignored/missing times
   - Summary statistics: pass count, fail count, average time

### Chart Interactions

1. Hover over bars to see exact time (if not ignored)
2. View pass percentage prominently displayed
3. Return to drill selection or start new session

## Test Scenario 4: History View

### Viewing Past Sessions

1. Navigate to History tab
2. Verify list of past sessions showing:
   - Date and time of session
   - Drill name
   - Hit rate (e.g., "15/20 hit")
   - Average time for hit shots
3. Sessions sorted by date (most recent first)

### Session Details

1. Click on a past session
2. View detailed results bar chart (same as post-drill results)
3. Navigate back to history list

### Delete Session

1. From history list, click delete button on a session
2. Confirm deletion
3. Verify session is removed from list
4. Verify localStorage is updated

### Empty State

1. With no completed sessions, verify friendly message
2. Message encourages user to complete first drill

## Test Scenario 5: Settings - Drill Management

### View Drills

1. Navigate to Settings tab
2. Verify default drills are displayed:
   - Low Ready (1.5s par, 20 reps)
   - Draw (2.0s par, 20 reps)
   - Draw from Concealment (2.5s par, 20 reps)
3. Each drill shows name, par time, and default reps

### Add Custom Drill

1. Click "Add Drill" button
2. Enter drill name (e.g., "Speed Draw")
3. Enter par time (e.g., 1.0 seconds)
4. Enter default reps (e.g., 15)
5. Save drill
6. Verify new drill appears in list
7. Verify new drill is available on drill selection screen

### Edit Drill

1. Click edit button on a drill
2. Modify name, par time, or reps
3. Save changes
4. Verify changes reflected in drill list
5. Previous sessions using this drill retain original settings

### Delete Drill

1. Click delete button on a drill with no sessions
2. Confirm deletion
3. Verify drill is removed from list

### Cannot Delete Drill With Sessions

1. Click delete button on a drill that has sessions
2. Verify error message: "Cannot delete drill with existing sessions"
3. Drill remains in list

## Test Scenario 6: Microphone Permission Handling

### First Time Permission Request

1. Start a drill for the first time
2. Browser prompts for microphone permission
3. Grant permission
4. Drill starts normally with shot detection

### Permission Denied

1. Start a drill
2. Deny microphone permission
3. Verify error message explains that shot detection won't work
4. Verify drill can still proceed with manual time entry option

### Permission Revoked Mid-Session

1. Start a drill with microphone access granted
2. Revoke permission through browser settings during drill
3. Verify graceful handling: warning message, continues without detection
4. User can still complete drill with Hit/Miss selections

### No Microphone Available

1. Access app on device without microphone
2. Verify appropriate message
3. Verify drill can run in manual mode (no shot detection)


## Test Scenario 7: Accessibility

### Keyboard Navigation

1. Navigate entire app using only keyboard
2. Tab through all interactive elements in logical order
3. Activate buttons with Enter/Space
4. Navigate between tabs with keyboard
5. Focus indicators are clearly visible

### Screen Reader Support

1. Use screen reader to navigate app
2. Verify all buttons, links, and form fields have appropriate labels
3. Verify drill status announcements (e.g., "Rep 5 of 20")
4. Verify results are announced appropriately

### Color Contrast

1. Verify all text meets WCAG AA contrast requirements
2. Hit/Miss buttons are distinguishable beyond color alone
3. Bar chart uses both color and labels for hit/miss distinction

### Focus Management

1. After completing rep, focus moves to Hit/Miss buttons
2. After selecting Hit/Miss, next rep starts automatically
3. After completing drill, focus moves to main action button
4. Modal dialogs trap focus appropriately


## Test Scenario 8: Edge Cases

### Rapid Shot Detection

1. Multiple sounds detected in quick succession
2. Verify only first detection is recorded per rep
3. Subsequent sounds are ignored until next rep

### Zero Par Time

1. Attempt to create drill with 0 or negative par time
2. Verify validation error

### Extremely Long Par Time

1. Create drill with very long par time (e.g., 30 seconds)
2. Start drill and complete rep normally
3. Verify timing and results are accurate

### Large Number of Reps

1. Create drill with 100 reps
2. Complete several reps, then navigate away
3. Verify progress is not lost
4. Resume and complete drill
5. Verify all results are saved and displayed

### Browser Storage Limits

1. Create many sessions (simulate storage pressure)
2. Verify app handles gracefully
3. Consider data cleanup or warnings
