# Project-specific R8 rules. Keep JavaScript bridge methods callable from WebView.
-keepclassmembers class id.kelurahan.bener.ronda.AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
