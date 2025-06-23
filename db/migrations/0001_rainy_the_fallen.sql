CREATE TABLE `columns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	FOREIGN KEY (`table`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `databases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`connection`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `indexJobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection` integer NOT NULL,
	`itemsToProcess` integer,
	`itemsProcessed` integer,
	`createdAt` integer DEFAULT '"2025-06-23T04:05:07.283Z"' NOT NULL,
	`completedAt` integer,
	`error` text,
	`status` text NOT NULL,
	FOREIGN KEY (`connection`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `schemas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`database` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`database`) REFERENCES `databases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schema` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`schema`) REFERENCES `schemas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_queries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection` integer NOT NULL,
	`query` text NOT NULL,
	`createdAt` integer NOT NULL,
	`title` text NOT NULL,
	FOREIGN KEY (`connection`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_queries`("id", "connection", "query", "createdAt", "title") SELECT "id", "connection", "query", "createdAt", "title" FROM `queries`;--> statement-breakpoint
DROP TABLE `queries`;--> statement-breakpoint
ALTER TABLE `__new_queries` RENAME TO `queries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer DEFAULT '"2025-06-23T04:05:07.283Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_conversations`("id", "name", "createdAt") SELECT "id", "name", "createdAt" FROM `conversations`;--> statement-breakpoint
DROP TABLE `conversations`;--> statement-breakpoint
ALTER TABLE `__new_conversations` RENAME TO `conversations`;--> statement-breakpoint
CREATE TABLE `__new_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`engine` text NOT NULL,
	`connection` text NOT NULL,
	`createdAt` integer DEFAULT '"2025-06-23T04:05:07.283Z"' NOT NULL,
	`settings` text DEFAULT '{"autoUpdateSemanticIndex":false}' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_connections`("id", "name", "description", "engine", "connection", "createdAt") SELECT "id", "name", "description", "engine", "connection", "createdAt" FROM `connections`;--> statement-breakpoint
DROP TABLE `connections`;--> statement-breakpoint
ALTER TABLE `__new_connections` RENAME TO `connections`;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`conversation` integer,
	`parts` text DEFAULT '[]' NOT NULL,
	`createdAt` integer NOT NULL,
	`query` integer,
	FOREIGN KEY (`conversation`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`query`) REFERENCES `queries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "role", "content", "conversation", "createdAt") SELECT "id", "role", "content", "conversation", "createdAt" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;