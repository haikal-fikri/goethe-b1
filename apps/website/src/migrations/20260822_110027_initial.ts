import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // HANDGEFÜGT (bitte bei einer Neugenerierung wieder ergänzen):
  // Payload erzeugt bei gesetztem `schemaName` zwar Tabellen IM Schema, aber
  // nie das Schema selbst — auf einer frischen Datenbank scheitert die
  // Migration sonst mit `schema "payload" does not exist`.
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "payload";`)

  await db.execute(sql`
   CREATE TYPE "payload"."enum_posts_category" AS ENUM('praxis', 'produkt', 'bewertung', 'datenschutz', 'fallstudie', 'didaktik', 'changelog');
  CREATE TYPE "payload"."enum_contact_submissions_teamsize" AS ENUM('1', '2–5', '6–15', '16–50', 'mehr als 50');
  CREATE TYPE "payload"."enum_contact_submissions_topic" AS ENUM('Demo für meine Schule', 'Testzugang als Einzel-Lehrkraft', 'Angebot Campus / mehrere Standorte', 'Datenschutz & AV-Vertrag', 'Etwas anderes');
  CREATE TABLE "payload"."posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"category" "payload"."enum_posts_category" NOT NULL,
  	"reading_time" varchar,
  	"published_at" timestamp(3) with time zone NOT NULL,
  	"featured" boolean DEFAULT false,
  	"author_id" integer NOT NULL,
  	"hero_image_id" integer,
  	"excerpt" varchar NOT NULL,
  	"lead" varchar NOT NULL,
  	"body" jsonb NOT NULL,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."authors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" varchar,
  	"initials" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."docs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"group_id" integer NOT NULL,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"popular" boolean DEFAULT false,
  	"updated_on" timestamp(3) with time zone,
  	"applies_to" varchar,
  	"body" jsonb NOT NULL,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."doc_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"slug" varchar,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"blur_data_u_r_l" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_wide_url" varchar,
  	"sizes_wide_width" numeric,
  	"sizes_wide_height" numeric,
  	"sizes_wide_mime_type" varchar,
  	"sizes_wide_filesize" numeric,
  	"sizes_wide_filename" varchar
  );
  
  CREATE TABLE "payload"."contact_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"organisation" varchar,
  	"teamsize" "payload"."enum_contact_submissions_teamsize",
  	"topic" "payload"."enum_contact_submissions_topic",
  	"message" varchar,
  	"consent" boolean DEFAULT false NOT NULL,
  	"submitted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "payload"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"posts_id" integer,
  	"authors_id" integer,
  	"docs_id" integer,
  	"doc_groups_id" integer,
  	"media_id" integer,
  	"contact_submissions_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lernen_url" varchar DEFAULT 'https://lernen.digi-s.institute' NOT NULL,
  	"app_store_url" varchar,
  	"play_store_url" varchar,
  	"contact_email" varchar DEFAULT 'hallo@digi-s.institute' NOT NULL,
  	"privacy_email" varchar DEFAULT 'datenschutz@digi-s.institute',
  	"image_slots_hero_lms_id" integer,
  	"image_slots_hero_app_id" integer,
  	"image_slots_home_ablauf_id" integer,
  	"image_slots_sol_app_id" integer,
  	"image_slots_sol_lms_id" integer,
  	"image_slots_about_hero_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."pricing_tiers_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."pricing_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"tagline" varchar,
  	"monthly" numeric,
  	"yearly" numeric,
  	"custom_label" varchar,
  	"cta_label" varchar NOT NULL,
  	"highlighted" boolean DEFAULT false
  );
  
  CREATE TABLE "payload"."pricing" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"note" varchar DEFAULT 'Alle Preise zzgl. USt. Die App ist für Teilnehmende der gebuchten Klassen inklusive.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."posts" ADD CONSTRAINT "posts_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "payload"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."posts" ADD CONSTRAINT "posts_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."posts" ADD CONSTRAINT "posts_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."docs" ADD CONSTRAINT "docs_group_id_doc_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "payload"."doc_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."docs" ADD CONSTRAINT "docs_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "payload"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "payload"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_docs_fk" FOREIGN KEY ("docs_id") REFERENCES "payload"."docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doc_groups_fk" FOREIGN KEY ("doc_groups_id") REFERENCES "payload"."doc_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contact_submissions_fk" FOREIGN KEY ("contact_submissions_id") REFERENCES "payload"."contact_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_settings" ADD CONSTRAINT "site_settings_image_slots_hero_lms_id_media_id_fk" FOREIGN KEY ("image_slots_hero_lms_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."site_settings" ADD CONSTRAINT "site_settings_image_slots_hero_app_id_media_id_fk" FOREIGN KEY ("image_slots_hero_app_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."site_settings" ADD CONSTRAINT "site_settings_image_slots_home_ablauf_id_media_id_fk" FOREIGN KEY ("image_slots_home_ablauf_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."site_settings" ADD CONSTRAINT "site_settings_image_slots_sol_app_id_media_id_fk" FOREIGN KEY ("image_slots_sol_app_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."site_settings" ADD CONSTRAINT "site_settings_image_slots_sol_lms_id_media_id_fk" FOREIGN KEY ("image_slots_sol_lms_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."site_settings" ADD CONSTRAINT "site_settings_image_slots_about_hero_id_media_id_fk" FOREIGN KEY ("image_slots_about_hero_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."pricing_tiers_features" ADD CONSTRAINT "pricing_tiers_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."pricing_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."pricing_tiers" ADD CONSTRAINT "pricing_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."pricing"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "posts_slug_idx" ON "payload"."posts" USING btree ("slug");
  CREATE INDEX "posts_author_idx" ON "payload"."posts" USING btree ("author_id");
  CREATE INDEX "posts_hero_image_idx" ON "payload"."posts" USING btree ("hero_image_id");
  CREATE INDEX "posts_seo_seo_og_image_idx" ON "payload"."posts" USING btree ("seo_og_image_id");
  CREATE INDEX "posts_updated_at_idx" ON "payload"."posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "payload"."posts" USING btree ("created_at");
  CREATE INDEX "authors_updated_at_idx" ON "payload"."authors" USING btree ("updated_at");
  CREATE INDEX "authors_created_at_idx" ON "payload"."authors" USING btree ("created_at");
  CREATE INDEX "docs_slug_idx" ON "payload"."docs" USING btree ("slug");
  CREATE INDEX "docs_group_idx" ON "payload"."docs" USING btree ("group_id");
  CREATE INDEX "docs_seo_seo_og_image_idx" ON "payload"."docs" USING btree ("seo_og_image_id");
  CREATE INDEX "docs_updated_at_idx" ON "payload"."docs" USING btree ("updated_at");
  CREATE INDEX "docs_created_at_idx" ON "payload"."docs" USING btree ("created_at");
  CREATE UNIQUE INDEX "doc_groups_slug_idx" ON "payload"."doc_groups" USING btree ("slug");
  CREATE INDEX "doc_groups_updated_at_idx" ON "payload"."doc_groups" USING btree ("updated_at");
  CREATE INDEX "doc_groups_created_at_idx" ON "payload"."doc_groups" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "payload"."media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "payload"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_wide_sizes_wide_filename_idx" ON "payload"."media" USING btree ("sizes_wide_filename");
  CREATE INDEX "contact_submissions_updated_at_idx" ON "payload"."contact_submissions" USING btree ("updated_at");
  CREATE INDEX "contact_submissions_created_at_idx" ON "payload"."contact_submissions" USING btree ("created_at");
  CREATE INDEX "users_sessions_order_idx" ON "payload"."users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "payload"."users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "payload"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "payload"."users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "payload"."users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_authors_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("authors_id");
  CREATE INDEX "payload_locked_documents_rels_docs_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("docs_id");
  CREATE INDEX "payload_locked_documents_rels_doc_groups_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("doc_groups_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_contact_submissions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("contact_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_image_slots_image_slots_hero_lms_idx" ON "payload"."site_settings" USING btree ("image_slots_hero_lms_id");
  CREATE INDEX "site_settings_image_slots_image_slots_hero_app_idx" ON "payload"."site_settings" USING btree ("image_slots_hero_app_id");
  CREATE INDEX "site_settings_image_slots_image_slots_home_ablauf_idx" ON "payload"."site_settings" USING btree ("image_slots_home_ablauf_id");
  CREATE INDEX "site_settings_image_slots_image_slots_sol_app_idx" ON "payload"."site_settings" USING btree ("image_slots_sol_app_id");
  CREATE INDEX "site_settings_image_slots_image_slots_sol_lms_idx" ON "payload"."site_settings" USING btree ("image_slots_sol_lms_id");
  CREATE INDEX "site_settings_image_slots_image_slots_about_hero_idx" ON "payload"."site_settings" USING btree ("image_slots_about_hero_id");
  CREATE INDEX "pricing_tiers_features_order_idx" ON "payload"."pricing_tiers_features" USING btree ("_order");
  CREATE INDEX "pricing_tiers_features_parent_id_idx" ON "payload"."pricing_tiers_features" USING btree ("_parent_id");
  CREATE INDEX "pricing_tiers_order_idx" ON "payload"."pricing_tiers" USING btree ("_order");
  CREATE INDEX "pricing_tiers_parent_id_idx" ON "payload"."pricing_tiers" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."posts" CASCADE;
  DROP TABLE "payload"."authors" CASCADE;
  DROP TABLE "payload"."docs" CASCADE;
  DROP TABLE "payload"."doc_groups" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."contact_submissions" CASCADE;
  DROP TABLE "payload"."users_sessions" CASCADE;
  DROP TABLE "payload"."users" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TABLE "payload"."site_settings" CASCADE;
  DROP TABLE "payload"."pricing_tiers_features" CASCADE;
  DROP TABLE "payload"."pricing_tiers" CASCADE;
  DROP TABLE "payload"."pricing" CASCADE;
  DROP TYPE "payload"."enum_posts_category";
  DROP TYPE "payload"."enum_contact_submissions_teamsize";
  DROP TYPE "payload"."enum_contact_submissions_topic";`)
}
