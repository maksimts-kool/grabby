import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** One tracked 4PDA topic, with what Grabby last parsed from its first post. */
export const apps = sqliteTable('apps', {
  topicId: integer('topic_id').primaryKey(),
  title: text('title').notNull(),
  /** The forum section from the breadcrumbs ("Мультимедиа"). */
  category: text('category'),
  /** From the post header ("Имя пакета: …") or matched against installed apps. */
  packageName: text('package_name'),
  latestVersion: text('latest_version'),
  latestIsBeta: integer('latest_is_beta', { mode: 'boolean' }).notNull().default(false),
  /** Label of the mod ("Plus (NURIK)") when the latest build is a mod, not the official one. */
  latestMod: text('latest_mod'),
  /** When Grabby first saw `latestVersion` (ms). */
  latestSeenAt: integer('latest_seen_at'),
  /** "Последнее обновление программы в шапке", as posted (dd.mm.yyyy). */
  headerUpdated: text('header_updated'),
  changelog: text('changelog', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  /** Cached from PackageManager on every check / app start. */
  installedVersion: text('installed_version'),
  installedVersionCode: integer('installed_version_code'),
  /** Local file:// URI of the launcher icon extracted by the native module. */
  iconUri: text('icon_uri'),
  /** Pattern of the file the user picked, so the next update picks the same build. */
  filePattern: text('file_pattern'),
  ignoredVersion: text('ignored_version'),
  /** Per-app override of the global beta setting; null follows Settings. */
  notifyBetas: integer('notify_betas', { mode: 'boolean' }),
  lastCheckedAt: integer('last_checked_at'),
  /** Last-Modified of the topic page, sent back as If-Modified-Since. */
  lastModified: text('last_modified'),
  /** Machine code of the last check failure: network, parse, not-found, sign-in. */
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
});

/** APKs attached to the topic's first post (current version only). */
export const files = sqliteTable(
  'files',
  {
    attachId: integer('attach_id').primaryKey(),
    topicId: integer('topic_id')
      .notNull()
      .references(() => apps.topicId, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    sizeBytes: integer('size_bytes'),
    version: text('version'),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('files_topic_idx').on(t.topicId)],
);

export const DOWNLOAD_STATUS = [
  'queued',
  'downloading',
  'paused',
  'ready',
  'failed',
  'installed',
  'cancelled',
] as const;
export type DownloadStatus = (typeof DOWNLOAD_STATUS)[number];

export const downloads = sqliteTable(
  'downloads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    topicId: integer('topic_id')
      .notNull()
      .references(() => apps.topicId, { onDelete: 'cascade' }),
    attachId: integer('attach_id').notNull(),
    fileName: text('file_name').notNull(),
    url: text('url').notNull(),
    version: text('version'),
    status: text('status', { enum: DOWNLOAD_STATUS }).notNull().default('queued'),
    bytesDone: integer('bytes_done').notNull().default(0),
    bytesTotal: integer('bytes_total'),
    /** Bytes per second, smoothed. */
    speed: real('speed'),
    /** Absolute path of the finished APK. */
    path: text('path'),
    /** Failure code: sign-in, gone, storage, network, checksum, unknown. */
    error: text('error'),
    /** Why a paused download is waiting: wifi, user. */
    pauseReason: text('pause_reason'),
    /** WorkManager request id from the native module. */
    workId: text('work_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('downloads_status_idx').on(t.status)],
);

export const ACTIVITY_TONE = ['update', 'success', 'danger', 'neutral'] as const;

/** Everything Grabby did or found — including what it chose not to notify about. */
export const activity = sqliteTable(
  'activity',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: integer('at').notNull(),
    kind: text('kind').notNull(),
    tone: text('tone', { enum: ACTIVITY_TONE }).notNull(),
    icon: text('icon').notNull(),
    title: text('title').notNull(),
    text: text('text'),
    topicId: integer('topic_id'),
  },
  (t) => [index('activity_at_idx').on(t.at)],
);

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type AppFile = typeof files.$inferSelect;
export type Download = typeof downloads.$inferSelect;
export type ActivityEntry = typeof activity.$inferSelect;
