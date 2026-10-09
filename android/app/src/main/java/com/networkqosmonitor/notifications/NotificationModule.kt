package com.networkqosmonitor.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.networkqosmonitor.MainActivity
import com.networkqosmonitor.R
import java.util.concurrent.atomic.AtomicInteger

class NotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val CHANNEL_ID = "qos_alerts_channel"
        const val CHANNEL_NAME = "Alertas de Calidad de Servicio"
        const val CHANNEL_DESC = "Notificaciones ante degradación severa de red (QoS)"
        private val notificationIdGenerator = AtomicInteger(1000)
    }

    override fun getName(): String = "NotificationModule"

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESC
                enableLights(true)
                lightColor = Color.RED
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 200, 300)
            }

            val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    @ReactMethod
    fun postNotification(title: String, message: String, isWarning: Boolean, promise: Promise) {
        try {
            // Verificar permiso en Android 13+ (API 33+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val hasPermission = ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED

                if (!hasPermission) {
                    promise.reject("PERMISSION_DENIED", "El permiso POST_NOTIFICATIONS no ha sido concedido")
                    return
                }
            }

            // Intent para abrir la app al tocar la notificación
            val intent = Intent(reactContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notificationColor = if (isWarning) Color.parseColor("#DC2626") else Color.parseColor("#4F46E5")

            val notification = NotificationCompat.Builder(reactContext, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setColor(notificationColor)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build()

            val notificationId = notificationIdGenerator.incrementAndGet()
            NotificationManagerCompat.from(reactContext).notify(notificationId, notification)

            promise.resolve(notificationId)
        } catch (e: Exception) {
            promise.reject("NOTIFICATION_ERROR", "Error al emitir notificación: ${e.message}", e)
        }
    }

    @ReactMethod
    fun checkNotificationPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val hasPermission = ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
                promise.resolve(hasPermission)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("CHECK_PERMISSION_ERROR", e.message)
        }
    }
}
