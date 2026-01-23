PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`engine` text NOT NULL,
	`connection` text NOT NULL,
	`createdAt` integer DEFAULT '"2026-01-23T16:49:47.373Z"' NOT NULL,
	`settings` text DEFAULT '{"autoUpdateSemanticIndex":false}' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_connections`("id", "name", "description", "engine", "connection", "createdAt", "settings") SELECT "id", "name", "description", "engine", "connection", "createdAt", "settings" FROM `connections`;--> statement-breakpoint
DROP TABLE `connections`;--> statement-breakpoint
ALTER TABLE `__new_connections` RENAME TO `connections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer DEFAULT '"2026-01-23T16:49:47.373Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_conversations`("id", "name", "createdAt") SELECT "id", "name", "createdAt" FROM `conversations`;--> statement-breakpoint
DROP TABLE `conversations`;--> statement-breakpoint
ALTER TABLE `__new_conversations` RENAME TO `conversations`;--> statement-breakpoint
CREATE TABLE `__new_indexJobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection` integer NOT NULL,
	`itemsToProcess` integer,
	`itemsProcessed` integer,
	`createdAt` integer DEFAULT '"2026-01-23T16:49:47.374Z"' NOT NULL,
	`completedAt` integer,
	`error` text,
	`status` text NOT NULL,
	FOREIGN KEY (`connection`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_indexJobs`("id", "connection", "itemsToProcess", "itemsProcessed", "createdAt", "completedAt", "error", "status") SELECT "id", "connection", "itemsToProcess", "itemsProcessed", "createdAt", "completedAt", "error", "status" FROM `indexJobs`;--> statement-breakpoint
DROP TABLE `indexJobs`;--> statement-breakpoint
ALTER TABLE `__new_indexJobs` RENAME TO `indexJobs`;--> statement-breakpoint
ALTER TABLE `messages` ADD `metadata` text DEFAULT '{}';