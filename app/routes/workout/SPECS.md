# Workout Tracker

This is a workout tracker for me to use at the gym, making it easy to track my
progress and scale up weights.

## Acceptance Criteria

The app is designed primarily for mobile screen sizes but is responsive up to
desktop sizes using Tailwind styles.

- Index
  - The main route should be the Workout view, with a large circular "Start
    Workout" button (or "Finish Workout", if we already have a workout for the
    current date) that launches into /workout/$currentDate. Secondary routes
    include workout/settings/ and workout/history/.
  - Show the current max weight for each exercise below the Start Workout
    button.
- Current Workout
  - The workout date is determined from the URL. If no workout is stored for
    this date, create one automatically when the URL is loaded.
  - Inactive exercises are collapsed, showing the name of the field, the
    recorded weight (if entered), and the number of reps for each set (if
    entered).
  - The active exercise is expanded, showing a field for the weight and one
    field for each rep.
    - If there is a previous instance of this exercise, the weight defaults to
      the previous value plus 5.
    - If the weight is populated, compute the correct weights to add to a
      45-pound barbell. For example, if the weight is 150, the weights for one
      side of the barbell should be (150 - 45) / 2 = 52.5, which is a 45lb, 5lb,
      and 2.5lb weight. Weights are available in 45, 35, 25, 10, 5, and 2.5lb
      denominations.
    - The fields for the reps should have touch-friendly buttons above and below
      to increment and decrement the field.
  - Only one exercise may be active at a time.
  - A "Copy Workout" button at the end of the workout copies the workout as a
    block of text with the date, the workout (A or B), and each exercise with
    its weight, sets, and reps. If a set has a different number of reps, group
    them together. At the end, display the "bonus reps" exercise with its rep
    count. Here's an example:

```text
10/7/2025 | Workout A
Squat: 160x5x5
Overhead Press: 80x4x5, 80x1x4
Deadlift: 135x1x5
Pull-ups: 4 reps
```

- A "Delete Workout" button at the end of the workout allows the user to delete
  the workout record. This prompts the user with "Are you sure?" before deleting
  the workout and then redirects the user back to the main route.

- History
  - The history route displays a chart of weight vs. date with a line for each
    individual exercise. Below the chart, it displays a log of past workouts.
  - Chart view
    - The chart displays lbs vs. date, with a line for each individual exercise.
    - In addition, the chart displays an extra line for the "bonus reps"
      exercise, based on the number of reps rather than weight.
  - Log view
    - Display a text log of past workouts. For each exercise in a workout,
      display weight, sets, and reps respectively like 135x1x5. If a set has a
      different number of reps, group them together, like "135x4x5, 135x1x4" (to
      show four sets of 5 reps and one set of 4 reps). Clicking or tapping on a
      past workout takes the user to that workout page.
- Settings
  - I want to be able to customize the description or number of sets for each
    exercise in a workout.
  - I want to be able to customize the description for the "bonus reps" exercise
    (or leave it blank to exclude it).
  - I want the default configuration of workouts to include Workout A (Squat [5
    sets], Overhead Press [5 sets], Deadlift [1 set]) and Workout B (Squat [5
    sets], Bench Press [5 sets], Barbell Row [5 sets]). The default bonus reps
    description is "Pull-ups".
  - I want to be able to configure the denominations of weights (default is 45,
    35, 25, 10, 5, and 2.5 lbs)
- Data Storage
  - Data will be stored client-side in local storage.
