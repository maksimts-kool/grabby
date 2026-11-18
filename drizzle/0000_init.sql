CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`kind` text NOT NULL,
	`tone` text NOT NULL,
	`icon` text NOT NULL,
	`title` text NOT NULL,
	`text` text,
	`topic_id` integer
);
--> statement-breakpoint
CREATE INDEX `activity_at_idx` ON `activity` (`at`);--> statement-breakpoint
CREATE TABLE `apps` (
	`topic_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text,
	`package_name` text,
	`latest_version` text,
	`latest_is_beta` integer DEFAULT false NOT NULL,
	`latest_seen_at` integer,
	`header_updated` text,
	`changelog` text DEFAULT '[]' NOT NULL,
	`installed_version` text,
	`installed_version_code` integer,
	`icon_uri` text,
	`file_pattern` text,
	`ignored_version` text,
	`notify_betas` integer,
	`last_checked_at` integer,
	`last_modified` text,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `downloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`attach_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`url` text NOT NULL,
	`version` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`bytes_done` integer DEFAULT 0 NOT NULL,
	`bytes_total` integer,
	`speed` real,
	`path` text,
	`error` text,
	`pause_reason` text,
	`work_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `apps`(`topic_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `downloads_status_idx` ON `downloads` (`status`);--> statement-breakpoint
CREATE TABLE `files` (
	`attach_id` integer PRIMARY KEY NOT NULL,
	`topic_id` integer NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`size_bytes` integer,
	`version` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `apps`(`topic_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `files_topic_idx` ON `files` (`topic_id`);--> statement-breakpoint
CREATE TABLE `suggestions` (
	`topic_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`package_name` text NOT NULL,
	`label` text NOT NULL,
	`installed_version` text,
	`found_at` integer NOT NULL,
	`dismissed` integer DEFAULT false NOT NULL
);
