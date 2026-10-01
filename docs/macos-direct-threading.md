# NearShare — macOS Direct Mode Threading & Concurrency Architecture

## 1. Executive Summary

This document defines the threading model and cross-language execution flow for NearShare macOS Direct Mode. It documents the exact progression from Apple Multipeer delegate worker threads down to the React JavaScript event loop.

---

## 2. Cross-Language Concurrency Flow

```mermaid
sequenceDiagram
    autonumber
    participant Apple as Apple Multipeer Framework (Internal Thread)
    participant SwiftQueue as Swift Serial Queue (com.nearshare.direct.session)
    participant C_ABI as C-ABI Callback Trampoline
    participant Rust as Rust Tauri IPC Thread Pool
    participant TauriEvent as Tauri Event Emitter
    participant JS as WebView JavaScript Event Loop (V8/JSC)
    participant React as React UI State (Zustand/Context)

    Apple->>SwiftQueue: Delegate invocation (e.g. advertiser:didReceiveInvitationFromPeer:)
    Note over SwiftQueue: Synced on serial queue; state mutated safely
    SwiftQueue->>C_ABI: Invokes C function pointer (c_on_invitation_received)
    C_ABI->>Rust: Executes c_on_invitation_received trampoline
    Note over Rust: Locks static AppHandle Mutex; creates JSON payload
    Rust->>TauriEvent: app.emit("direct_macos_invitation_received", payload)
    TauriEvent->>JS: PostMessage to Tauri Webview IPC bridge
    JS->>React: NativeBridgeContext / MacOSDirectPeerBridge listener callback
    React->>React: Updates UI state on Main Thread
```

---

## 3. Concurrency Invariants & Protections

1. **Swift Serial Queue Isolation**: All mutable state inside `NearShareDirectSession` (`discoveredPeers`, `activeOutputStreams`, `activeInputStreams`, `pendingInvitations`) is accessed strictly within `queue.sync { ... }` on a dedicated serial queue `com.nearshare.direct.session`. This guarantees zero data races across multi-threaded Multipeer delegates.
2. **Non-Blocking C-ABI Trampolines**: FFI callbacks (`c_on_peer_discovered`, `c_on_data_received`, etc.) do not perform heavy I/O or blocking operations. They copy raw byte buffers and dispatch asynchronous events via `app.emit()`.
3. **Rust Thread Safety (`Send` + `Sync`)**: The Tauri `AppHandle` is protected with a `Mutex<Option<AppHandle>>` initialized via `OnceLock`. Event emission is non-blocking and safe across arbitrary OS threads.
4. **Main-Thread React Dispatch**: In the frontend, Tauri event listeners run inside the WebView's JavaScript main thread, ensuring React state hooks (`useState`, `useContext`) are always invoked safely without threading anomalies.
