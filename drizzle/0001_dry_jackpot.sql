CREATE TABLE `holiday` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`portion` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`closed_by` text,
	`closed_at` integer,
	`close_reason` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `holiday_user_dates_idx` ON `holiday` (`user_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `holiday_status_dates_idx` ON `holiday` (`status`,`start_date`,`end_date`);