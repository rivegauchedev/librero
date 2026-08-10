CREATE TABLE `authors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_name` text NOT NULL,
	`match_key` text NOT NULL,
	`open_library_author_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_name_unique` ON `authors` (lower("name"));--> statement-breakpoint
CREATE INDEX `authors_match_key_idx` ON `authors` (`match_key`);--> statement-breakpoint
CREATE TABLE `copies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`medium` text DEFAULT 'physical' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`condition` text,
	`acquired_date` integer,
	`purchase_price_cents` integer,
	`location` text,
	`notes` text,
	`file_name` text,
	`file_path` text,
	`file_size_bytes` integer,
	`file_format` text,
	`external_service` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `copies_edition_idx` ON `copies` (`edition_id`);--> statement-breakpoint
CREATE TABLE `editions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_id` integer NOT NULL,
	`isbn10` text,
	`isbn13` text,
	`title` text,
	`publisher` text,
	`publish_year` integer,
	`page_count` integer,
	`language` text,
	`format` text DEFAULT 'paperback' NOT NULL,
	`edition_note` text,
	`cover_path` text,
	`cover_source_url` text,
	`open_library_edition_id` text,
	`metadata_source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editions_isbn13_unique` ON `editions` (`isbn13`);--> statement-breakpoint
CREATE INDEX `editions_isbn10_idx` ON `editions` (`isbn10`);--> statement-breakpoint
CREATE INDEX `editions_work_idx` ON `editions` (`work_id`);--> statement-breakpoint
CREATE TABLE `metadata_cache` (
	`provider` text NOT NULL,
	`key` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `key`)
);
--> statement-breakpoint
CREATE TABLE `series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `series_name_unique` ON `series` (lower("name"));--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (lower("name"));--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (lower("username"));--> statement-breakpoint
CREATE TABLE `work_authors` (
	`work_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`role` text DEFAULT 'author' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`work_id`, `author_id`, `role`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_authors_author_idx` ON `work_authors` (`author_id`);--> statement-breakpoint
CREATE TABLE `work_series` (
	`work_id` integer NOT NULL,
	`series_id` integer NOT NULL,
	`position` real,
	PRIMARY KEY(`work_id`, `series_id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_series_series_idx` ON `work_series` (`series_id`);--> statement-breakpoint
CREATE TABLE `work_tags` (
	`work_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`work_id`, `tag_id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_tags_tag_idx` ON `work_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`sort_title` text NOT NULL,
	`match_key` text NOT NULL,
	`original_language` text,
	`first_publish_year` integer,
	`description` text,
	`open_library_work_id` text,
	`reading_status` text DEFAULT 'unread' NOT NULL,
	`rating` integer,
	`date_finished` integer,
	`notes` text,
	`is_wishlist` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `works_ol_work_unique` ON `works` (`open_library_work_id`);--> statement-breakpoint
CREATE INDEX `works_match_key_idx` ON `works` (`match_key`);--> statement-breakpoint
CREATE INDEX `works_sort_title_idx` ON `works` (`sort_title`);--> statement-breakpoint
CREATE INDEX `works_wishlist_idx` ON `works` (`is_wishlist`);