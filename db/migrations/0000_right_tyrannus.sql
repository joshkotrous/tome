CREATE TABLE `databases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`engine` text NOT NULL,
	`connection` text NOT NULL
);
