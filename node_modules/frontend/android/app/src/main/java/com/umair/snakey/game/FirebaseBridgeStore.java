package com.umair.snakey.game;

import android.content.Context;
import android.content.SharedPreferences;

class FirebaseBridgeStore {
    private static final String PREFS_NAME = "snakey.firebase";
    private static final String PREF_PUSH_TOKEN = "push_token";

    private FirebaseBridgeStore() {
    }

    static void savePushToken(Context context, String token) {
        if (context == null || token == null || token.isEmpty()) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_PUSH_TOKEN, token).apply();
    }

    static String getPushToken(Context context) {
        if (context == null) {
            return null;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(PREF_PUSH_TOKEN, null);
    }
}