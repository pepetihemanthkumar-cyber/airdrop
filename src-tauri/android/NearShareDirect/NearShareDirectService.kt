package com.nearshare.direct

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * NearShare Android Direct Foreground Service
 *
 * Ensures off-grid Wi-Fi Direct file transfers continue uninterrupted
 * when the application is minimized or backgrounded.
 */
class NearShareDirectService : Service() {

    companion object {
        const val CHANNEL_ID = "nearshare_direct_transfer_channel"
        const val NOTIFICATION_ID = 53319
        const val ACTION_START_TRANSFER = "com.nearshare.direct.START_TRANSFER"
        const val ACTION_STOP_TRANSFER = "com.nearshare.direct.STOP_TRANSFER"

        fun start(context: Context, peerName: String) {
            val intent = Intent(context, NearShareDirectService::class.java).apply {
                action = ACTION_START_TRANSFER
                putExtra("peerName", peerName)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, NearShareDirectService::class.java).apply {
                action = ACTION_STOP_TRANSFER
            }
            context.stopService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_START_TRANSFER) {
            val peerName = intent.getStringExtra("peerName") ?: "Nearby Device"
            val notification = buildNotification(peerName)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                } else {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                }
                startForeground(NOTIFICATION_ID, notification, serviceType)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } else if (action == ACTION_STOP_TRANSFER) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "NearShare Direct Transfer",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active off-grid peer-to-peer file transfer"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(peerName: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("NearShare Direct Transfer")
            .setContentText("Transferring with $peerName")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .build()
    }
}
