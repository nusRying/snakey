package com.umair.snakey.game;

import android.Manifest;
import android.os.Build;
import android.os.Bundle;
import android.content.Intent;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.activity.result.ActivityResult;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONException;

import java.util.Iterator;

@CapacitorPlugin(
    name = "GrowthBridge",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class GrowthBridgePlugin extends Plugin {
    private AdView bannerView;
    private InterstitialAd interstitialAd;
    private RewardedAd rewardedAd;

    @PluginMethod
    public void getGoogleAuthUser(PluginCall call) {
        JSObject result = buildGoogleUserPayload(FirebaseAuth.getInstance().getCurrentUser());
        call.resolve(result);
    }

    @PluginMethod
    public void signInWithGoogle(PluginCall call) {
        String webClientId = getWebClientId();
        if (webClientId.isEmpty()) {
            call.reject("Missing default_web_client_id. Regenerate google-services.json after enabling Google Sign-In.");
            return;
        }

        GoogleSignInClient client = GoogleSignIn.getClient(getActivity(), new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()
            .requestIdToken(webClientId)
            .build());

        startActivityForResult(call, client.getSignInIntent(), "handleGoogleSignInResult");
    }

    @PluginMethod
    public void signOutGoogle(PluginCall call) {
        FirebaseAuth.getInstance().signOut();

        GoogleSignInClient client = GoogleSignIn.getClient(getActivity(), new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .build());

        client.signOut().addOnCompleteListener(task -> {
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void logAnalyticsEvent(PluginCall call) {
        String name = sanitizeAnalyticsName(call.getString("name"));
        if (name.isEmpty()) {
            call.reject("Missing analytics event name");
            return;
        }

        JSObject params = call.getObject("params");
        FirebaseAnalytics.getInstance(getContext()).logEvent(name, toBundle(params));

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setAnalyticsUserId(PluginCall call) {
        FirebaseAnalytics.getInstance(getContext()).setUserId(call.getString("userId"));

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setAnalyticsUserProperty(PluginCall call) {
        String name = sanitizeParamName(call.getString("name"));
        if (name.isEmpty()) {
            call.reject("Missing analytics user property name");
            return;
        }

        FirebaseAnalytics.getInstance(getContext()).setUserProperty(name, call.getString("value"));

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setCrashlyticsCollectionEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(enabled);

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setCrashlyticsUserId(PluginCall call) {
        String userId = call.getString("userId", "anonymous");
        FirebaseCrashlytics.getInstance().setUserId(userId == null ? "anonymous" : userId);

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void recordNonFatal(PluginCall call) {
        String message = call.getString("message", "Snakey non-fatal error");
        String reason = call.getString("reason", "unspecified");
        String stack = call.getString("stack", "");

        FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
        crashlytics.log(message);
        crashlytics.setCustomKey("last_error_reason", reason);
        if (!stack.isEmpty()) {
            crashlytics.setCustomKey("last_error_stack", stack.length() > 1000 ? stack.substring(0, 1000) : stack);
        }
        crashlytics.recordException(new Exception(message + " [" + reason + "]"));

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        requestPermissionForAlias("notifications", call, "notificationPermissionResult");
    }

    @PluginMethod
    public void registerForPushNotifications(PluginCall call) {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                call.reject("Failed to fetch FCM token", task.getException());
                return;
            }

            String token = task.getResult();
            FirebaseBridgeStore.savePushToken(getContext(), token);

            JSObject result = new JSObject();
            result.put("granted", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED);
            result.put("token", token);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void getLastPushToken(PluginCall call) {
        JSObject result = new JSObject();
        result.put("token", FirebaseBridgeStore.getPushToken(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void initializeAds(PluginCall call) {
        getActivity().runOnUiThread(() -> MobileAds.initialize(getContext(), initializationStatus -> {
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        }));
    }

    @PluginMethod
    public void showBanner(PluginCall call) {
        String adUnitId = call.getString("adUnitId");
        if (adUnitId == null || adUnitId.isEmpty()) {
            call.reject("Missing banner ad unit id");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                ViewGroup root = getActivity().findViewById(android.R.id.content);
                if (root == null) {
                    call.reject("Unable to find Android content root");
                    return;
                }

                if (bannerView != null) {
                    root.removeView(bannerView);
                    bannerView.destroy();
                }

                bannerView = new AdView(getContext());
                bannerView.setAdUnitId(adUnitId);
                bannerView.setAdSize(AdSize.BANNER);

                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;

                root.addView(bannerView, params);
                bannerView.loadAd(new AdRequest.Builder().build());

                JSObject result = new JSObject();
                result.put("ok", true);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Banner show failed", error);
            }
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (bannerView != null) {
                ViewGroup root = getActivity().findViewById(android.R.id.content);
                if (root != null) {
                    root.removeView(bannerView);
                }
                bannerView.destroy();
                bannerView = null;
            }
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void preloadInterstitial(PluginCall call) {
        String adUnitId = call.getString("adUnitId");
        if (adUnitId == null || adUnitId.isEmpty()) {
            call.reject("Missing interstitial ad unit id");
            return;
        }

        InterstitialAd.load(
            getContext(),
            adUnitId,
            new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull InterstitialAd ad) {
                    interstitialAd = ad;
                    JSObject result = new JSObject();
                    result.put("ok", true);
                    call.resolve(result);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    interstitialAd = null;
                    call.reject(loadAdError.getMessage());
                }
            }
        );
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        if (interstitialAd == null) {
            call.reject("Interstitial not ready");
            return;
        }

        getActivity().runOnUiThread(() -> {
            interstitialAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    interstitialAd = null;
                }
            });
            interstitialAd.show(getActivity());
            JSObject result = new JSObject();
            result.put("shown", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void preloadRewarded(PluginCall call) {
        String adUnitId = call.getString("adUnitId");
        if (adUnitId == null || adUnitId.isEmpty()) {
            call.reject("Missing rewarded ad unit id");
            return;
        }

        RewardedAd.load(
            getContext(),
            adUnitId,
            new AdRequest.Builder().build(),
            new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    rewardedAd = ad;
                    JSObject result = new JSObject();
                    result.put("ok", true);
                    call.resolve(result);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    rewardedAd = null;
                    call.reject(loadAdError.getMessage());
                }
            }
        );
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        if (rewardedAd == null) {
            call.reject("Rewarded ad not ready");
            return;
        }

        call.setKeepAlive(true);
        getActivity().runOnUiThread(() -> {
            final boolean[] rewarded = { false };

            rewardedAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    JSObject result = new JSObject();
                    result.put("rewarded", rewarded[0]);
                    call.resolve(result);
                    rewardedAd = null;
                }
            });

            rewardedAd.show(getActivity(), rewardItem -> {
                rewarded[0] = true;
                JSObject result = new JSObject();
                result.put("rewarded", true);
                result.put("amount", rewardItem.getAmount());
                result.put("type", rewardItem.getType());
                call.resolve(result);
            });
        });
    }

    @PluginMethod
    public void getInstallReferrer(PluginCall call) {
        InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        client.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                if (responseCode != InstallReferrerClient.InstallReferrerResponse.OK) {
                    call.reject("Install referrer unavailable: " + responseCode);
                    client.endConnection();
                    return;
                }

                try {
                    ReferrerDetails details = client.getInstallReferrer();
                    JSObject result = new JSObject();
                    result.put("installReferrer", details.getInstallReferrer());
                    result.put("referrerClickTimestampSeconds", details.getReferrerClickTimestampSeconds());
                    result.put("installBeginTimestampSeconds", details.getInstallBeginTimestampSeconds());
                    result.put("installVersion", details.getInstallVersion());
                    result.put("googlePlayInstant", details.getGooglePlayInstantParam());
                    call.resolve(result);
                } catch (Exception error) {
                    call.reject("Failed to read install referrer", error);
                } finally {
                    client.endConnection();
                }
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                client.endConnection();
            }
        });
    }

    private void notificationPermissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @ActivityCallback
    private void handleGoogleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result == null || result.getResultCode() != getActivity().RESULT_OK || result.getData() == null) {
            call.reject("Google sign-in cancelled");
            return;
        }

        try {
            GoogleSignInAccount account = GoogleSignIn.getSignedInAccountFromIntent(result.getData()).getResult(ApiException.class);
            String idToken = account.getIdToken();
            if (idToken == null || idToken.isEmpty()) {
                call.reject("Google sign-in returned no ID token");
                return;
            }

            AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
            FirebaseAuth.getInstance().signInWithCredential(credential).addOnCompleteListener(getActivity(), task -> {
                if (!task.isSuccessful()) {
                    call.reject("Firebase sign-in failed", task.getException());
                    return;
                }

                FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
                call.resolve(buildGoogleUserPayload(user));
            });
        } catch (ApiException error) {
            call.reject("Google sign-in failed", error);
        }
    }

    private Bundle toBundle(JSObject object) {
        Bundle bundle = new Bundle();
        if (object == null) {
            return bundle;
        }

        Iterator<String> keys = object.keys();
        while (keys.hasNext()) {
            String rawKey = keys.next();
            String key = sanitizeParamName(rawKey);
            if (key.isEmpty()) {
                continue;
            }

            try {
                Object value = object.get(rawKey);
                if (value == null) {
                    continue;
                }

                if (value instanceof Boolean) {
                    bundle.putString(key, value.toString());
                } else if (value instanceof Integer) {
                    bundle.putLong(key, ((Integer) value).longValue());
                } else if (value instanceof Long) {
                    bundle.putLong(key, (Long) value);
                } else if (value instanceof Double) {
                    bundle.putDouble(key, (Double) value);
                } else if (value instanceof Number) {
                    bundle.putDouble(key, ((Number) value).doubleValue());
                } else {
                    String text = String.valueOf(value);
                    bundle.putString(key, text.length() > 100 ? text.substring(0, 100) : text);
                }
            } catch (JSONException ignored) {
                // Ignore invalid analytics parameters.
            }
        }

        return bundle;
    }

    private String sanitizeAnalyticsName(String name) {
        if (name == null) {
            return "";
        }

        String sanitized = name.trim().toLowerCase().replaceAll("[^a-z0-9_]", "_");
        if (sanitized.isEmpty()) {
            return "";
        }
        if (!Character.isLetter(sanitized.charAt(0))) {
            sanitized = "snk_" + sanitized;
        }
        if (sanitized.startsWith("firebase_") || sanitized.startsWith("google_") || sanitized.startsWith("ga_")) {
            sanitized = "snk_" + sanitized;
        }
        return sanitized.length() > 40 ? sanitized.substring(0, 40) : sanitized;
    }

    private String sanitizeParamName(String name) {
        if (name == null) {
            return "";
        }

        String sanitized = name.trim().toLowerCase().replaceAll("[^a-z0-9_]", "_");
        if (sanitized.isEmpty()) {
            return "";
        }
        if (!Character.isLetter(sanitized.charAt(0))) {
            sanitized = "snk_" + sanitized;
        }
        if (sanitized.startsWith("firebase_") || sanitized.startsWith("google_") || sanitized.startsWith("ga_")) {
            sanitized = "snk_" + sanitized;
        }
        return sanitized.length() > 40 ? sanitized.substring(0, 40) : sanitized;
    }

    private String getWebClientId() {
        int resourceId = getContext().getResources().getIdentifier("default_web_client_id", "string", getContext().getPackageName());
        if (resourceId == 0) {
            return "";
        }
        return getContext().getString(resourceId);
    }

    private JSObject buildGoogleUserPayload(FirebaseUser user) {
        JSObject result = new JSObject();
        result.put("signedIn", user != null);
        if (user == null) {
            return result;
        }

        result.put("uid", user.getUid());
        result.put("displayName", user.getDisplayName());
        result.put("email", user.getEmail());
        result.put("photoUrl", user.getPhotoUrl() != null ? user.getPhotoUrl().toString() : null);
        result.put("isAnonymous", user.isAnonymous());
        return result;
    }
}