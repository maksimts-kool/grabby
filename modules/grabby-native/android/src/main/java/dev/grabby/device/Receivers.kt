package dev.grabby.device

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import androidx.core.content.IntentCompat
import androidx.core.os.bundleOf
import androidx.work.WorkManager

/** "Pause" on the progress notification: remember the pause, then stop the job (the partial file stays). */
class DownloadActionReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION_PAUSE = "dev.grabby.device.PAUSE_DOWNLOAD"
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_PAUSE) return
    val id = intent.getStringExtra(DownloadWorker.KEY_ID) ?: return
    DownloadWorker.markPaused(context, id, true)
    WorkManager.getInstance(context).cancelUniqueWork(DownloadWorker.uniqueName(id))
  }
}

/**
 * Result of a PackageInstaller session. Android always asks the user to confirm an install
 * from Grabby: STATUS_PENDING_USER_ACTION carries the system dialog, which is started here.
 */
class InstallResultReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION = "dev.grabby.device.INSTALL_STATUS"
    const val EXTRA_DOWNLOAD_ID = "downloadId"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val sessionId = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)
    val downloadId = intent.getStringExtra(EXTRA_DOWNLOAD_ID) ?: ""
    val packageName = intent.getStringExtra(PackageInstaller.EXTRA_PACKAGE_NAME) ?: ""
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""

    val result = when (status) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        IntentCompat.getParcelableExtra(intent, Intent.EXTRA_INTENT, Intent::class.java)?.let { confirm ->
          confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          try {
            context.startActivity(confirm)
          } catch (e: Exception) {
            Bus.emit(Bus.INSTALL_STATUS, bundleOf("downloadId" to downloadId, "sessionId" to sessionId, "status" to "failure", "packageName" to packageName, "message" to (e.message ?: "")))
            return
          }
        }
        "pending-user"
      }
      PackageInstaller.STATUS_SUCCESS -> "success"
      PackageInstaller.STATUS_FAILURE_ABORTED -> "aborted"
      PackageInstaller.STATUS_FAILURE_STORAGE -> "storage"
      PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "incompatible"
      PackageInstaller.STATUS_FAILURE_CONFLICT -> "conflict"
      PackageInstaller.STATUS_FAILURE_INVALID -> "invalid"
      PackageInstaller.STATUS_FAILURE_BLOCKED -> "blocked"
      else -> "failure"
    }
    Bus.emit(
      Bus.INSTALL_STATUS,
      bundleOf("downloadId" to downloadId, "sessionId" to sessionId, "status" to result, "packageName" to packageName, "message" to message),
    )
  }
}
