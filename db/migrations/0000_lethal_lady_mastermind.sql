CREATE TABLE IF NOT EXISTS `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer DEFAULT '"2025-06-17T01:56:38.842Z"' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`engine` text NOT NULL,
	`connection` text NOT NULL,
	`createdAt` integer DEFAULT '"2025-06-17T01:56:38.842Z"' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`conversation` integer,
	`query` integer,
	`toolCallId` text,
	`toolCallStatus` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`conversation`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`query`) REFERENCES `queries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `queries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection` integer NOT NULL,
	`query` text NOT NULL,
	`createdAt` integer NOT NULL,
	`title` text NOT NULL,
	FOREIGN KEY (`connection`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action
);