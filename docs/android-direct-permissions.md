# NearShare Android Direct Capabilities & Permissions Audit

## Overview
This document specifies the exact Android manifest permissions, runtime permission requirements, and operating system policies required for Wi-Fi Direct and native socket streaming in NearShare Android builds.

---

## 1. Android Permissions Matrix

| Permission | Scope / API Level | Purpose in NearShare | Runtime Prompt Required? | Status |
|:---|:---|:---|:---:|:---:|
| `android.permission.NEARBY_WIFI_DEVICES` | Android 13+ (API 33+) | Wi-Fi Direct discovery & peer connection without location | YES | `CONFIGURED` |
| `android.permission.ACCESS_FINE_LOCATION` | Android 10–12 (API 29–32) | Legacy Wi-Fi P2P device scanning requirement | YES (on Android < 13) | `CONFIGURED` |
| `android.permission.ACCESS_WIFI_STATE` | All API Levels | Inspect Wi-Fi radio status | NO | `CONFIGURED` |
| `android.permission.CHANGE_WIFI_STATE` | All API Levels | Wi-Fi Direct connection initialization | NO | `CONFIGURED` |
| `android.permission.INTERNET` | All API Levels | TCP Socket creation over local P2P network | NO | `CONFIGURED` |
| `android.permission.ACCESS_NETWORK_STATE` | All API Levels | ConnectivityManager interface binding | NO | `CONFIGURED` |
| `android.permission.FOREGROUND_SERVICE` | Android 9+ (API 28+) | Foreground transfer continuity service | NO | `CONFIGURED` |
| `android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE` | Android 14+ (API 34+) | Service type declaration for Wi-Fi Direct | NO | `CONFIGURED` |
| `android.permission.FOREGROUND_SERVICE_DATA_SYNC` | Android 14+ (API 34+) | Service type declaration for active payload sync | NO | `CONFIGURED` |
| `android.permission.POST_NOTIFICATIONS` | Android 13+ (API 33+) | Foreground transfer notification display | YES | `CONFIGURED` |

---

## 2. Permissions Rationale & Minimization

1. **`neverForLocation` Flag**:
   In `AndroidManifest.xml`, `NEARBY_WIFI_DEVICES` is declared with `android:usesPermissionFlags="neverForLocation"`, guaranteeing that NearShare does not use Wi-Fi scanning to infer physical geographic location.
2. **Zero File System Permission Pollution**:
   NearShare uses Android Storage Access Framework (SAF) or scoped private cache storage, avoiding dangerous `MANAGE_EXTERNAL_STORAGE` permissions.
3. **Wi-Fi Radio Invariants**:
   - NearShare **never** toggles the user's primary Wi-Fi radio off or disconnects existing infrastructure networks without user interaction.
   - Operates fully off-grid (`requiresRouter: false`, `requiresInternet: false`).
