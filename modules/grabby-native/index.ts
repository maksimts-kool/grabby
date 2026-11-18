import { NativeModule, requireOptionalNativeModule } from 'expo';

export interface InstalledPackage {
  packageName: string;
  label: string;
  versionName: string | null;
  versionCode: number;
  firstInstallTime: number;
  lastUpdateTime: number;
  isSystem: boolean;
}

export interface DownloadRequest {
  /** Grabby's download row id, as a string. */
  id: string;
  url: string;
  fileName: string;
  /** "AIMP 4.13.1541" — used in the progress and ready notifications. */
  title: string;
  installedVersion?: string | null;
  wifiOnly: boolean;
  userAgent: string;
}

export type DownloadError = 'sign-in' | 'gone' | 'storage' | 'network' | 'corrupt' | 'unknown';

export interface NativeDownloadState {
  id: string;
  workId: string;
  /** WorkManager state: enqueued, running, succeeded, failed, blocked, cancelled. */
  state: 'enqueued' | 'running' | 'succeeded' | 'failed' | 'blocked' | 'cancelled';
  bytesDone: number;
  /** -1 when unknown. */
  bytesTotal: number;
  path: string | null;
  error: DownloadError | null;
  paused: boolean;
  attempts: number;
}

export type InstallStatus =
  | 'pending-user'
  | 'success'
  | 'aborted'
  | 'storage'
  | 'incompatible'
  | 'conflict'
  | 'invalid'
  | 'blocked'
  | 'failure';

export type GrabbyNativeEvents = {
  onDownloadProgress: (e: {
    id: string;
    bytesDone: number;
    bytesTotal: number;
    speed: number;
  }) => void;
  onDownloadComplete: (e: { id: string; path: string; bytesTotal: number }) => void;
  onDownloadFailed: (e: { id: string; error: DownloadError; message: string }) => void;
  onDownloadPaused: (e: { id: string }) => void;
  onInstallStatus: (e: {
    downloadId: string;
    sessionId: number;
    status: InstallStatus;
    packageName: string;
    message: string;
  }) => void;
};

declare class GrabbyNativeModule extends NativeModule<GrabbyNativeEvents> {
  readonly apkDirectory: string;
  getInstalledPackages(includeSystem: boolean): Promise<InstalledPackage[]>;
  getPackage(packageName: string): Promise<InstalledPackage | null>;
  getAppIcon(packageName: string, size: number): Promise<string | null>;
  getApkInfo(path: string): Promise<InstalledPackage | null>;
  openApp(packageName: string): boolean;
  uninstallApp(packageName: string): boolean;
  enqueueDownload(request: DownloadRequest): string;
  pauseDownload(id: string): void;
  cancelDownload(id: string, fileName: string): void;
  getDownloads(): Promise<NativeDownloadState[]>;
  deleteApk(path: string): boolean;
  getFreeSpace(): number;
  canRequestPackageInstalls(): boolean;
  installApk(path: string, downloadId: string): Promise<number>;
  openInstallPermissionSettings(): void;
  openNotificationSettings(channelId: string | null): void;
  isIgnoringBatteryOptimizations(): boolean;
  openBatteryOptimizationSettings(): void;
  ensureChannels(): void;
  getNetworkType(): NetworkType;
  /** `name=value; name2=value2` for the URL, from the WebView cookie jar. */
  getCookies(url: string): string | null;
  clearCookies(): Promise<boolean>;
}

export type NetworkType = 'wifi' | 'cellular' | 'other' | 'none';

/**
 * The Kotlin module. Optional so that unit tests and Expo Go load without it;
 * every caller goes through `src/native` which handles its absence.
 */
export const GrabbyNative = requireOptionalNativeModule<GrabbyNativeModule>('GrabbyNative');
