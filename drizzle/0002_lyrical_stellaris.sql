ALTER TABLE `apps` ADD `topic_icon_url` text;--> statement-breakpoint
-- Topics now carry their header icon: re-read every topic once instead of trusting 304s.
UPDATE `apps` SET `last_modified` = NULL;