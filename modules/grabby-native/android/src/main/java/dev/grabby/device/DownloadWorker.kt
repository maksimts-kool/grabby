package dev.grabby.device

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.os.bundleOf
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipFile
import kotlin.math.roundToInt

/**
 * Downloads one APK from 4PDA into the app's external files dir (Android/data/<pkg>/files/apks),
 * as a WorkManager job so it survives the app being closed. Resumes a partial file with a
 * Range request. Sends the 4PDA session cookie the WebView sign-in left in CookieManager.
 *
 * 4PDA answers a download without a session with an HTML page instead of the file; that,
 * and any other non-APK response, fails with a code the app turns into a sentence:
 * sign-in, gone, storage, network, corrupt.
 *
 * Some posts attach the APK inside a .zip ("apk в архиве"); the APK is extracted next to it
 * and the archive deleted, so the rest of the app only ever sees an .apk.
 */
class DownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

  companion object {
    const val TAG = "grabby-download"
    const val KEY_ID = "id"
    const val KEY_URL = "url"
    const val KEY_FILE = "fileName"
    const val KEY_TITLE = "title"
    const val KEY_INSTALLED = "installed"
    const val KEY_UA = "userAgent"
    const val KEY_DONE = "bytesDone"
    const val KEY_TOTAL = "bytesTotal"
    const val KEY_SPEED = "speed"
    const val KEY_PATH = "path"
    const val KEY_ERROR = "error"
    const val KEY_MESSAGE = "message"

    private const val PREFS = "grabby.downloads"
    private const val MAX_REDIRECTS = 5
    private const val PROGRESS_EVERY_MS = 500L

    fun dir(context: Context): File =
      File(context.getExternalFilesDir(null) ?: context.filesDir, "apks").apply { mkdirs() }

    fun uniqueName(id: String) = "download-$id"
    fun idTag(id: String) = "id:$id"

    fun markPaused(context: Context, id: String, paused: Boolean) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
        if (paused) putBoolean(id, true) else remove(id)
      }.apply()
    }

    fun isPaused(context: Context, id: String) =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(id, false)

    fun smallIcon(context: Context): Int {
      val res = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      return if (res != 0) res else android.R.drawable.stat_sys_download
    }

    fun deepLink(context: Context, path: String, requestCode: Int): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("grabby://$path"))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      return PendingIntent.getActivity(
        context, requestCode, intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    }
  }

  private class Failure(val code: String, message: String?) : Exception(message)

  private val downloadId = inputData.getString(KEY_ID) ?: ""
  private val title = inputData.getString(KEY_TITLE) ?: "APK"
  private val notificationId = downloadId.hashCode()
  private var lastNotifyAt = 0L

  override suspend fun getForegroundInfo(): ForegroundInfo = foregroundInfo(0, null, 0.0)

  override suspend fun doWork(): Result {
    if (downloadId.isEmpty()) return Result.failure()
    val url = inputData.getString(KEY_URL) ?: return Result.failure()
    val fileName = (inputData.getString(KEY_FILE) ?: "$downloadId.apk").replace(Regex("[/\\\\]"), "_")
    Channels.ensure(applicationContext)
    markPaused(applicationContext, downloadId, false)
    try {
      setForeground(foregroundInfo(0, null, 0.0))
    } catch (e: Exception) {
      // Android 12+ refuses foreground services started from the background; the job still runs.
    }

    return try {
      val file = withContext(Dispatchers.IO) { download(url, fileName) }
      val total = file.length()
      Bus.emit(Bus.DOWNLOAD_COMPLETE, bundleOf("id" to downloadId, "path" to file.absolutePath, "bytesTotal" to total.toDouble()))
      notifyReady()
      Result.success(workDataOf(KEY_PATH to file.absolutePath, KEY_TOTAL to total))
    } catch (e: CancellationException) {
      if (isPaused(applicationContext, downloadId)) {
        Bus.emit(Bus.DOWNLOAD_PAUSED, bundleOf("id" to downloadId))
      }
      throw e
    } catch (e: Failure) {
      fail(e.code, e.message)
    } catch (e: IOException) {
      if (isStopped) Result.failure() else if (runAttemptCount < 3) Result.retry() else fail("network", e.message)
    } catch (e: SecurityException) {
      fail("unknown", e.message)
    }
  }

  private fun fail(code: String, message: String?): Result {
    Bus.emit(Bus.DOWNLOAD_FAILED, bundleOf("id" to downloadId, "error" to code, "message" to (message ?: "")))
    return Result.failure(workDataOf(KEY_ERROR to code, KEY_MESSAGE to (message ?: "")))
  }

  private suspend fun download(startUrl: String, fileName: String): File {
    val dir = dir(applicationContext)
    val target = File(dir, fileName)
    val part = File(dir, "$fileName.part")
    val ua = inputData.getString(KEY_UA) ?: "Grabby"

    var url = startUrl
    var existing = if (part.exists()) part.length() else 0L
    var conn: HttpURLConnection? = null
    for (hop in 0..MAX_REDIRECTS) {
      val c = (URL(url).openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false
        connectTimeout = 20_000
        readTimeout = 30_000
        setRequestProperty("User-Agent", ua)
        setRequestProperty("Accept", "application/vnd.android.package-archive,*/*")
        CookieManager.getInstance().getCookie(url)?.let { setRequestProperty("Cookie", it) }
        if (existing > 0) setRequestProperty("Range", "bytes=$existing-")
      }
      val code = c.responseCode
      if (code in 300..399) {
        val next = c.getHeaderField("Location") ?: throw Failure("gone", "Redirect without a location")
        url = URL(URL(url), next).toString()
        c.disconnect()
        continue
      }
      conn = c
      break
    }
    val c = conn ?: throw Failure("network", "Too many redirects")

    try {
      val code = c.responseCode
      val type = c.contentType ?: ""
      val hasSession = CookieManager.getInstance().getCookie(startUrl)?.contains("member_id=") == true
      when {
        code == 401 || code == 403 -> throw Failure(if (hasSession) "gone" else "sign-in", "HTTP $code")
        code == 404 || code == 410 -> throw Failure(if (hasSession) "gone" else "sign-in", "HTTP $code")
        code == 416 -> {
          // The partial file is already complete (or stale): start over once.
          part.delete()
          throw IOException("Range not satisfiable")
        }
        code >= 400 -> throw IOException("HTTP $code")
        type.startsWith("text/html") -> throw Failure(if (hasSession) "gone" else "sign-in", "Got a web page instead of the file")
      }
      if (code == 200 && existing > 0) {
        // Server ignored the Range header: start from zero.
        existing = 0
        part.delete()
      }
      val length = c.contentLengthLong
      val total = if (length >= 0) existing + length else null
      if (total != null) {
        val free = dir.usableSpace
        val needed = total - existing + 5L * 1024 * 1024
        if (free < needed) throw Failure("storage", "${needed - free}")
      }

      var done = existing
      var speed = 0.0
      var windowStart = System.currentTimeMillis()
      var windowBytes = 0L
      c.inputStream.use { input ->
        FileOutputStream(part, existing > 0).use { out ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            if (isStopped) throw CancellationException("stopped")
            val n = input.read(buffer)
            if (n < 0) break
            out.write(buffer, 0, n)
            done += n
            windowBytes += n
            val now = System.currentTimeMillis()
            val elapsed = now - windowStart
            if (elapsed >= PROGRESS_EVERY_MS) {
              val instant = windowBytes * 1000.0 / elapsed
              speed = if (speed == 0.0) instant else speed * 0.7 + instant * 0.3
              windowStart = now
              windowBytes = 0
              report(done, total, speed)
            }
          }
          out.fd.sync()
        }
      }
      report(done, total ?: done, 0.0)

      if (!isZip(part)) {
        part.delete()
        throw Failure(if (hasSession) "corrupt" else "sign-in", "Not an APK")
      }
      if (target.exists()) target.delete()
      if (!part.renameTo(target)) throw IOException("Couldn't move the finished file")
      return if (target.name.endsWith(".zip", ignoreCase = true)) extractApk(target) else target
    } finally {
      c.disconnect()
    }
  }

  /**
   * The APK inside a downloaded archive: the largest `.apk` entry (archives hold one build,
   * sometimes beside a readme). Written under its own base name, never the entry's path, so
   * an entry like `../x.apk` can't escape the folder. The archive is deleted afterwards.
   */
  private fun extractApk(zip: File): File {
    try {
      ZipFile(zip).use { archive ->
        val entry = archive.entries().asSequence()
          .filter { !it.isDirectory && it.name.endsWith(".apk", ignoreCase = true) && !it.name.contains("__MACOSX") }
          .maxByOrNull { it.size }
          ?: throw Failure("corrupt", "No APK in the archive")
        val name = entry.name.substringAfterLast('/').replace(Regex("[\\\\:]"), "_")
        val out = File(zip.parentFile, name)
        if (entry.size > 0 && zip.parentFile!!.usableSpace < entry.size + 5L * 1024 * 1024) {
          throw Failure("storage", "${entry.size}")
        }
        val tmp = File(zip.parentFile, "$name.part")
        archive.getInputStream(entry).use { input ->
          FileOutputStream(tmp).use { output -> input.copyTo(output, 64 * 1024); output.fd.sync() }
        }
        if (!isZip(tmp)) {
          tmp.delete()
          throw Failure("corrupt", "The archive's APK is damaged")
        }
        if (out.exists()) out.delete()
        if (!tmp.renameTo(out)) throw IOException("Couldn't move the extracted APK")
        return out
      }
    } catch (e: java.util.zip.ZipException) {
      throw Failure("corrupt", e.message)
    } finally {
      zip.delete()
    }
  }

  private fun isZip(file: File): Boolean = try {
    file.inputStream().use { val b = ByteArray(2); it.read(b) == 2 && b[0] == 'P'.code.toByte() && b[1] == 'K'.code.toByte() }
  } catch (e: IOException) {
    false
  }

  private suspend fun report(done: Long, total: Long?, speed: Double) {
    setProgress(workDataOf(KEY_DONE to done, KEY_TOTAL to (total ?: -1L), KEY_SPEED to speed))
    Bus.emit(
      Bus.DOWNLOAD_PROGRESS,
      bundleOf("id" to downloadId, "bytesDone" to done.toDouble(), "bytesTotal" to (total ?: -1L).toDouble(), "speed" to speed),
    )
    val now = System.currentTimeMillis()
    if (now - lastNotifyAt >= 1000) {
      lastNotifyAt = now
      try {
        setForeground(foregroundInfo(done, total, speed))
      } catch (e: Exception) {
        // Not a foreground job (started from the background): no progress notification.
      }
    }
  }

  private fun foregroundInfo(done: Long, total: Long?, speed: Double): ForegroundInfo {
    val ctx = applicationContext
    val pct = if (total != null && total > 0) (done * 100.0 / total).roundToInt() else 0
    val text = buildString {
      append(formatMb(done))
      if (total != null && total > 0) append(" of ${formatMb(total)}")
      if (speed > 0 && total != null && total > done) {
        val left = ((total - done) / speed).roundToInt()
        append(" · ").append(if (left < 60) "$left s left" else "${(left + 59) / 60} min left")
      }
    }
    val pause = PendingIntent.getBroadcast(
      ctx, notificationId,
      Intent(ctx, DownloadActionReceiver::class.java)
        .setAction(DownloadActionReceiver.ACTION_PAUSE)
        .putExtra(KEY_ID, downloadId),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val cancel = WorkManager.getInstance(ctx).createCancelPendingIntent(id)
    val notification = NotificationCompat.Builder(ctx, Channels.DOWNLOADS)
      .setSmallIcon(smallIcon(ctx))
      .setContentTitle("Downloading $title")
      .setContentText(text)
      .setProgress(100, pct, total == null)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setColor(0xFFC6F046.toInt())
      .setContentIntent(deepLink(ctx, "downloads", notificationId))
      .addAction(0, "Pause", pause)
      .addAction(0, "Cancel", cancel)
      .build()
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ForegroundInfo(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      ForegroundInfo(notificationId, notification)
    }
  }

  /** Channel `ready`: one per file; the tap opens Grabby's install route. */
  private fun notifyReady() {
    val ctx = applicationContext
    val installed = inputData.getString(KEY_INSTALLED)
    val open = deepLink(ctx, "install/$downloadId", notificationId + 1)
    val notification = NotificationCompat.Builder(ctx, Channels.READY)
      .setSmallIcon(smallIcon(ctx))
      .setContentTitle("$title is ready")
      .setContentText(if (installed.isNullOrEmpty()) "Tap to install" else "Tap to install over $installed")
      .setColor(0xFFC6F046.toInt())
      .setAutoCancel(true)
      .setContentIntent(open)
      .addAction(0, "Install", open)
      .build()
    try {
      NotificationManagerCompat.from(ctx).notify(notificationId + 1, notification)
    } catch (e: SecurityException) {
      // Notifications are off; Activity and Downloads still show it.
    }
  }

  private fun formatMb(bytes: Long): String {
    val mb = bytes / (1024.0 * 1024.0)
    return if (mb >= 10) "${mb.roundToInt()} MB" else "${(mb * 10).roundToInt() / 10.0} MB"
  }
}
