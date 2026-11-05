package io.inspexo.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        convertirPartage(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        convertirPartage(intent);
        super.onNewIntent(intent);
    }

    /**
     * Partage ACTION_SEND depuis l'appli Leboncoin / La Centrale : le texte
     * partagé contient l'URL de l'annonce. On le convertit en lien profond
     * inspexo://partage?url=… que Capacitor remonte au web (appUrlOpen) —
     * l'annonce est ensuite lue dans une WebView SUR le téléphone.
     */
    private void convertirPartage(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String texte = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (texte == null) return;
        Matcher m = Pattern.compile("https://\\S+").matcher(texte);
        if (!m.find()) return;
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("inspexo://partage?url=" + Uri.encode(m.group())));
    }
}
