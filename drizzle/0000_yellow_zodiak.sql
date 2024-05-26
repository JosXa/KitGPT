CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`messages` jsonb,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP)
);
