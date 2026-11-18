package dev.grabby.device

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/**
 * The four notification channels, so each can be muted on its own in system settings.
 * JS creates them too (expo-notifications) with the same ids; whoever runs first wins,
 * and creating an existing channel is a no-op.
 */
object Channels {
  const val UPDATES = "updates"
  const val DOWNLOADS = "downloads"
  const val READY = "ready"
  const val PROBLEMS = "problems"

  fun ensure(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    val channels = listOf(
      NotificationChannel(UPDATES, "New versions", NotificationManager.IMPORTANCE_DEFAULT),
      NotificationChannel(DOWNLOADS, "Downloads in progress", NotificationManager.IMPORTANCE_LOW).apply {
        setShowBadge(false)
      },
      NotificationChannel(READY, "Ready to install", NotificationManager.IMPORTANCE_HIGH),
      NotificationChannel(PROBLEMS, "Problems", NotificationManager.IMPORTANCE_DEFAULT),
    )
    for (c in channels) if (nm.getNotificationChannel(c.id) == null) nm.createNotificationChannel(c)
  }
}
