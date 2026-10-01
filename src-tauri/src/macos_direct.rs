//! NearShare macOS Native Direct Mode Implementation
//!
//! Provides the real native Apple MultipeerConnectivity & Network.framework
//! bridge compiling Swift native code with C-ABI FFI and Tauri IPC.

use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

// C-ABI FFI Declarations linking to Swift NearShareDirect module
#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn nearshare_direct_init(display_name: *const c_char, device_id: *const c_char) -> bool;
    fn nearshare_direct_register_callbacks(
        on_peer_discovered: Option<extern "C" fn(*const c_char, *const c_char, *const c_char, *const c_char)>,
        on_peer_lost: Option<extern "C" fn(*const c_char)>,
        on_invitation_received: Option<extern "C" fn(*const c_char, *const c_char, *const c_char)>,
        on_connection_state_changed: Option<extern "C" fn(*const c_char, c_int)>,
        on_stream_opened: Option<extern "C" fn(*const c_char, *const c_char, *const c_char)>,
        on_data_received: Option<extern "C" fn(*const c_char, *const u8, c_int)>,
        on_stream_closed: Option<extern "C" fn(*const c_char)>,
    );
    fn nearshare_direct_start_advertising(service_type: *const c_char) -> bool;
    fn nearshare_direct_stop_advertising();
    fn nearshare_direct_start_discovery(service_type: *const c_char) -> bool;
    fn nearshare_direct_stop_discovery();
    fn nearshare_direct_invite_peer(peer_id: *const c_char) -> bool;
    fn nearshare_direct_accept_invitation(invitation_id: *const c_char, accept: bool) -> bool;
    fn nearshare_direct_open_stream(peer_id: *const c_char, stream_name: *const c_char, out_conn_id: *mut c_char, max_len: c_int) -> bool;
    fn nearshare_direct_send_bytes(connection_id: *const c_char, bytes: *const u8, length: c_int) -> c_int;
    fn nearshare_direct_close_stream(connection_id: *const c_char);
    fn nearshare_direct_disconnect();
    fn nearshare_direct_teardown();
    fn nearshare_direct_self_test() -> bool;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacOSDirectCapabilitiesReport {
    pub platform: String,
    pub native_framework: String,
    pub native_support: String,
    pub physical_validation: String,
    pub peer_discovery: String,
    pub direct_stream: String,
    pub target_product_range_meters: u32,
    pub requires_router: bool,
    pub requires_internet: bool,
    pub requires_wifi_radio_on: bool,
}

static APP_HANDLE: OnceLock<Mutex<Option<AppHandle>>> = OnceLock::new();

fn get_app_handle() -> &'static Mutex<Option<AppHandle>> {
    APP_HANDLE.get_or_init(|| Mutex::new(None))
}

pub fn set_direct_macos_app_handle(handle: AppHandle) {
    if let Ok(mut lock) = get_app_handle().lock() {
        *lock = Some(handle);
    }
}

// C-ABI Callback Trampolines emitting events into Tauri WebView
#[cfg(target_os = "macos")]
extern "C" fn c_on_peer_discovered(peer_id: *const c_char, display_name: *const c_char, device_id: *const c_char, platform: *const c_char) {
    let p_id = unsafe { CStr::from_ptr(peer_id).to_string_lossy().into_owned() };
    let d_name = unsafe { CStr::from_ptr(display_name).to_string_lossy().into_owned() };
    let dev_id = unsafe { CStr::from_ptr(device_id).to_string_lossy().into_owned() };
    let plat = unsafe { CStr::from_ptr(platform).to_string_lossy().into_owned() };

    if let Ok(guard) = get_app_handle().lock() {
        if let Some(app) = guard.as_ref() {
            let _ = app.emit("direct_macos_peer_discovered", serde_json::json!({
                "peerId": p_id,
                "displayName": d_name,
                "deviceId": dev_id,
                "platform": plat,
                "discoveredAt": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64
            }));
        }
    }
}

#[cfg(target_os = "macos")]
extern "C" fn c_on_peer_lost(peer_id: *const c_char) {
    let p_id = unsafe { CStr::from_ptr(peer_id).to_string_lossy().into_owned() };
    if let Ok(guard) = get_app_handle().lock() {
        if let Some(app) = guard.as_ref() {
            let _ = app.emit("direct_macos_peer_lost", serde_json::json!({ "peerId": p_id }));
        }
    }
}

#[cfg(target_os = "macos")]
extern "C" fn c_on_invitation_received(invitation_id: *const c_char, peer_id: *const c_char, display_name: *const c_char) {
    let inv_id = unsafe { CStr::from_ptr(invitation_id).to_string_lossy().into_owned() };
    let p_id = unsafe { CStr::from_ptr(peer_id).to_string_lossy().into_owned() };
    let d_name = unsafe { CStr::from_ptr(display_name).to_string_lossy().into_owned() };

    if let Ok(guard) = get_app_handle().lock() {
        if let Some(app) = guard.as_ref() {
            let _ = app.emit("direct_macos_invitation_received", serde_json::json!({
                "invitationId": inv_id,
                "peerId": p_id,
                "displayName": d_name
            }));
        }
    }
}

#[cfg(target_os = "macos")]
extern "C" fn c_on_connection_state_changed(peer_id: *const c_char, state: c_int) {
    let p_id = unsafe { CStr::from_ptr(peer_id).to_string_lossy().into_owned() };
    let state_str = match state {
        1 => "connecting",
        2 => "connected",
        3 => "disconnecting",
        4 => "failed",
        _ => "notConnected",
    };

    if let Ok(guard) = get_app_handle().lock() {
        if let Some(app) = guard.as_ref() {
            let _ = app.emit("direct_macos_connection_state_changed", serde_json::json!({
                "peerId": p_id,
                "state": state_str,
                "rawState": state
            }));
        }
    }
}

#[cfg(target_os = "macos")]
extern "C" fn c_on_stream_opened(connection_id: *const c_char, peer_id: *const c_char, stream_name: *const c_char) {
    let conn_id = unsafe { CStr::from_ptr(connection_id).to_string_lossy().into_owned() };
    let p_id = unsafe { CStr::from_ptr(peer_id).to_string_lossy().into_owned() };
    let s_name = unsafe { CStr::from_ptr(stream_name).to_string_lossy().into_owned() };

    if let Ok(guard) = get_app_handle().lock() {
        if let Some(app) = guard.as_ref() {
            let _ = app.emit("direct_macos_stream_opened", serde_json::json!({
                "connectionId": conn_id,
                "peerId": p_id,
                "streamName": s_name
            }));
        }
    }
}

#[cfg(target_os = "macos")]
extern "C" fn c_on_data_received(connection_id: *const c_char, data_ptr: *const u8, length: c_int) {
    if length <= 0 || data_ptr.is_null() {
        return;
    }
    let conn_id = unsafe { CStr::from_ptr(connection_id).to_string_lossy().into_owned() };
    let slice = unsafe { std::slice::from_raw_parts(data_ptr, length as usize) };
    let base64_payload = base64_encode(slice);

    if let Ok(guard) = get_app_handle().lock() {
        if let Some(app) = guard.as_ref() {
            let _ = app.emit("direct_macos_data_received", serde_json::json!({
                "connectionId": conn_id,
                "dataBase64": base64_payload,
                "length": length
            }));
        }
    }
}

#[cfg(target_os = "macos")]
extern "C" fn c_on_stream_closed(connection_id: *const c_char) {
    let conn_id = unsafe { CStr::from_ptr(connection_id).to_string_lossy().into_owned() };
    if let Ok(guard) = get_app_handle().lock() {
        if let Some(app) = guard.as_ref() {
            let _ = app.emit("direct_macos_stream_closed", serde_json::json!({
                "connectionId": conn_id
            }));
        }
    }
}

fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        out.push(CHARSET[(b0 >> 2) as usize] as char);
        out.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARSET[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARSET[(b2 & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

#[tauri::command]
pub fn direct_macos_init(app: AppHandle, display_name: Option<String>, device_id: Option<String>) -> Result<bool, String> {
    set_direct_macos_app_handle(app);

    #[cfg(target_os = "macos")]
    {
        let c_name = CString::new(display_name.unwrap_or_else(|| "NearShare macOS".to_string())).map_err(|e| e.to_string())?;
        let c_dev = CString::new(device_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string())).map_err(|e| e.to_string())?;

        unsafe {
            nearshare_direct_register_callbacks(
                Some(c_on_peer_discovered),
                Some(c_on_peer_lost),
                Some(c_on_invitation_received),
                Some(c_on_connection_state_changed),
                Some(c_on_stream_opened),
                Some(c_on_data_received),
                Some(c_on_stream_closed),
            );
            Ok(nearshare_direct_init(c_name.as_ptr(), c_dev.as_ptr()))
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS Direct Mode is only supported on macOS hosts".to_string())
    }
}

#[tauri::command]
pub fn direct_macos_get_capabilities() -> Result<MacOSDirectCapabilitiesReport, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(MacOSDirectCapabilitiesReport {
            platform: "macOS".to_string(),
            native_framework: "MultipeerConnectivity".to_string(),
            native_support: "supported".to_string(),
            physical_validation: "not_verified".to_string(),
            peer_discovery: "supported".to_string(),
            direct_stream: "supported".to_string(),
            target_product_range_meters: 30,
            requires_router: false,
            requires_internet: false,
            requires_wifi_radio_on: true,
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(MacOSDirectCapabilitiesReport {
            platform: std::env::consts::OS.to_string(),
            native_framework: "None".to_string(),
            native_support: "requiresNative".to_string(),
            physical_validation: "not_verified".to_string(),
            peer_discovery: "requiresNative".to_string(),
            direct_stream: "requiresNative".to_string(),
            target_product_range_meters: 30,
            requires_router: false,
            requires_internet: false,
            requires_wifi_radio_on: true,
        })
    }
}

#[tauri::command]
pub fn direct_macos_start_discovery(service_type: Option<String>) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let svc = service_type.unwrap_or_else(|| "nearshare-p2p".to_string());
        if svc.is_empty() || svc.len() > 15 || !svc.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err("Service type must be 1-15 ASCII alphanumeric or hyphen characters".to_string());
        }
        let c_svc = CString::new(svc).map_err(|e| e.to_string())?;
        unsafe { Ok(nearshare_direct_start_discovery(c_svc.as_ptr())) }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS Direct Mode requires native macOS runtime".to_string())
    }
}

#[tauri::command]
pub fn direct_macos_stop_discovery() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            nearshare_direct_stop_discovery();
        }
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[tauri::command]
pub fn direct_macos_start_advertising(service_type: Option<String>) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let svc = service_type.unwrap_or_else(|| "nearshare-p2p".to_string());
        let c_svc = CString::new(svc).map_err(|e| e.to_string())?;
        unsafe { Ok(nearshare_direct_start_advertising(c_svc.as_ptr())) }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS Direct Mode requires native macOS runtime".to_string())
    }
}

#[tauri::command]
pub fn direct_macos_stop_advertising() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            nearshare_direct_stop_advertising();
        }
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[tauri::command]
pub fn direct_macos_invite_peer(peer_id: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        if peer_id.is_empty() {
            return Err("Invalid empty peerId".to_string());
        }
        let c_peer = CString::new(peer_id).map_err(|e| e.to_string())?;
        unsafe { Ok(nearshare_direct_invite_peer(c_peer.as_ptr())) }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS Direct Mode requires native macOS runtime".to_string())
    }
}

#[tauri::command]
pub fn direct_macos_accept_invitation(invitation_id: String, accept: bool) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let c_inv = CString::new(invitation_id).map_err(|e| e.to_string())?;
        unsafe { Ok(nearshare_direct_accept_invitation(c_inv.as_ptr(), accept)) }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS Direct Mode requires native macOS runtime".to_string())
    }
}

#[tauri::command]
pub fn direct_macos_open_stream(peer_id: String, stream_name: Option<String>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let c_peer = CString::new(peer_id).map_err(|e| e.to_string())?;
        let s_name = stream_name.unwrap_or_else(|| "nearshare-stream".to_string());
        let c_name = CString::new(s_name).map_err(|e| e.to_string())?;

        let mut buf = vec![0 as c_char; 256];
        let success = unsafe {
            nearshare_direct_open_stream(c_peer.as_ptr(), c_name.as_ptr(), buf.as_mut_ptr(), 256)
        };

        if success {
            let conn_id = unsafe { CStr::from_ptr(buf.as_ptr()).to_string_lossy().into_owned() };
            Ok(conn_id)
        } else {
            Err("Failed to open MultipeerConnectivity byte stream".to_string())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS Direct Mode requires native macOS runtime".to_string())
    }
}

#[tauri::command]
pub fn direct_macos_send_bytes(connection_id: String, bytes_base64: String) -> Result<i32, String> {
    #[cfg(target_os = "macos")]
    {
        let c_conn = CString::new(connection_id).map_err(|e| e.to_string())?;
        let data = base64_decode(&bytes_base64)?;
        let written = unsafe {
            nearshare_direct_send_bytes(c_conn.as_ptr(), data.as_ptr(), data.len() as c_int)
        };
        if written < 0 {
            Err("Native stream buffer full or stream unavailable".to_string())
        } else {
            Ok(written)
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS Direct Mode requires native macOS runtime".to_string())
    }
}

#[tauri::command]
pub fn direct_macos_close_stream(connection_id: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let c_conn = CString::new(connection_id).map_err(|e| e.to_string())?;
        unsafe {
            nearshare_direct_close_stream(c_conn.as_ptr());
        }
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[tauri::command]
pub fn direct_macos_disconnect() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            nearshare_direct_disconnect();
        }
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[tauri::command]
pub fn direct_macos_teardown() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            nearshare_direct_teardown();
        }
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacOSDirectSelfTestResult {
    pub success: bool,
    pub native_implementation: String,
    pub framework: String,
    pub stream_transport: String,
    pub physical_peer: bool,
    pub physical_validation: String,
}

#[tauri::command]
pub fn direct_macos_self_test() -> Result<MacOSDirectSelfTestResult, String> {
    #[cfg(target_os = "macos")]
    {
        let passed = unsafe { nearshare_direct_self_test() };
        Ok(MacOSDirectSelfTestResult {
            success: passed,
            native_implementation: "implemented".to_string(),
            framework: "MultipeerConnectivity".to_string(),
            stream_transport: if passed { "available".to_string() } else { "failed".to_string() },
            physical_peer: false,
            physical_validation: "unverified".to_string(),
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(MacOSDirectSelfTestResult {
            success: false,
            native_implementation: "requiresNative".to_string(),
            framework: "None".to_string(),
            stream_transport: "unavailable".to_string(),
            physical_peer: false,
            physical_validation: "unverified".to_string(),
        })
    }
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    let clean: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    let mut out = Vec::with_capacity(clean.len() * 3 / 4);

    let decode_char = |c: char| -> Result<u8, String> {
        match c {
            'A'..='Z' => Ok(c as u8 - b'A'),
            'a'..='z' => Ok(c as u8 - b'a' + 26),
            '0'..='9' => Ok(c as u8 - b'0' + 52),
            '+' => Ok(62),
            '/' => Ok(63),
            _ => Err("Invalid base64 character".to_string()),
        }
    };

    let bytes = clean.as_bytes();
    for chunk in bytes.chunks(4) {
        if chunk.len() < 2 {
            break;
        }
        let b0 = decode_char(chunk[0] as char)?;
        let b1 = decode_char(chunk[1] as char)?;
        out.push((b0 << 2) | (b1 >> 4));

        if chunk.len() > 2 && chunk[2] != b'=' {
            let b2 = decode_char(chunk[2] as char)?;
            out.push(((b1 & 0x0F) << 4) | (b2 >> 2));

            if chunk.len() > 3 && chunk[3] != b'=' {
                let b3 = decode_char(chunk[3] as char)?;
                out.push(((b2 & 0x03) << 6) | b3);
            }
        }
    }

    Ok(out)
}
