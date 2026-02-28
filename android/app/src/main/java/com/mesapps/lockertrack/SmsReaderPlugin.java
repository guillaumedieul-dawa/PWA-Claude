package com.mesapps.lockertrack;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

/**
 * Plugin Capacitor natif pour lire les SMS Android.
 * Aucune dépendance npm — code Java pur.
 * Appelé depuis JS via : window.Capacitor.Plugins.SmsReader.getSMS(...)
 */
@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(
            alias = "readSms",
            strings = { Manifest.permission.READ_SMS }
        )
    }
)
public class SmsReaderPlugin extends Plugin {

    // Mots-clés transporteurs pour filtrer côté Java (pré-filtre léger)
    private static final String[] CARRIER_KEYWORDS = {
        "chronopost", "colissimo", "mondial relay", "la poste", "colis",
        "vinted", "amazon", "amzn", "dpd", "ups", "relais", "locker",
        "consigne", "retrait", "livr", "expédi", "disponible", "code"
    };

    /**
     * Méthode appelée depuis JS :
     *   const result = await window.Capacitor.Plugins.SmsReader.getSMS({ days: 90 });
     *   // result.messages = [{address, body, date}, ...]
     */
    @PluginMethod
    public void getSMS(PluginCall call) {
        // Vérifier la permission
        if (getPermissionState("readSms") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("readSms", call, "smsPermissionCallback");
            return;
        }
        readAndReturn(call);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("readSms") == com.getcapacitor.PermissionState.GRANTED) {
            readAndReturn(call);
        } else {
            call.reject("Permission SMS refusée");
        }
    }

    private void readAndReturn(PluginCall call) {
        // Durée en jours (défaut 90)
        int days = call.getInt("days", 90);
        long since = System.currentTimeMillis() - (long) days * 24 * 60 * 60 * 1000L;

        JSArray messages = new JSArray();

        try {
            Cursor cursor = getContext().getContentResolver().query(
                Uri.parse("content://sms/inbox"),
                new String[]{"address", "body", "date"},
                "date > ?",
                new String[]{ String.valueOf(since) },
                "date DESC"
            );

            if (cursor != null) {
                int colAddress = cursor.getColumnIndex("address");
                int colBody    = cursor.getColumnIndex("body");
                int colDate    = cursor.getColumnIndex("date");

                while (cursor.moveToNext()) {
                    String body    = cursor.getString(colBody);
                    String address = cursor.getString(colAddress);
                    String date    = cursor.getString(colDate);

                    // Pré-filtre : garder seulement les SMS transporteurs
                    if (body != null && isCarrierSMS(body, address)) {
                        JSObject msg = new JSObject();
                        msg.put("address", address != null ? address : "");
                        msg.put("body",    body);
                        msg.put("date",    date != null ? date : "0");
                        messages.put(msg);
                    }
                }
                cursor.close();
            }

            JSObject result = new JSObject();
            result.put("messages", messages);
            result.put("count", messages.length());
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Erreur lecture SMS : " + e.getMessage());
        }
    }

    private boolean isCarrierSMS(String body, String address) {
        String text = (body + " " + (address != null ? address : "")).toLowerCase();
        for (String keyword : CARRIER_KEYWORDS) {
            if (text.contains(keyword)) return true;
        }
        return false;
    }
}
