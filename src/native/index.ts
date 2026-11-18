import * as Device from 'expo-device';

import {
  GrabbyNative,
  type DownloadRequest,
  type GrabbyNativeEvents,
  type InstalledPackage,
  type NativeDownloadState,
  type NetworkType,
} from '../../modules/grabby-native';

export type {
  DownloadError,
  InstallStatus,
  InstalledPackage,
  NativeDownloadState,
  NetworkType,
} from '../../modules/grabby-native';

/**
 * Typed access to the Kotlin module. Every call degrades to a harmless default when the
 * module isn't there (unit tests, Expo Go), so screens never crash on a missing binding.
 */
export const native = {
  available: GrabbyNative != null,

  getInstalledPackages: (includeSystem = false): Promise<InstalledPackage[]> =>
    GrabbyNative?.getInstalledPackages(includeSystem) ?? Promise.resolve([]),
  getPackage: (packageName: string) =>
    GrabbyNative?.getPackage(packageName) ?? Promise.resolve(null),
  getAppIcon: (packageName: string, size = 144) =>
    GrabbyNative?.getAppIcon(packageName, size) ?? Promise.resolve(null),
  getApkInfo: (path: string) => GrabbyNative?.getApkInfo(path) ?? Promise.resolve(null),
  openApp: (packageName: string) => GrabbyNative?.openApp(packageName) ?? false,

  enqueueDownload: (request: DownloadRequest) => GrabbyNative?.enqueueDownload(request) ?? null,
  pauseDownload: (id: string) => GrabbyNative?.pauseDownload(id),
  cancelDownload: (id: string, fileName: string) => GrabbyNative?.cancelDownload(id, fileName),
  getDownloads: (): Promise<NativeDownloadState[]> =>
    GrabbyNative?.getDownloads() ?? Promise.resolve([]),
  deleteApk: (path: string) => GrabbyNative?.deleteApk(path) ?? false,
  getFreeSpace: () => GrabbyNative?.getFreeSpace() ?? Number.POSITIVE_INFINITY,

  canRequestPackageInstalls: () => GrabbyNative?.canRequestPackageInstalls() ?? false,
  installApk: (path: string, downloadId: string) =>
    GrabbyNative?.installApk(path, downloadId) ??
    Promise.reject(new Error('Installer unavailable')),

  openInstallPermissionSettings: () => GrabbyNative?.openInstallPermissionSettings(),
  openNotificationSettings: (channelId: string | null = null) =>
    GrabbyNative?.openNotificationSettings(channelId),
  isIgnoringBatteryOptimizations: () => GrabbyNative?.isIgnoringBatteryOptimizations() ?? true,
  openBatteryOptimizationSettings: () => GrabbyNative?.openBatteryOptimizationSettings(),
  ensureChannels: () => GrabbyNative?.ensureChannels(),
  /** "wifi" = unmetered. Unknown without the module: assume Wi‑Fi so nothing is held back. */
  getNetworkType: (): NetworkType => GrabbyNative?.getNetworkType() ?? 'wifi',
  getCookies: (url: string) => GrabbyNative?.getCookies(url) ?? null,
  clearCookies: () => GrabbyNative?.clearCookies() ?? Promise.resolve(false),

  addListener<E extends keyof GrabbyNativeEvents>(event: E, listener: GrabbyNativeEvents[E]) {
    return GrabbyNative?.addListener(event, listener) ?? { remove() {} };
  },
};

/** The phone's ABIs, best first ("arm64-v8a", "armeabi-v7a", …). */
export function deviceAbis(): string[] {
  return Device.supportedCpuArchitectures ?? [];
}
