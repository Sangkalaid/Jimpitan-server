package id.kelurahan.bener.ronda

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureStore(private val activity: MainActivity) {
    private val prefs = activity.getSharedPreferences("ronda_secure", Context.MODE_PRIVATE)
    private var busy = false

    private fun key(alias: String, biometric: Boolean): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(biometric)
        if (biometric) spec.setInvalidatedByBiometricEnrollment(true)
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(spec.build())
        }.generateKey()
    }

    @Synchronized fun deviceId(): String {
        prefs.getString("device", null)?.let { return it }
        return UUID.randomUUID().toString().also { prefs.edit().putString("device", it).commit() }
    }

    private fun encrypt(cipher: Cipher, value: String): String =
        Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" +
            Base64.encodeToString(cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)

    private fun decryptCipher(alias: String, biometric: Boolean, value: String): Pair<Cipher, ByteArray> {
        val parts = value.split(":", limit = 2)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(alias, biometric), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
        return Pair(cipher, Base64.decode(parts[1], Base64.NO_WRAP))
    }

    fun writeSession(value: String) {
        if (value.isEmpty()) { prefs.edit().remove("session").commit(); return }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key("ronda_session", false))
        prefs.edit().putString("session", encrypt(cipher, value)).commit()
    }

    fun readSession(): String = try {
        val value = prefs.getString("session", null)
        if (value == null) "" else {
            val (cipher, bytes) = decryptCipher("ronda_session", false, value)
            String(cipher.doFinal(bytes), Charsets.UTF_8)
        }
    } catch (_: Exception) { prefs.edit().remove("session").commit(); "" }

    fun biometric(credential: String? = null) {
        if (busy) return
        busy = true
        fun fail() {
            busy = false
            if (credential != null) activity.deliverNative("_biometricStored", false)
            else activity.deliverNative("_biometricCredential", "")
        }
        try {
            if (BiometricManager.from(activity).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) != BiometricManager.BIOMETRIC_SUCCESS) {
                fail(); return
            }
            val cipher: Cipher
            var encrypted: ByteArray? = null
            if (credential != null) {
                // Re-enrollment replaces only this app's biometric key and credential.
                val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
                store.deleteEntry("ronda_biometric")
                prefs.edit().remove("biometric").commit()
                cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.ENCRYPT_MODE, key("ronda_biometric", true))
            } else {
                val value = prefs.getString("biometric", null) ?: run { fail(); return }
                val pair = decryptCipher("ronda_biometric", true, value)
                cipher = pair.first
                encrypted = pair.second
            }
            val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    try {
                        val unlocked = result.cryptoObject?.cipher ?: run { fail(); return }
                        if (credential != null) {
                            prefs.edit().putString("biometric", encrypt(unlocked, credential)).commit()
                            activity.deliverNative("_biometricStored", true)
                        } else {
                            activity.deliverNative("_biometricCredential", String(unlocked.doFinal(encrypted!!), Charsets.UTF_8))
                        }
                        busy = false
                    } catch (_: Exception) { fail() }
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { fail() }
            })
            prompt.authenticate(BiometricPrompt.PromptInfo.Builder()
                .setTitle("Login Sidik Jari")
                .setSubtitle("Ronda & Jimpitan RT 01 / RW 02")
                .setNegativeButtonText("Gunakan PIN")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build(), BiometricPrompt.CryptoObject(cipher))
        } catch (_: Exception) { fail() }
    }
}
