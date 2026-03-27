package com.famille.dieulgandet;

import android.Manifest;
import android.database.Cursor;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "SmsPlugin",
    permissions = {
        @Permission(
            alias = "readSms",
            strings = { Manifest.permission.READ_SMS }
        )
    }
)
public class SmsPlugin extends Plugin {

    @PluginMethod
    public void getSMSList(PluginCall call) {
        if (getPermissionState("readSms") != PermissionState.GRANTED) {
            requestPermissionForAlias("readSms", call, "readSmsCallback");
        } else {
            readSMS(call);
        }
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("readSms", getPermissionState("readSms").toString().toLowerCase());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestPermissionForAlias("readSms", call, "readSmsCallback");
    }

    @PermissionCallback
    private void readSmsCallback(PluginCall call) {
        if (getPermissionState("readSms") == PermissionState.GRANTED) {
            readSMS(call);
        } else {
            call.reject("Permission SMS refusee par l utilisateur");
        }
    }

    private void readSMS(PluginCall call) {
        JSArray messages = new JSArray();
        try {
            int count = call.getInt("count", 500);
            Uri uri = Uri.parse("content://sms/inbox");
            String[] cols = { "_id", "address", "body", "date" };
            Cursor c = getContext().getContentResolver().query(
                uri, cols, null, null, "date DESC LIMIT " + count
            );
            if (c != null) {
                while (c.moveToNext()) {
                    JSObject m = new JSObject();
                    m.put("id",      c.getString(c.getColumnIndexOrThrow("_id")));
                    m.put("address", c.getString(c.getColumnIndexOrThrow("address")));
                    m.put("body",    c.getString(c.getColumnIndexOrThrow("body")));
                    m.put("date",    c.getLong(c.getColumnIndexOrThrow("date")));
                    messages.put(m);
                }
                c.close();
            }
        } catch (Exception e) {
            call.reject("Erreur lecture SMS: " + e.getMessage());
            return;
        }
        JSObject result = new JSObject();
        result.put("messages", messages);
        call.resolve(result);
    }
}
