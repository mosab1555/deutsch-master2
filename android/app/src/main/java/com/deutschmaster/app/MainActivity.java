package com.deutschmaster.app;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
  private TextToSpeech tts;
  private float pendingRate = 1.0f;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    try {
      tts = new TextToSpeech(this, status -> {
        if (status == TextToSpeech.SUCCESS) {
          try {
            int r = tts.setLanguage(Locale.GERMANY);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
              try { tts.setLanguage(new Locale("de", "DE")); } catch (Exception ignored) {}
            }
            try { tts.setSpeechRate(pendingRate); } catch (Exception ignored) {}
          } catch (Exception ignored) {}
        }
      });
    } catch (Exception ignored) {}
    try {
      bridge.getWebView().addJavascriptInterface(new TTSBridge(), "AndroidTTS");
    } catch (Exception ignored) {}
  }

  class TTSBridge {
    @JavascriptInterface
    public void speak(final String text) {
      speakInternal(text);
    }

    @JavascriptInterface
    public void stop() {
      try {
        if (tts != null) tts.stop();
      } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void setRate(final float rate) {
      try {
        pendingRate = (rate > 0 && rate <= 2) ? rate : 1.0f;
        if (tts != null) tts.setSpeechRate(pendingRate);
      } catch (Exception ignored) {}
    }
  }

  private void speakInternal(final String text) {
    try {
      if (tts == null || text == null) return;
      final String t = text.trim();
      if (t.isEmpty()) return;
      runOnUiThread(() -> {
        try {
          tts.stop();
          try { tts.setSpeechRate(pendingRate); } catch (Exception ignored) {}
          try { tts.setLanguage(Locale.GERMANY); } catch (Exception ignored) {}
          tts.speak(t, TextToSpeech.QUEUE_FLUSH, null, "deutsch-master-" + System.currentTimeMillis());
        } catch (Exception ignored) {}
      });
    } catch (Exception ignored) {}
  }

  @Override
  public void onDestroy() {
    try {
      if (tts != null) { try { tts.stop(); } catch (Exception ignored) {} try { tts.shutdown(); } catch (Exception ignored) {} }
    } catch (Exception ignored) {}
    super.onDestroy();
  }
}
