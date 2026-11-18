package dev.grabby.device

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.CookieManager
import androidx.core.content.pm.PackageInfoCompat
import androidx.core.graphics.drawable.toBitmap
import androidx.core.os.bundleOf
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class DownloadRequest : Record {
  @Field val id: String = ""
  @Field val url: String = ""
  @Field val fileName: String = ""
  @Field val title: String = ""
  @Field val installedVersion: String? = null
  @Field val wifiOnly: Boolean = true
  @Field val userAgent: String = "Grabby"
}

class InstallPermissionException : CodedException("ERR_INSTALL_PERMISSION", "Android blocks installs from Grabby until you allow it", null)
class SplitApkException : CodedException("ERR_SPLIT_APK", "Split APK bundles aren't supported yet", null)
class MissingFileException : CodedException("ERR_FILE_MISSING", "The downloaded file is gone", null)

/**
 * Everything Grabby needs from Android that Expo doesn't cover:
 * installed packages and their icons (PackageManager), APK downloads that outlive the app
 * (WorkManager), installs (PackageInstaller), and the system settings pages that unblock them.
 */
class GrabbyNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val busListener = Bus.Listener { name, body -> sendEvent(name, body) }

  override fun definition() = ModuleDefinition {
    Name("GrabbyNative")

    Events(Bus.DOWNLOAD_PROGRESS, Bus.DOWNLOAD_COMPLETE, Bus.DOWNLOAD_FAILED, Bus.DOWNLOAD_PAUSED, Bus.INSTALL_STATUS)

    OnStartObserving { Bus.add(busListener) }
    OnStopObserving { Bus.remove(busListener) }
    OnDestroy { Bus.remove(busListener) }

    Constant("apkDirectory") { DownloadWorker.dir(context).absolutePath }

    // region Packages
    AsyncFunction("getInstalledPackages") Coroutine { includeSystem: Boolean ->
      withContext(Dispatchers.IO) {
        val pm = context.packageManager
        installedPackages(pm)
          .filter { includeSystem || !it.isSystemOnly() }
          .map { it.toBundle(pm) }
      }
    }

    AsyncFunction("getPackage") Coroutine { packageName: String ->
      withContext(Dispatchers.IO) {
        val pm = context.packageManager
        packageInfo(pm, packageName)?.toBundle(pm)
      }
    }

    /** Renders the launcher icon to a PNG in the cache and returns its file:// URI. */
    AsyncFunction("getAppIcon") Coroutine { packageName: String, size: Int ->
      withContext(Dispatchers.IO) {
        val pm = context.packageManager
        val info = packageInfo(pm, packageName) ?: return@withContext null
        val dir = File(context.cacheDir, "icons").apply { mkdirs() }
        val file = File(dir, "$packageName-${PackageInfoCompat.getLongVersionCode(info)}-$size.png")
        if (!file.exists()) {
          val appInfo = info.applicationInfo ?: return@withContext null
          val bitmap = appInfo.loadIcon(pm).toBitmap(size, size, Bitmap.Config.ARGB_8888)
          FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
        Uri.fromFile(file).toString()
      }
    }

    /** Package name and version inside a downloaded APK, before installing it. */
    AsyncFunction("getApkInfo") Coroutine { path: String ->
      withContext(Dispatchers.IO) {
        val pm = context.packageManager
        val info = archiveInfo(pm, path) ?: return@withContext null
        info.applicationInfo?.apply {
          sourceDir = path
          publicSourceDir = path
        }
        info.toBundle(pm)
      }
    }

    /** Android's own uninstall confirmation for an installed app. False when it can't open. */
    Function("uninstallApp") { packageName: String ->
      val intent = Intent(Intent.ACTION_DELETE, Uri.parse("package:$packageName"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    Function("openApp") { packageName: String ->
      val intent = context.packageManager.getLaunchIntentForPackage(packageName) ?: return@Function false
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }
    // endregion

    // region Downloads
    Function("enqueueDownload") { request: DownloadRequest ->
      enqueue(request)
    }

    Function("pauseDownload") { id: String ->
      DownloadWorker.markPaused(context, id, true)
      WorkManager.getInstance(context).cancelUniqueWork(DownloadWorker.uniqueName(id))
    }

    /** Stops the job and deletes the partial file. */
    Function("cancelDownload") { id: String, fileName: String ->
      DownloadWorker.markPaused(context, id, false)
      WorkManager.getInstance(context).cancelUniqueWork(DownloadWorker.uniqueName(id))
      File(DownloadWorker.dir(context), "$fileName.part").delete()
    }

    /** State of every download job WorkManager knows about, for reconciling after a restart. */
    AsyncFunction("getDownloads") Coroutine { ->
      withContext(Dispatchers.IO) {
        WorkManager.getInstance(context).getWorkInfosByTag(DownloadWorker.TAG).get().mapNotNull { it.toBundle() }
      }
    }

    Function("deleteApk") { path: String ->
      val file = File(path).canonicalFile
      val dir = DownloadWorker.dir(context).canonicalFile
      if (file.parentFile == dir && file.exists()) file.delete() else false
    }

    Function("getFreeSpace") { DownloadWorker.dir(context).usableSpace.toDouble() }
    // endregion

    // region Install
    Function("canRequestPackageInstalls") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()
    }

    /** Starts a PackageInstaller session; progress comes back as onInstallStatus events. */
    AsyncFunction("installApk") Coroutine { path: String, downloadId: String ->
      withContext(Dispatchers.IO) { install(path, downloadId) }
    }
    // endregion

    // region System settings
    Function("openInstallPermissionSettings") {
      startSettings(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")))
    }

    Function("openNotificationSettings") { channelId: String? ->
      val intent = if (channelId != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_CHANNEL_ID, channelId)
      } else {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      }
      startSettings(intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
    }

    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("openBatteryOptimizationSettings") {
      startSettings(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}")),
        fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
      )
    }

    Function("ensureChannels") { Channels.ensure(context) }

    // region Cookies
    /** The WebView cookie jar, shared with fetch and the download worker. */
    Function("getCookies") { url: String ->
      CookieManager.getInstance().getCookie(url)
    }

    AsyncFunction("clearCookies") { promise: Promise ->
      val manager = CookieManager.getInstance()
      manager.removeAllCookies { removed ->
        manager.flush()
        promise.resolve(removed)
      }
    }
    // endregion

    /** "wifi" means unmetered (what WorkManager's Wi‑Fi-only constraint waits for). */
    Function("getNetworkType") {
      val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val caps = cm.getNetworkCapabilities(cm.activeNetwork)
      when {
        caps == null || !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) -> "none"
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) -> "wifi"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
        else -> "other"
      }
    }
    // endregion
  }

  private fun startSettings(intent: Intent, fallback: Intent? = null) {
    val activity = appContext.currentActivity
    val launch = { i: Intent ->
      if (activity != null) activity.startActivity(i) else context.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    try {
      launch(intent)
    } catch (e: Exception) {
      launch(fallback ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }
  }

  private fun enqueue(r: DownloadRequest): String {
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(if (r.wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED)
      .setRequiresStorageNotLow(true)
      .build()
    val request = OneTimeWorkRequestBuilder<DownloadWorker>()
      .setConstraints(constraints)
      .setInputData(
        workDataOf(
          DownloadWorker.KEY_ID to r.id,
          DownloadWorker.KEY_URL to r.url,
          DownloadWorker.KEY_FILE to r.fileName,
          DownloadWorker.KEY_TITLE to r.title,
          DownloadWorker.KEY_INSTALLED to r.installedVersion,
          DownloadWorker.KEY_UA to r.userAgent,
        ),
      )
      .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
      .addTag(DownloadWorker.TAG)
      .addTag(DownloadWorker.idTag(r.id))
      .build()
    // At most two downloads run at once: the JS queue only enqueues the next when one ends.
    WorkManager.getInstance(context).enqueueUniqueWork(DownloadWorker.uniqueName(r.id), ExistingWorkPolicy.REPLACE, request)
    return request.id.toString()
  }

  private fun install(path: String, downloadId: String): Int {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
      throw InstallPermissionException()
    }
    if (!path.endsWith(".apk", ignoreCase = true)) throw SplitApkException()
    val file = File(path)
    if (!file.exists()) throw MissingFileException()

    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
      setSize(file.length())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
      }
    }
    val sessionId = installer.createSession(params)
    installer.openSession(sessionId).use { session ->
      file.inputStream().use { input ->
        session.openWrite("base.apk", 0, file.length()).use { out ->
          input.copyTo(out, 64 * 1024)
          session.fsync(out)
        }
      }
      val callback = Intent(context, InstallResultReceiver::class.java)
        .setAction(InstallResultReceiver.ACTION)
        .setPackage(context.packageName)
        .putExtra(InstallResultReceiver.EXTRA_DOWNLOAD_ID, downloadId)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
      val pending = PendingIntent.getBroadcast(context, sessionId, callback, flags)
      session.commit(pending.intentSender)
    }
    return sessionId
  }

  // region PackageManager helpers
  @Suppress("DEPRECATION")
  private fun installedPackages(pm: PackageManager): List<PackageInfo> =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(0))
    } else {
      pm.getInstalledPackages(0)
    }

  @Suppress("DEPRECATION")
  private fun packageInfo(pm: PackageManager, packageName: String): PackageInfo? = try {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
    } else {
      pm.getPackageInfo(packageName, 0)
    }
  } catch (e: PackageManager.NameNotFoundException) {
    null
  }

  @Suppress("DEPRECATION")
  private fun archiveInfo(pm: PackageManager, path: String): PackageInfo? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.getPackageArchiveInfo(path, PackageManager.PackageInfoFlags.of(0))
    } else {
      pm.getPackageArchiveInfo(path, 0)
    }

  /** System apps nobody updated: not something a 4PDA topic would replace. */
  private fun PackageInfo.isSystemOnly(): Boolean {
    val flags = applicationInfo?.flags ?: 0
    return flags and ApplicationInfo.FLAG_SYSTEM != 0 && flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP == 0
  }

  private fun PackageInfo.toBundle(pm: PackageManager): Bundle = bundleOf(
    "packageName" to packageName,
    "label" to (applicationInfo?.loadLabel(pm)?.toString() ?: packageName),
    "versionName" to versionName,
    "versionCode" to PackageInfoCompat.getLongVersionCode(this).toDouble(),
    "firstInstallTime" to firstInstallTime.toDouble(),
    "lastUpdateTime" to lastUpdateTime.toDouble(),
    "isSystem" to ((applicationInfo?.flags ?: 0) and ApplicationInfo.FLAG_SYSTEM != 0),
  )
  // endregion

  private fun WorkInfo.toBundle(): Bundle? {
    val downloadId = tags.firstOrNull { it.startsWith("id:") }?.removePrefix("id:") ?: return null
    val data = if (state.isFinished) outputData else progress
    return bundleOf(
      "id" to downloadId,
      "workId" to id.toString(),
      "state" to state.name.lowercase(),
      "bytesDone" to data.getLong(DownloadWorker.KEY_DONE, 0L).toDouble(),
      "bytesTotal" to data.getLong(DownloadWorker.KEY_TOTAL, -1L).toDouble(),
      "path" to outputData.getString(DownloadWorker.KEY_PATH),
      "error" to outputData.getString(DownloadWorker.KEY_ERROR),
      "paused" to DownloadWorker.isPaused(context, downloadId),
      "attempts" to runAttemptCount,
    )
  }
}
