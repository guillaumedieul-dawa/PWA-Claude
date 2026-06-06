package com.famille.dieulgandet;

import android.Manifest;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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
        int count = call.getInt("count", 500);
        Uri uri = Uri.parse("content://sms/inbox");
        String[] cols = { "_id", "address", "body", "date" };

        Cursor c = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Bundle queryArgs = new Bundle();
                queryArgs.putInt(android.content.ContentResolver.QUERY_ARG_LIMIT, count);
                queryArgs.putStringArray(android.content.ContentResolver.QUERY_ARG_SORT_COLUMNS, new String[] { "date" });
                queryArgs.putInt(android.content.ContentResolver.QUERY_ARG_SORT_DIRECTION, android.content.ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);
                c = getContext().getContentResolver().query(uri, cols, queryArgs, null);
            } else {
                c = getContext().getContentResolver().query(uri, cols, null, null, "date DESC LIMIT " + count);
            }

            if (c != null) {
                int idIndex = c.getColumnIndexOrThrow("_id");
                int addressIndex = c.getColumnIndexOrThrow("address");
                int bodyIndex = c.getColumnIndexOrThrow("body");
                int dateIndex = c.getColumnIndexOrThrow("date");

                while (c.moveToNext()) {
                    JSObject m = new JSObject();
                    m.put("id",      c.getString(idIndex));
                    m.put("address", c.getString(addressIndex));
                    m.put("body",    c.getString(bodyIndex));
                    m.put("date",    c.getLong(dateIndex));
                    messages.put(m);
                }
            }
        } catch (Exception e) {
            call.reject("Erreur lecture SMS: " + e.getMessage());
            return;
        } finally {
            if (c != null) {
                c.close();
            }
        }

        JSObject result = new JSObject();
        result.put("messages", messages);
        call.resolve(result);
    }
}
