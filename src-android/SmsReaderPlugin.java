package com.famille.dieulgandet;

import android.Manifest;
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

@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(alias = "readSms", strings = { Manifest.permission.READ_SMS })
    }
)
public class SmsReaderPlugin extends Plugin {

    private static final String[] KEYWORDS = {
        "chronopost", "colissimo", "mondial relay", "la poste", "colis",
        "vinted", "amazon", "amzn", "dpd", "ups", "relais", "locker",
        "consigne", "retrait", "livraison", "disponible"
    };

    @PluginMethod
    public void getSMS(PluginCall call) {
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
            call.reject("Permission SMS refusee");
        }
    }

    private void readAndReturn(PluginCall call) {
        int days = call.getInt("days", 90);
        long since = System.currentTimeMillis() - (long) days * 24L * 60L * 60L * 1000L;
        JSArray messages = new JSArray();
        try {
            Cursor cursor = getContext().getContentResolver().query(
                Uri.parse("content://sms/inbox"),
                new String[]{ "address", "body", "date" },
                "date > ?",
                new String[]{ String.valueOf(since) },
                "date DESC"
            );
            if (cursor != null) {
                int cAddr = cursor.getColumnIndex("address");
                int cBody = cursor.getColumnIndex("body");
                int cDate = cursor.getColumnIndex("date");
                while (cursor.moveToNext()) {
                    String body = cursor.getString(cBody);
                    String addr = cursor.getString(cAddr);
                    String date = cursor.getString(cDate);
                    if (body != null && isCarrierSMS(body, addr)) {
                        JSObject msg = new JSObject();
                        msg.put("address", addr != null ? addr : "");
                        msg.put("body", body);
                        msg.put("date", date != null ? date : "0");
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

    private boolean isCarrierSMS(String body, String addr) {
        String text = (body + " " + (addr != null ? addr : "")).toLowerCase();
        for (String k : KEYWORDS) {
            if (text.contains(k)) return true;
        }
        return false;
    }
}
