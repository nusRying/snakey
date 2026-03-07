package com.umair.snakey.game;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class SnakeyFirebaseMessagingService extends FirebaseMessagingService {
    private static final AtomicInteger NOTIFICATION_IDS = new AtomicInteger(4000);

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        FirebaseBridgeStore.savePushToken(getApplicationContext(), token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        ensureNotificationChannel(getApplicationContext());

        String title = "Snakey IO";
        String body = "A new arena update is ready.";

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (remoteMessage.getNotification().getBody() != null) {
                body = remoteMessage.getNotification().getBody();
            }
        }

        Map<String, String> data = remoteMessage.getData();
        if (data.containsKey("title")) {
            title = data.get("title");
        }
        if (data.containsKey("body")) {
            body = data.get("body");
        }

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = null;
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            contentIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, getString(R.string.push_notification_channel_id))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH);

        if (contentIntent != null) {
            builder.setContentIntent(contentIntent);
        }

        NotificationManagerCompat.from(this).notify(NOTIFICATION_IDS.incrementAndGet(), builder.build());
    }

    static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context == null) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            context.getString(R.string.push_notification_channel_id),
            context.getString(R.string.push_notification_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Live updates, arena alerts, and important account notifications.");
        manager.createNotificationChannel(channel);
    }
}