package id.kelurahan.bener.ronda

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.app.NotificationCompat

class AndroidBridge(private val activity: MainActivity) {
    private val secureStore = SecureStore(activity)

    @JavascriptInterface fun deviceId(): String = secureStore.deviceId()
    @JavascriptInterface fun readSession(): String = secureStore.readSession()
    @JavascriptInterface fun writeSession(token: String) = secureStore.writeSession(token)
    @JavascriptInterface fun enrollBiometric(credential: String) {
        activity.runOnUiThread { secureStore.biometric(credential) }
    }
    @JavascriptInterface fun unlockBiometric() {
        activity.runOnUiThread { secureStore.biometric() }
    }

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    /**
     * Haptic Vibration Feedback for Patrol Checkpoints & Button Actions
     */
    @JavascriptInterface
    fun vibrate(milliseconds: Long) {
        activity.runOnUiThread {
            try {
                val ms = if (milliseconds <= 0) 40L else milliseconds
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(ms)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Native Android Biometric Prompt
     */
    @JavascriptInterface
    fun authenticateBiometric() {
        activity.runOnUiThread {
            activity.launchBiometricPrompt()
        }
    }

    /**
     * Share Report to WhatsApp Group RT 01
     */
    @JavascriptInterface
    fun shareWhatsApp(phoneNumber: String, message: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse("https://api.whatsapp.com/send?text=" + Uri.encode(message))
                    `package` = "com.whatsapp"
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                // If WhatsApp app is not installed, fallback to general chooser
                shareReport(message)
            }
        }
    }

    /**
     * Standard Android Share Sheet
     */
    @JavascriptInterface
    fun shareReport(text: String) {
        activity.runOnUiThread {
            val sendIntent: Intent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_TEXT, text)
                type = "text/plain"
            }
            val shareIntent = Intent.createChooser(sendIntent, "Bagikan Laporan Ronda RT 01")
            activity.startActivity(shareIntent)
        }
    }

    /**
     * Native Android Toast
     */
    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Native Android Push Notification (e.g. for Citizen Approval or Completed Shift)
     */
    @JavascriptInterface
    fun sendNotification(title: String, message: String) {
        activity.runOnUiThread {
            activity.runWithNotificationPermission {
              try {
                val channelId = "ronda_patrol_channel"
                val notificationManager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val channel = NotificationChannel(
                        channelId,
                        "Notifikasi Ronda & Jimpitan",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Pembaruan patroli ronda malam dan status verifikasi warga"
                    }
                    notificationManager.createNotificationChannel(channel)
                }

                val notification = NotificationCompat.Builder(activity, channelId)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .build()

                notificationManager.notify(System.currentTimeMillis().toInt(), notification)
              } catch (e: Exception) {
                  e.printStackTrace()
              }
            }
        }
    }

    /**
     * Exit Application
     */
    @JavascriptInterface
    fun exitApp() {
        activity.runOnUiThread {
            activity.finish()
        }
    }
}
