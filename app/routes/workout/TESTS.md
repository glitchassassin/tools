# Workout Tracker – E2E Scenario Outline

These scenarios assume a mobile viewport unless noted otherwise. Seed local
storage state as described in each scenario setup. Run Axe against every primary
page visited (`/workout`, `/workout/workout/<date>`, `/workout/history`,
`/workout/settings`) and confirm no accessibility violations before completing
the scenario.

## Index Route (`/workout`)

### Scenario: Start a fresh workout from the landing page

- **Setup**: Ensure no workout exists in local storage for today.
- **Steps**: Load the index route.
- **Assertions**: Verify the hero section presents a prominent circular
  `Start Workout` button, max weights for each exercise appear below it, and nav
  links to History and Settings are visible. Tap `Start Workout` and confirm
  navigation to `/workout/workout/<today>`.

### Scenario: Continue an in-progress workout

- **Setup**: Seed a workout for today with at least one completed exercise.
- **Steps**: Load the index route.
- **Assertions**: `Start Workout` button label changes to `Finish Workout` and
  directs to the existing workout. Max weights reflect the seeded data.

## Current Workout Route (`/workout/workout/<date>`)

### Scenario: Auto-create a workout for a new date

- **Setup**: Remove any workout entry for `<date>`.
- **Steps**: Visit the current workout route directly.
- **Assertions**: A new workout is created using the default Workout A/B
  template for the selected date, inactive exercises render collapsed with
  weight and set summaries left blank, and exactly one exercise (the first) is
  active.

### Scenario: Default weights and active exercise behavior

- **Setup**: Seed a previous workout for the same exercise with known weights
  and reps; ensure the target date has an existing workout to edit.
- **Steps**: Activate an exercise with prior history, observe initial weight,
  expand another exercise.
- **Assertions**: The active exercise auto-populates weight as last weight + 5,
  inactive exercises collapse when another exercise is expanded so only one is
  active, and the collapsed cards display the current weight and per-set reps
  after edits.

### Scenario: Plate math helper reflects entered weight

- **Setup**: Use a workout date with an existing exercise.
- **Steps**: Enter a weight (e.g., 150 lbs) for an exercise.
- **Assertions**: The UI lists the correct plate denomination breakdown per side
  based on configured plates (default: 45, 35, 25, 10, 5, 2.5). Changing the
  configured denominations (see Settings scenario) updates the breakdown
  accordingly on reload.

### Scenario: Rep inputs are touch-friendly increment/decrement controls

- **Setup**: Load a workout with at least one active exercise.
- **Steps**: Use the increment and decrement controls around a rep input.
- **Assertions**: Buttons adjust the rep count by ±1, the value never drops
  below zero, and focus remains within the active exercise card.

### Scenario: Copy workout summary to clipboard

- **Setup**: Fill out a workout with varied reps (e.g., four sets of 5 and one
  set of 4) and a bonus reps entry.
- **Steps**: Tap `Copy Workout`.
- **Assertions**: System clipboard receives the formatted summary with date,
  workout label, grouped set notation (e.g., `80x4x5, 80x1x4`), and the bonus
  reps line. Success feedback (toast or similar) displays.

### Scenario: Delete workout confirmation flow

- **Setup**: Ensure a workout exists for `<date>`.
- **Steps**: Tap `Delete Workout`, confirm the prompt.
- **Assertions**: Confirmation dialog shows "Are you sure?", accepting it
  removes the workout from local storage and redirects to `/workout`. Returning
  to the workout URL recreates a fresh workout.

## History Route (`/workout/history`)

### Scenario: Chart displays trends for each exercise and bonus reps

- **Setup**: Seed multiple workouts across different dates with varying weights
  and bonus reps.
- **Steps**: Open the history route.
- **Assertions**: A line chart renders with separate lines per exercise plus a
  line representing bonus reps counts. Hover or tap tooltips show correct
  date/weight (or rep) pairs. Axe scan passes.

### Scenario: Workout log navigation

- **Setup**: Seed at least two workouts.
- **Steps**: Scroll to the log list, inspect entries, activate one.
- **Assertions**: Each entry lists exercises with grouped set summaries. Tapping
  an entry navigates to the corresponding `/workout/workout/<date>` route with
  details intact.

## Settings Route (`/workout/settings`)

### Scenario: Customize workout templates and bonus reps label

- **Setup**: Start from default configuration.
- **Steps**: Modify exercise descriptions and set counts for Workout A/B, change
  the bonus reps description, save.
- **Assertions**: Success feedback appears, navigating to a new workout reflects
  the updated template, bonus reps label updates (and hides if cleared).

### Scenario: Adjust available plate denominations

- **Setup**: Load settings with defaults.
- **Steps**: Change the plate options (e.g., remove 35 lb, add 1.25 lb), save,
  and open an existing workout.
- **Assertions**: Plate breakdown helper recalculates using the new
  denominations, persisting after reload.
