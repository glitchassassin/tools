# Workout Settings Import/Export

## Happy path – export then import
- Seed local storage with distinct config and workouts data (non-default values).
- Navigate to Workout Settings.
- Activate `Export data`; browser downloads `workout-tracker-data-<date>.json`.
- Open the downloaded JSON; it contains `{ "config": "<exact config string>", "workouts": "<exact workouts string>" }` matching localStorage values.
- Clear localStorage and reload settings.
- Use `Import data`, select the previously exported file.
- App displays a confirmation, settings form reflects imported config, and workouts view uses imported data.

## Error – invalid JSON file
- Navigate to Workout Settings.
- Trigger `Import data`, choose a `.json` file with malformed JSON.
- App surfaces a readable error without changing existing config/workouts.

## Error – missing required keys
- Navigate to Workout Settings.
- Trigger `Import data`, choose a well-formed JSON missing `config` or `workouts`.
- App surfaces a readable error and leaves existing data untouched.
