package dev.grabby.device

import android.os.Bundle
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Hands events from the download worker and the install receiver to the JS module.
 * When the app isn't running nobody listens; JS reconciles with getDownloads() on start.
 */
object Bus {
  fun interface Listener {
    fun onEvent(name: String, body: Bundle)
  }

  private val listeners = CopyOnWriteArraySet<Listener>()

  fun add(listener: Listener) = listeners.add(listener)
  fun remove(listener: Listener) = listeners.remove(listener)

  fun emit(name: String, body: Bundle) {
    for (l in listeners) l.onEvent(name, body)
  }

  const val DOWNLOAD_PROGRESS = "onDownloadProgress"
  const val DOWNLOAD_COMPLETE = "onDownloadComplete"
  const val DOWNLOAD_FAILED = "onDownloadFailed"
  const val DOWNLOAD_PAUSED = "onDownloadPaused"
  const val INSTALL_STATUS = "onInstallStatus"
}
