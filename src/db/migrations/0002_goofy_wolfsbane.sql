CREATE TABLE `loans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`copy_id` integer NOT NULL,
	`borrower_name` text NOT NULL,
	`borrowed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`returned_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`copy_id`) REFERENCES `copies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `loans_copy_idx` ON `loans` (`copy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `loans_open_copy_unique` ON `loans` (`copy_id`) WHERE returned_at is null;