CREATE TABLE `dry_fire_drills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`par_time` real NOT NULL,
	`reps` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dry_fire_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`drill_id` text NOT NULL,
	`drill_name` text NOT NULL,
	`par_time` real NOT NULL,
	`shots` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dry_fire_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`chaos_mode` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_entries` (
	`date` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`exercises` text NOT NULL,
	`bonus_reps` integer
);
--> statement-breakpoint
CREATE TABLE `workout_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`bonus_label` text DEFAULT 'Pull-ups' NOT NULL,
	`plates` text DEFAULT '[45,35,25,10,5,2.5]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`exercises` text NOT NULL
);
