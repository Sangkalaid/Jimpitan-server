package id.kelurahan.bener.ronda

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.*
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import java.util.concurrent.Executor

class MainActivity : AppCompatActivity() {

    fun deliverNative(callback: String, value: Any) {
        val json = if (value is Boolean) value.toString() else org.json.JSONObject.quote(value.toString())
        webView.post {
            webView.evaluateJavascript("if (typeof window.$callback === 'function') window.$callback($json);", null)
        }
    }

    private lateinit var webView: WebView
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var geolocationCallback: GeolocationPermissions.Callback? = null
    private var geolocationOrigin: String? = null
    private var pendingNotificationAction: (() -> Unit)? = null

    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var promptInfo: BiometricPrompt.PromptInfo

    // File / Camera Chooser Launcher for Profile Avatar
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val uri = result.data?.data
            if (uri != null) {
                fileUploadCallback?.onReceiveValue(arrayOf(uri))
            } else {
                fileUploadCallback?.onReceiveValue(null)
            }
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true
        geolocationCallback?.invoke(geolocationOrigin, granted, false)
        geolocationCallback = null
        geolocationOrigin = null
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) pendingNotificationAction?.invoke()
        pendingNotificationAction = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Root container
        val rootLayout = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(webView)
        setContentView(rootLayout)

        // Setup Biometric Prompt
        setupBiometrics()

        // Setup WebView
        setupWebView()

        // Setup Android Hardware Back Button navigation
        setupBackNavigation()

        // Load offline web app assets
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        // Register the Android Bridge Interface
        webView.addJavascriptInterface(AndroidBridge(this), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                return request?.url?.let(assetLoader::shouldInterceptRequest)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (uri.scheme == "https" && uri.host == "appassets.androidplatform.net") {
                    return false
                }

                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: Exception) {
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (origin?.trimEnd('/') != "https://appassets.androidplatform.net") {
                    callback?.invoke(origin, false, false)
                    return
                }
                val granted = ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                if (granted) {
                    callback?.invoke(origin, true, false)
                } else {
                    geolocationOrigin = origin
                    geolocationCallback = callback
                    locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                }
            }

            // Native Android Image / Camera Chooser for Avatar Profile
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
                fileChooserLauncher.launch(Intent.createChooser(intent, "Pilih Foto Profil"))
                return true
            }
        }
    }

    private fun setupBiometrics() {
        executor = ContextCompat.getMainExecutor(this)
        biometricPrompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                webView.post {
                    webView.evaluateJavascript(
                        "if (typeof window._biometricCallback === 'function') { window._biometricCallback(true); }",
                        null
                    )
                }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                webView.post {
                    webView.evaluateJavascript(
                        "if (typeof window._biometricCallback === 'function') { window._biometricCallback(false); }",
                        null
                    )
                }
            }
        })

        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.biometric_prompt_title))
            .setSubtitle(getString(R.string.biometric_prompt_subtitle))
            .setDescription(getString(R.string.biometric_prompt_description))
            .setNegativeButtonText(getString(R.string.biometric_prompt_cancel))
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK)
            .build()
    }

    fun launchBiometricPrompt() {
        val biometricManager = BiometricManager.from(this)
        when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                biometricPrompt.authenticate(promptInfo)
            }
            else -> {
                webView.post {
                    webView.evaluateJavascript(
                        "if (typeof window._biometricCallback === 'function') { window._biometricCallback(false); }",
                        null
                    )
                }
            }
        }
    }

    fun runWithNotificationPermission(action: () -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        ) {
            action()
        } else {
            pendingNotificationAction = action
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Check if any sheet modal is open in web view
                webView.evaluateJavascript(
                    "(function() { " +
                    "  const openModal = document.querySelector('.fixed.inset-0.flex'); " +
                    "  if (openModal) { openModal.click(); return true; } " +
                    "  if (typeof currentScreenId !== 'undefined' && currentScreenId === 'screenDashboard') { " +
                    "    navigateToScreen('screenLogin'); return true; " +
                    "  } " +
                    "  return false; " +
                    "})()",
                ) { result ->
                    if (result != "true") {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            finish()
                        }
                    }
                }
            }
        })
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("AndroidBridge")
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }
}
