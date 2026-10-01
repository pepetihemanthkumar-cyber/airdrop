use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{Ipv4Addr, Shutdown, SocketAddr, SocketAddrV4, TcpListener, TcpStream, UdpSocket};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};
use uuid::Uuid;

pub mod macos_direct;
pub mod windows_direct;
pub mod android_direct;
pub mod ios_direct;

// Maximum chunk size allowed (4 MiB = 4,194,304 bytes)
const MAX_CHUNK_SIZE: u32 = 4 * 1024 * 1024;

// Maximum payload size for Step 38 TCP Local Transport Spike (1 MiB = 1,048,576 bytes)
const MAX_TCP_SPIKE_PAYLOAD: usize = 1024 * 1024;

// Step 46: UDP Multicast Discovery Constants
const DEFAULT_DISCOVERY_MULTICAST_V4: &str = "239.255.60.60";
const DEFAULT_DISCOVERY_PORT: u16 = 53317;
const MAX_DISCOVERY_PACKET_SIZE: usize = 1024;

// Global in-memory registry mapping opaque ID -> native PathBuf (session-only, never persisted)
static FILE_REGISTRY: Mutex<Option<HashMap<String, PathBuf>>> = Mutex::new(None);

// TCP Spike Session Registries
#[allow(dead_code)]
struct TcpServerHandle {
    server_id: String,
    port: u16,
    is_running: Arc<AtomicBool>,
}

#[allow(dead_code)]
struct TcpConnectionHandle {
    connection_id: String,
    writer: Arc<Mutex<TcpStream>>,
    remote_addr: String,
}

static TCP_SERVER_REGISTRY: Mutex<Option<HashMap<String, TcpServerHandle>>> = Mutex::new(None);
static TCP_CONNECTION_REGISTRY: Mutex<Option<HashMap<String, TcpConnectionHandle>>> = Mutex::new(None);

// UDP Discovery Session Handle & Peer Cache
#[allow(dead_code)]
struct UdpDiscoveryHandle {
    socket: Arc<UdpSocket>,
    is_running: Arc<AtomicBool>,
    multicast_addr: SocketAddrV4,
}

static UDP_DISCOVERY_HANDLE: Mutex<Option<UdpDiscoveryHandle>> = Mutex::new(None);
static DISCOVERED_PEERS_CACHE: Mutex<Option<HashMap<String, DiscoveredPeerPayload>>> = Mutex::new(None);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryPacket {
    pub protocol: String,
    pub version: String,
    #[serde(rename = "type")]
    pub packet_type: String,
    pub device_id: String,
    pub profile_id: Option<String>,
    pub device_name: String,
    pub platform: String,
    pub capabilities: Vec<String>,
    pub tcp_port: u16,
    pub timestamp: u64,
    pub expires_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredPeerPayload {
    pub device_id: String,
    pub profile_id: Option<String>,
    pub device_name: String,
    pub platform: String,
    pub ip_address: String,
    pub tcp_port: u16,
    pub capabilities: Vec<String>,
    pub first_seen: u64,
    pub last_seen: u64,
    pub expires_at: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UdpDiscoveryInfo {
    pub multicast_group: String,
    pub port: u16,
    pub is_running: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TcpServerInfo {
    pub server_id: String,
    pub port: u16,
    pub host_display: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TcpConnectResult {
    pub connection_id: String,
    pub state: String,
    pub port: u16,
    pub host_display: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TcpMessageEvent {
    pub connection_id: String,
    pub bytes: Vec<u8>,
    pub is_server: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TcpConnectionStateEvent {
    pub connection_id: String,
    pub state: String,
    pub message: Option<String>,
    pub remote_addr: Option<String>,
    pub is_server: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NativePickedFile {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub kind: String,
    pub extension: Option<String>,
    pub mime_type: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeChunkReadResult {
    pub reference_id: String,
    pub offset: u64,
    pub length: u32,
    pub bytes_read: u32,
    pub bytes: Vec<u8>,
    pub is_eof: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeChunkWriteResult {
    pub reference_id: String,
    pub offset: u64,
    pub bytes_written: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TauriRuntimeDiagnostics {
    pub runtime: String,
    pub platform: String,
    pub tauri_version: String,
    pub native_networking: bool,
    pub native_filesystem: bool,
}

#[tauri::command]
fn get_runtime_diagnostics() -> TauriRuntimeDiagnostics {
    #[cfg(target_os = "macos")]
    let platform = "macos".to_string();
    #[cfg(target_os = "windows")]
    let platform = "windows".to_string();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let platform = "unknown".to_string();

    TauriRuntimeDiagnostics {
        runtime: "tauri".to_string(),
        platform,
        tauri_version: "2.12.0".to_string(),
        native_networking: true,
        native_filesystem: false,
    }
}

#[tauri::command]
fn pick_files() -> Option<Vec<NativePickedFile>> {
    let files = rfd::FileDialog::new()
        .set_title("NearShare — Select Files")
        .pick_files();

    match files {
        Some(paths) if !paths.is_empty() => {
            let mut results = Vec::new();
            let mut registry = FILE_REGISTRY.lock().unwrap();
            let map = registry.get_or_insert_with(HashMap::new);

            for path in paths {
                let id = format!("native-{}", Uuid::new_v4());
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unnamed")
                    .to_string();

                let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                let extension = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|s| s.to_lowercase());

                let mime_type = extension.as_ref().map(|ext| match ext.as_str() {
                    "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" => format!("image/{}", ext),
                    "mp4" | "mov" | "mkv" | "avi" => format!("video/{}", ext),
                    "mp3" | "wav" | "flac" | "aac" => format!("audio/{}", ext),
                    "pdf" => "application/pdf".to_string(),
                    "zip" | "tar" | "gz" | "7z" => "application/zip".to_string(),
                    "json" => "application/json".to_string(),
                    "txt" | "md" => "text/plain".to_string(),
                    _ => "application/octet-stream".to_string(),
                });

                // Store path in session-only in-memory registry, never exposing path to frontend
                map.insert(id.clone(), path);

                results.push(NativePickedFile {
                    id,
                    name,
                    size,
                    kind: "file".to_string(),
                    extension,
                    mime_type,
                });
            }

            Some(results)
        }
        _ => None,
    }
}

#[tauri::command]
fn create_native_file(suggested_name: Option<String>) -> Option<NativePickedFile> {
    // 1. Sanitize suggested filename
    let safe_name = suggested_name
        .unwrap_or_else(|| "NearShare-Received.bin".to_string())
        .replace('/', "")
        .replace('\\', "")
        .replace('\0', "")
        .replace("..", "");

    let default_name = if safe_name.trim().is_empty() {
        "NearShare-Received.bin"
    } else {
        &safe_name
    };

    // 2. Open native Save Dialog
    let file = rfd::FileDialog::new()
        .set_title("NearShare — Save Destination")
        .set_file_name(default_name)
        .save_file();

    match file {
        Some(path) => {
            // 3. Initialize/truncate destination file to 0 bytes
            if let Err(_) = std::fs::File::create(&path) {
                return None;
            }

            let id = format!("native-{}", Uuid::new_v4());
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(default_name)
                .to_string();

            let extension = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_lowercase());

            let mime_type = extension.as_ref().map(|ext| match ext.as_str() {
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" => format!("image/{}", ext),
                "mp4" | "mov" | "mkv" | "avi" => format!("video/{}", ext),
                "mp3" | "wav" | "flac" | "aac" => format!("audio/{}", ext),
                "pdf" => "application/pdf".to_string(),
                "zip" | "tar" | "gz" | "7z" => "application/zip".to_string(),
                "json" => "application/json".to_string(),
                "txt" | "md" => "text/plain".to_string(),
                _ => "application/octet-stream".to_string(),
            });

            // 4. Register in in-memory session map
            let mut registry = FILE_REGISTRY.lock().unwrap();
            let map = registry.get_or_insert_with(HashMap::new);
            map.insert(id.clone(), path);

            Some(NativePickedFile {
                id,
                name,
                size: 0,
                kind: "file".to_string(),
                extension,
                mime_type,
            })
        }
        None => None,
    }
}

#[tauri::command]
fn read_native_file_chunk(
    reference_id: String,
    offset: u64,
    length: u32,
) -> Result<NativeChunkReadResult, String> {
    // 1. Enforce length bounds
    if length == 0 {
        return Err("INVALID_ARGUMENT: Requested length must be greater than 0".to_string());
    }
    if length > MAX_CHUNK_SIZE {
        return Err(format!(
            "INVALID_ARGUMENT: Requested length {} exceeds maximum chunk size {}",
            length, MAX_CHUNK_SIZE
        ));
    }

    // 2. Resolve opaque ID in session registry
    let path = {
        let registry = FILE_REGISTRY.lock().unwrap();
        let map = match registry.as_ref() {
            Some(m) => m,
            None => return Err("FILE_NOT_FOUND: Unknown or closed file reference".to_string()),
        };
        match map.get(&reference_id) {
            Some(p) => p.clone(),
            None => return Err("FILE_NOT_FOUND: Unknown or closed file reference".to_string()),
        }
    };

    // 3. Open file read-only
    let mut file = match std::fs::File::open(&path) {
        Ok(f) => f,
        Err(_) => return Err("IO_ERROR: Failed to open native file for reading".to_string()),
    };

    // 4. Verify file metadata & bounds
    let file_len = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => return Err("IO_ERROR: Failed to read file metadata".to_string()),
    };

    // 5. Check if offset is beyond or at EOF
    if offset >= file_len {
        return Ok(NativeChunkReadResult {
            reference_id,
            offset,
            length: 0,
            bytes_read: 0,
            bytes: Vec::new(),
            is_eof: true,
        });
    }

    // 6. Seek to requested offset
    if let Err(_) = file.seek(SeekFrom::Start(offset)) {
        return Err("IO_ERROR: Failed to seek to requested offset".to_string());
    }

    // 7. Read bounded chunk bytes
    let to_read = std::cmp::min(length as u64, file_len - offset) as usize;
    let mut buffer = vec![0u8; to_read];

    if let Err(_) = file.read_exact(&mut buffer) {
        return Err("IO_ERROR: Failed to read requested chunk bytes".to_string());
    }

    let is_eof = offset + (to_read as u64) >= file_len;

    Ok(NativeChunkReadResult {
        reference_id,
        offset,
        length: to_read as u32,
        bytes_read: to_read as u32,
        bytes: buffer,
        is_eof,
    })
}

#[tauri::command]
fn write_native_file_chunk(
    reference_id: String,
    offset: u64,
    bytes: Vec<u8>,
) -> Result<NativeChunkWriteResult, String> {
    // 1. Enforce chunk size bounds
    if bytes.len() > MAX_CHUNK_SIZE as usize {
        return Err(format!(
            "INVALID_ARGUMENT: Payload size {} exceeds maximum chunk size {}",
            bytes.len(),
            MAX_CHUNK_SIZE
        ));
    }

    // 2. Resolve opaque ID in session registry
    let path = {
        let registry = FILE_REGISTRY.lock().unwrap();
        let map = match registry.as_ref() {
            Some(m) => m,
            None => return Err("FILE_NOT_FOUND: Unknown or closed file reference".to_string()),
        };
        match map.get(&reference_id) {
            Some(p) => p.clone(),
            None => return Err("FILE_NOT_FOUND: Unknown or closed file reference".to_string()),
        }
    };

    // 3. Handle zero-byte write gracefully
    if bytes.is_empty() {
        return Ok(NativeChunkWriteResult {
            reference_id,
            offset,
            bytes_written: 0,
        });
    }

    // 4. Open file for writing (random-access seekable write without truncating existing content)
    let mut file = match std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .open(&path)
    {
        Ok(f) => f,
        Err(_) => return Err("IO_ERROR: Failed to open native file for writing".to_string()),
    };

    // 5. Seek to target offset
    if let Err(_) = file.seek(SeekFrom::Start(offset)) {
        return Err("IO_ERROR: Failed to seek to requested write offset".to_string());
    }

    // 6. Write chunk bytes
    if let Err(_) = file.write_all(&bytes) {
        return Err("IO_ERROR: Failed to write chunk bytes to native file".to_string());
    }

    // 7. Flush buffers
    if let Err(_) = file.flush() {
        return Err("IO_ERROR: Failed to flush file after write".to_string());
    }

    let written = bytes.len() as u32;

    Ok(NativeChunkWriteResult {
        reference_id,
        offset,
        bytes_written: written,
    })
}

#[tauri::command]
fn get_native_file_size(reference_id: String) -> Result<u64, String> {
    let registry = FILE_REGISTRY.lock().unwrap();
    let map = match registry.as_ref() {
        Some(m) => m,
        None => return Err("FILE_NOT_FOUND: Unknown or closed file reference".to_string()),
    };
    let path = match map.get(&reference_id) {
        Some(p) => p,
        None => return Err("FILE_NOT_FOUND: Unknown or closed file reference".to_string()),
    };

    match std::fs::metadata(path) {
        Ok(meta) => Ok(meta.len()),
        Err(_) => Err("IO_ERROR: Failed to query file metadata".to_string()),
    }
}

#[tauri::command]
fn close_native_file(reference_id: String) -> Result<bool, String> {
    let mut registry = FILE_REGISTRY.lock().unwrap();
    if let Some(map) = registry.as_mut() {
        let removed = map.remove(&reference_id).is_some();
        Ok(removed)
    } else {
        Ok(false)
    }
}

// Global in-memory registry mapping opaque folder ID -> native PathBuf (session-only, never persisted)
static FOLDER_REGISTRY: Mutex<Option<HashMap<String, PathBuf>>> = Mutex::new(None);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NativePickedFolder {
    pub id: String,
    pub name: String,
    pub kind: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NativeFolderScanEntry {
    pub id: String,
    pub relative_path: String,
    pub name: String,
    pub size: u64,
    pub kind: String,
    pub modified_at: Option<u64>,
    pub extension: Option<String>,
    pub mime_type: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeFolderScanResult {
    pub folder_reference_id: String,
    pub folder_name: String,
    pub file_count: usize,
    pub total_bytes: u64,
    pub entries: Vec<NativeFolderScanEntry>,
    pub truncated: bool,
    pub duration_ms: u64,
}

#[tauri::command]
fn pick_folder() -> Option<NativePickedFolder> {
    let folder = rfd::FileDialog::new()
        .set_title("NearShare — Select Folder")
        .pick_folder();

    match folder {
        Some(path) => {
            let id = format!("native-folder-{}", Uuid::new_v4());
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Folder")
                .to_string();

            let mut registry = FOLDER_REGISTRY.lock().unwrap();
            let map = registry.get_or_insert_with(HashMap::new);
            map.insert(id.clone(), path);

            Some(NativePickedFolder {
                id,
                name,
                kind: "folder".to_string(),
            })
        }
        None => None,
    }
}

fn scan_dir_recursive(
    root: &std::path::Path,
    current: &std::path::Path,
    depth: usize,
    max_depth: usize,
    max_files: usize,
    entries: &mut Vec<NativeFolderScanEntry>,
    file_registry: &mut HashMap<String, PathBuf>,
) -> Result<(), String> {
    if depth > max_depth {
        return Ok(());
    }

    let read_dir = match std::fs::read_dir(current) {
        Ok(rd) => rd,
        Err(_) => return Ok(()), // Skip unreadable folders gracefully without error
    };

    for entry_result in read_dir {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        // Symlink policy: Never follow symlinks to avoid directory loops and traversal outside root
        if file_type.is_symlink() {
            continue;
        }

        let path = entry.path();

        if file_type.is_dir() {
            scan_dir_recursive(
                root,
                &path,
                depth + 1,
                max_depth,
                max_files,
                entries,
                file_registry,
            )?;
        } else if file_type.is_file() {
            if entries.len() >= max_files {
                return Err("FOLDER_SCAN_LIMIT_EXCEEDED: Folder exceeds maximum file count limit".to_string());
            }

            let relative_path = match path.strip_prefix(root) {
                Ok(p) => p.to_string_lossy().replace('\\', "/"),
                Err(_) => continue,
            };

            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unnamed")
                .to_string();

            let metadata = std::fs::metadata(&path).ok();
            let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_at = metadata.as_ref().and_then(|m| {
                m.modified().ok().and_then(|t| {
                    t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_millis() as u64)
                })
            });

            let extension = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_lowercase());

            let mime_type = extension.as_ref().map(|ext| match ext.as_str() {
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" => format!("image/{}", ext),
                "mp4" | "mov" | "mkv" | "avi" => format!("video/{}", ext),
                "mp3" | "wav" | "flac" | "aac" => format!("audio/{}", ext),
                "pdf" => "application/pdf".to_string(),
                "zip" | "tar" | "gz" | "7z" => "application/zip".to_string(),
                "json" => "application/json".to_string(),
                "txt" | "md" | "ts" | "tsx" | "js" | "jsx" | "rs" | "css" | "html" => "text/plain".to_string(),
                _ => "application/octet-stream".to_string(),
            });

            let id = format!("native-{}", Uuid::new_v4());
            file_registry.insert(id.clone(), path.clone());

            entries.push(NativeFolderScanEntry {
                id,
                relative_path,
                name,
                size,
                kind: "file".to_string(),
                modified_at,
                extension,
                mime_type,
            });
        }
    }

    Ok(())
}

#[tauri::command]
fn scan_native_folder(
    folder_reference_id: String,
    max_files: Option<usize>,
    max_depth: Option<usize>,
) -> Result<NativeFolderScanResult, String> {
    let t0 = std::time::Instant::now();
    let root_path = {
        let registry = FOLDER_REGISTRY.lock().unwrap();
        let map = match registry.as_ref() {
            Some(m) => m,
            None => return Err("FOLDER_NOT_FOUND: Unknown or closed folder reference".to_string()),
        };
        match map.get(&folder_reference_id) {
            Some(p) => p.clone(),
            None => return Err("FOLDER_NOT_FOUND: Unknown or closed folder reference".to_string()),
        }
    };

    let folder_name = root_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Folder")
        .to_string();

    let limit_files = max_files.unwrap_or(20_000);
    let limit_depth = max_depth.unwrap_or(32);

    let mut entries = Vec::new();

    {
        let mut file_reg = FILE_REGISTRY.lock().unwrap();
        let file_map = file_reg.get_or_insert_with(HashMap::new);

        scan_dir_recursive(
            &root_path,
            &root_path,
            0,
            limit_depth,
            limit_files,
            &mut entries,
            file_map,
        )?;
    }

    // Deterministic sorting: relative_path ascending
    entries.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    let file_count = entries.len();
    let total_bytes: u64 = entries.iter().map(|e| e.size).sum();
    let duration_ms = t0.elapsed().as_millis() as u64;

    Ok(NativeFolderScanResult {
        folder_reference_id,
        folder_name,
        file_count,
        total_bytes,
        entries,
        truncated: false,
        duration_ms,
    })
}

#[tauri::command]
fn close_native_folder(folder_reference_id: String) -> Result<bool, String> {
    let mut registry = FOLDER_REGISTRY.lock().unwrap();
    if let Some(map) = registry.as_mut() {
        let removed = map.remove(&folder_reference_id).is_some();
        Ok(removed)
    } else {
        Ok(false)
    }
}

// -----------------------------------------------------------------------------
// STEP 38: Native Local TCP Transport Spike
// -----------------------------------------------------------------------------

fn spawn_reader_loop(
    app: tauri::AppHandle,
    connection_id: String,
    mut stream: TcpStream,
    is_server_side: bool,
) {
    std::thread::spawn(move || {
        let mut len_buf = [0u8; 4];
        loop {
            match stream.read_exact(&mut len_buf) {
                Ok(_) => {
                    let len = u32::from_be_bytes(len_buf) as usize;
                    if len > MAX_TCP_SPIKE_PAYLOAD {
                        let _ = app.emit(
                            "native-tcp-connection-state",
                            TcpConnectionStateEvent {
                                connection_id: connection_id.clone(),
                                state: "error".to_string(),
                                message: Some(format!(
                                    "TCP_PAYLOAD_LIMIT_EXCEEDED: Received {} bytes exceeding 1 MiB limit",
                                    len
                                )),
                                remote_addr: None,
                                is_server: is_server_side,
                            },
                        );
                        break;
                    }
                    let mut payload = vec![0u8; len];
                    if let Err(e) = stream.read_exact(&mut payload) {
                        let _ = app.emit(
                            "native-tcp-connection-state",
                            TcpConnectionStateEvent {
                                connection_id: connection_id.clone(),
                                state: "error".to_string(),
                                message: Some(format!("TCP_READ_FAILED: {}", e)),
                                remote_addr: None,
                                is_server: is_server_side,
                            },
                        );
                        break;
                    }
                    let _ = app.emit(
                        "native-tcp-message",
                        TcpMessageEvent {
                            connection_id: connection_id.clone(),
                            bytes: payload,
                            is_server: is_server_side,
                        },
                    );
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                    // Clean EOF disconnect by remote peer
                    break;
                }
                Err(_) => {
                    // Socket closed or broken
                    break;
                }
            }
        }

        // Clean up connection registry
        {
            let mut reg = TCP_CONNECTION_REGISTRY.lock().unwrap();
            if let Some(map) = reg.as_mut() {
                map.remove(&connection_id);
            }
        }

        let _ = app.emit(
            "native-tcp-connection-state",
            TcpConnectionStateEvent {
                connection_id,
                state: "disconnected".to_string(),
                message: None,
                remote_addr: None,
                is_server: is_server_side,
            },
        );
    });
}

#[tauri::command]
fn start_tcp_server(
    app: tauri::AppHandle,
    port: Option<u16>,
    bind_lan: Option<bool>,
) -> Result<TcpServerInfo, String> {
    let bind_host = if bind_lan.unwrap_or(false) {
        "0.0.0.0"
    } else {
        "127.0.0.1"
    };

    let bind_addr = format!("{}:{}", bind_host, port.unwrap_or(0));
    let listener = TcpListener::bind(&bind_addr)
        .map_err(|e| format!("TCP_BIND_FAILED: Failed to bind to '{}': {}", bind_addr, e))?;

    listener
        .set_nonblocking(true)
        .map_err(|e| format!("TCP_CONFIG_FAILED: {}", e))?;

    let actual_port = listener
        .local_addr()
        .map_err(|e| format!("TCP_CONFIG_FAILED: {}", e))?
        .port();

    let server_id = format!("srv-{}", Uuid::new_v4());
    let is_running = Arc::new(AtomicBool::new(true));

    {
        let mut reg = TCP_SERVER_REGISTRY.lock().unwrap();
        let map = reg.get_or_insert_with(HashMap::new);
        map.insert(
            server_id.clone(),
            TcpServerHandle {
                server_id: server_id.clone(),
                port: actual_port,
                is_running: Arc::clone(&is_running),
            },
        );
    }

    let app_clone = app.clone();
    let running_clone = Arc::clone(&is_running);

    std::thread::spawn(move || {
        while running_clone.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, addr)) => {
                    let conn_id = format!("conn-{}", Uuid::new_v4());
                    let writer_stream = match stream.try_clone() {
                        Ok(s) => s,
                        Err(_) => continue,
                    };

                    {
                        let mut reg = TCP_CONNECTION_REGISTRY.lock().unwrap();
                        let map = reg.get_or_insert_with(HashMap::new);
                        map.insert(
                            conn_id.clone(),
                            TcpConnectionHandle {
                                connection_id: conn_id.clone(),
                                writer: Arc::new(Mutex::new(writer_stream)),
                                remote_addr: addr.to_string(),
                            },
                        );
                    }

                    let _ = app_clone.emit(
                        "native-tcp-connection-state",
                        TcpConnectionStateEvent {
                            connection_id: conn_id.clone(),
                            state: "connected".to_string(),
                            message: None,
                            remote_addr: Some(addr.to_string()),
                            is_server: true,
                        },
                    );

                    spawn_reader_loop(app_clone.clone(), conn_id, stream, true);
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(50));
                }
            }
        }
    });

    Ok(TcpServerInfo {
        server_id,
        port: actual_port,
        host_display: bind_host.to_string(),
    })
}

#[tauri::command]
fn stop_tcp_server(server_id: String) -> Result<bool, String> {
    let mut reg = TCP_SERVER_REGISTRY.lock().unwrap();
    if let Some(map) = reg.as_mut() {
        if let Some(handle) = map.remove(&server_id) {
            handle.is_running.store(false, Ordering::Relaxed);
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
fn connect_tcp(app: tauri::AppHandle, host: String, port: u16) -> Result<TcpConnectResult, String> {
    if host.trim().is_empty() {
        return Err("TCP_CONNECT_FAILED: Host address cannot be empty".to_string());
    }

    let target = format!("{}:{}", host.trim(), port);
    let socket_addr: SocketAddr = target
        .parse()
        .or_else(|_| {
            use std::net::ToSocketAddrs;
            target.to_socket_addrs().and_then(|mut addrs| {
                addrs.next().ok_or_else(|| {
                    std::io::Error::new(std::io::ErrorKind::NotFound, "No address found")
                })
            })
        })
        .map_err(|e| format!("TCP_CONNECT_FAILED: Invalid target '{}': {}", target, e))?;

    let stream = TcpStream::connect_timeout(&socket_addr, Duration::from_secs(5))
        .map_err(|e| format!("TCP_CONNECT_FAILED: {}", e))?;

    let connection_id = format!("conn-{}", Uuid::new_v4());
    let writer_stream = stream
        .try_clone()
        .map_err(|e| format!("TCP_CONNECT_FAILED: {}", e))?;

    {
        let mut reg = TCP_CONNECTION_REGISTRY.lock().unwrap();
        let map = reg.get_or_insert_with(HashMap::new);
        map.insert(
            connection_id.clone(),
            TcpConnectionHandle {
                connection_id: connection_id.clone(),
                writer: Arc::new(Mutex::new(writer_stream)),
                remote_addr: target.clone(),
            },
        );
    }

    let _ = app.emit(
        "native-tcp-connection-state",
        TcpConnectionStateEvent {
            connection_id: connection_id.clone(),
            state: "connected".to_string(),
            message: None,
            remote_addr: Some(target),
            is_server: false,
        },
    );

    spawn_reader_loop(app, connection_id.clone(), stream, false);

    Ok(TcpConnectResult {
        connection_id,
        state: "connected".to_string(),
        port,
        host_display: host,
    })
}

#[tauri::command]
fn send_tcp_message(connection_id: String, bytes: Vec<u8>) -> Result<u32, String> {
    if bytes.len() > MAX_TCP_SPIKE_PAYLOAD {
        return Err(format!(
            "TCP_SEND_FAILED: Payload size ({} bytes) exceeds maximum 1 MiB limit ({})",
            bytes.len(),
            MAX_TCP_SPIKE_PAYLOAD
        ));
    }

    let writer_arc = {
        let reg = TCP_CONNECTION_REGISTRY.lock().unwrap();
        let map = reg
            .as_ref()
            .ok_or_else(|| "TCP_CONNECTION_NOT_FOUND: Registry not initialized".to_string())?;
        let handle = map
            .get(&connection_id)
            .ok_or_else(|| format!("TCP_CONNECTION_NOT_FOUND: Connection '{}' not found", connection_id))?;
        Arc::clone(&handle.writer)
    };

    let mut writer = writer_arc
        .lock()
        .map_err(|_| "TCP_SEND_FAILED: Socket lock contention".to_string())?;

    let len_prefix = (bytes.len() as u32).to_be_bytes();
    writer
        .write_all(&len_prefix)
        .map_err(|e| format!("TCP_SEND_FAILED: {}", e))?;
    writer
        .write_all(&bytes)
        .map_err(|e| format!("TCP_SEND_FAILED: {}", e))?;
    writer
        .flush()
        .map_err(|e| format!("TCP_SEND_FAILED: {}", e))?;

    Ok(bytes.len() as u32)
}

#[tauri::command]
fn disconnect_tcp(connection_id: String) -> Result<bool, String> {
    let mut reg = TCP_CONNECTION_REGISTRY.lock().unwrap();
    if let Some(map) = reg.as_mut() {
        if let Some(handle) = map.remove(&connection_id) {
            if let Ok(writer) = handle.writer.lock() {
                let _ = writer.shutdown(Shutdown::Both);
            }
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
fn get_tcp_connection_state(connection_id: String) -> Result<String, String> {
    let reg = TCP_CONNECTION_REGISTRY.lock().unwrap();
    if let Some(map) = reg.as_ref() {
        if map.contains_key(&connection_id) {
            return Ok("connected".to_string());
        }
    }
    Ok("disconnected".to_string())
}

// -----------------------------------------------------------------------------
// STEP 46: Native Local UDP Discovery Commands
// -----------------------------------------------------------------------------

#[tauri::command]
fn start_udp_discovery(
    app: tauri::AppHandle,
    multicast_group: Option<String>,
    port: Option<u16>,
) -> Result<UdpDiscoveryInfo, String> {
    let group_str = multicast_group.unwrap_or_else(|| DEFAULT_DISCOVERY_MULTICAST_V4.to_string());
    let udp_port = port.unwrap_or(DEFAULT_DISCOVERY_PORT);

    let mcast_ip: Ipv4Addr = group_str
        .parse()
        .map_err(|e| format!("DISCOVERY_CONFIG_FAILED: Invalid multicast IP: {}", e))?;

    let bind_addr = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, udp_port);
    let socket = UdpSocket::bind(bind_addr)
        .map_err(|e| format!("DISCOVERY_BIND_FAILED: Failed to bind UDP {}: {}", bind_addr, e))?;

    socket
        .join_multicast_v4(&mcast_ip, &Ipv4Addr::UNSPECIFIED)
        .map_err(|e| format!("DISCOVERY_MULTICAST_FAILED: Failed to join multicast group: {}", e))?;

    let _ = socket.set_broadcast(true);
    let _ = socket.set_read_timeout(Some(Duration::from_millis(500)));

    let socket_arc = Arc::new(socket);
    let is_running = Arc::new(AtomicBool::new(true));

    {
        let mut handle_lock = UDP_DISCOVERY_HANDLE.lock().unwrap();
        *handle_lock = Some(UdpDiscoveryHandle {
            socket: Arc::clone(&socket_arc),
            is_running: Arc::clone(&is_running),
            multicast_addr: SocketAddrV4::new(mcast_ip, udp_port),
        });
    }

    // Initialize cache
    {
        let mut cache_lock = DISCOVERED_PEERS_CACHE.lock().unwrap();
        if cache_lock.is_none() {
            *cache_lock = Some(HashMap::new());
        }
    }

    let socket_clone = Arc::clone(&socket_arc);
    let running_clone = Arc::clone(&is_running);
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; MAX_DISCOVERY_PACKET_SIZE];
        while running_clone.load(Ordering::Relaxed) {
            match socket_clone.recv_from(&mut buf) {
                Ok((len, src_addr)) => {
                    if len == 0 || len > MAX_DISCOVERY_PACKET_SIZE {
                        continue;
                    }

                    if let Ok(text) = std::str::from_utf8(&buf[..len]) {
                        if let Ok(packet) = serde_json::from_str::<DiscoveryPacket>(text) {
                            if packet.protocol == "NearShare"
                                && packet.version == "1.0"
                                && packet.packet_type == "DISCOVERY_ADVERTISEMENT"
                                && !packet.device_id.trim().is_empty()
                                && packet.tcp_port > 0
                            {
                                let now = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .map(|d| d.as_millis() as u64)
                                    .unwrap_or(0);

                                if packet.expires_at >= now {
                                    let ip_str = src_addr.ip().to_string();
                                    let peer = DiscoveredPeerPayload {
                                        device_id: packet.device_id.clone(),
                                        profile_id: packet.profile_id,
                                        device_name: packet.device_name,
                                        platform: packet.platform,
                                        ip_address: ip_str,
                                        tcp_port: packet.tcp_port,
                                        capabilities: packet.capabilities,
                                        first_seen: now,
                                        last_seen: now,
                                        expires_at: packet.expires_at,
                                    };

                                    {
                                        let mut cache_lock = DISCOVERED_PEERS_CACHE.lock().unwrap();
                                        if let Some(map) = cache_lock.as_mut() {
                                            map.insert(packet.device_id.clone(), peer.clone());
                                        }
                                    }

                                    let _ = app_clone.emit("native-udp-peer-discovered", peer);
                                }
                            }
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {
                    // Normal timeout, continue loop
                }
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(50));
                }
            }
        }
    });

    Ok(UdpDiscoveryInfo {
        multicast_group: group_str,
        port: udp_port,
        is_running: true,
    })
}

#[tauri::command]
fn stop_udp_discovery() -> Result<bool, String> {
    let mut handle_lock = UDP_DISCOVERY_HANDLE.lock().unwrap();
    if let Some(handle) = handle_lock.take() {
        handle.is_running.store(false, Ordering::Relaxed);
        let mut cache_lock = DISCOVERED_PEERS_CACHE.lock().unwrap();
        if let Some(map) = cache_lock.as_mut() {
            map.clear();
        }
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn send_discovery_advertisement(advertisement: DiscoveryPacket) -> Result<bool, String> {
    let handle_lock = UDP_DISCOVERY_HANDLE.lock().unwrap();
    let handle = handle_lock
        .as_ref()
        .ok_or_else(|| "DISCOVERY_NOT_RUNNING: UDP discovery socket is not running".to_string())?;

    let json_bytes = serde_json::to_vec(&advertisement)
        .map_err(|e| format!("DISCOVERY_SERIALIZATION_FAILED: {}", e))?;

    if json_bytes.len() > MAX_DISCOVERY_PACKET_SIZE {
        return Err(format!(
            "OVERSIZED_PACKET: Advertisement exceeds maximum {} bytes",
            MAX_DISCOVERY_PACKET_SIZE
        ));
    }

    handle
        .socket
        .send_to(&json_bytes, handle.multicast_addr)
        .map_err(|e| format!("DISCOVERY_SEND_FAILED: {}", e))?;

    Ok(true)
}

#[tauri::command]
fn get_discovered_peers() -> Result<Vec<DiscoveredPeerPayload>, String> {
    let cache_lock = DISCOVERED_PEERS_CACHE.lock().unwrap();
    if let Some(map) = cache_lock.as_ref() {
        Ok(map.values().cloned().collect())
    } else {
        Ok(Vec::new())
    }
}

// -----------------------------------------------------------------------------
// STEP 48: Native Durable Transfer Checkpoint Storage Commands
// -----------------------------------------------------------------------------

const MAX_CHECKPOINT_PAYLOAD_SIZE: usize = 512 * 1024; // 512 KiB

fn get_checkpoint_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("APP_DATA_DIR_ERROR: {}", e))?;

    let dir = base.join("checkpoints");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("CHECKPOINT_DIR_CREATE_FAILED: {}", e))?;
    }
    Ok(dir)
}

fn validate_safe_transfer_id(transfer_id: &str) -> Result<(), String> {
    let trimmed = transfer_id.trim();
    if trimmed.is_empty() {
        return Err("INVALID_TRANSFER_ID: Transfer ID cannot be empty".to_string());
    }
    if trimmed.len() > 64 {
        return Err("INVALID_TRANSFER_ID: Transfer ID exceeds maximum length of 64 characters".to_string());
    }
    if !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("INVALID_TRANSFER_ID: Transfer ID contains invalid characters. Only alphanumeric, dashes, and underscores allowed".to_string());
    }
    if trimmed.contains("..") || trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains('\0') {
        return Err("INVALID_TRANSFER_ID: Path traversal characters forbidden".to_string());
    }
    Ok(())
}

#[derive(Deserialize)]
struct RawCheckpointHeader {
    #[serde(rename = "transferId")]
    transfer_id: Option<String>,
    #[serde(rename = "checkpointVersion")]
    checkpoint_version: Option<u32>,
    status: Option<String>,
}

#[tauri::command]
fn save_transfer_checkpoint(app: tauri::AppHandle, checkpoint_json: String) -> Result<bool, String> {
    if checkpoint_json.len() > MAX_CHECKPOINT_PAYLOAD_SIZE {
        return Err(format!(
            "OVERSIZED_CHECKPOINT: Checkpoint size {} exceeds limit of {}",
            checkpoint_json.len(),
            MAX_CHECKPOINT_PAYLOAD_SIZE
        ));
    }

    let forbidden_words = ["privateKey", "sessionKey", "aesKey", "token", "pin", "password", "secret", "/Users/", "C:\\"];
    for word in forbidden_words {
        if checkpoint_json.contains(word) {
            return Err(format!("SECURITY_VIOLATION: Forbidden sensitive field '{}' detected in checkpoint", word));
        }
    }

    let header: RawCheckpointHeader = serde_json::from_str(&checkpoint_json)
        .map_err(|e| format!("CHECKPOINT_PARSE_ERROR: Invalid JSON schema: {}", e))?;

    let transfer_id = header.transfer_id
        .ok_or_else(|| "MISSING_TRANSFER_ID: Checkpoint missing transferId".to_string())?;

    validate_safe_transfer_id(&transfer_id)?;

    if let Some(v) = header.checkpoint_version {
        if v != 1 {
            return Err(format!("UNSUPPORTED_VERSION: Checkpoint version {} is unsupported (expected 1)", v));
        }
    }

    let dir = get_checkpoint_dir(&app)?;
    let final_path = dir.join(format!("{}.json", transfer_id));
    let tmp_path = dir.join(format!("{}.{}.tmp", transfer_id, Uuid::new_v4()));

    // Atomic write: write to tmp file -> flush -> sync -> rename
    {
        let mut file = std::fs::File::create(&tmp_path)
            .map_err(|e| format!("CHECKPOINT_WRITE_FAILED: Failed to create temp file: {}", e))?;
        file.write_all(checkpoint_json.as_bytes())
            .map_err(|e| format!("CHECKPOINT_WRITE_FAILED: Failed to write payload: {}", e))?;
        file.flush()
            .map_err(|e| format!("CHECKPOINT_WRITE_FAILED: Failed to flush buffers: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("CHECKPOINT_WRITE_FAILED: Failed to sync disk: {}", e))?;
    }

    std::fs::rename(&tmp_path, &final_path)
        .map_err(|e| {
            let _ = std::fs::remove_file(&tmp_path);
            format!("CHECKPOINT_RENAME_FAILED: Failed atomic rename: {}", e)
        })?;

    Ok(true)
}

#[tauri::command]
fn load_transfer_checkpoint(app: tauri::AppHandle, transfer_id: String) -> Result<Option<String>, String> {
    validate_safe_transfer_id(&transfer_id)?;
    let dir = get_checkpoint_dir(&app)?;
    let file_path = dir.join(format!("{}.json", transfer_id));

    if !file_path.exists() {
        return Ok(None);
    }

    let contents = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("CHECKPOINT_READ_FAILED: {}", e))?;

    Ok(Some(contents))
}

#[tauri::command]
fn list_incomplete_checkpoints(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = get_checkpoint_dir(&app)?;
    let read_dir = std::fs::read_dir(&dir)
        .map_err(|e| format!("CHECKPOINT_DIR_READ_FAILED: {}", e))?;

    let mut results = Vec::new();
    for entry_res in read_dir {
        if let Ok(entry) = entry_res {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "json" {
                        if let Ok(contents) = std::fs::read_to_string(&path) {
                            if let Ok(header) = serde_json::from_str::<RawCheckpointHeader>(&contents) {
                                if let Some(status) = header.status.as_deref() {
                                    if status != "completed" && status != "cancelled" {
                                        results.push(contents);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}

#[tauri::command]
fn delete_transfer_checkpoint(app: tauri::AppHandle, transfer_id: String) -> Result<bool, String> {
    validate_safe_transfer_id(&transfer_id)?;
    let dir = get_checkpoint_dir(&app)?;
    let file_path = dir.join(format!("{}.json", transfer_id));

    let mut deleted = false;
    if file_path.exists() {
        let _ = std::fs::remove_file(file_path);
        deleted = true;
    }

    // Clean up any stray tmp files for this transfer_id
    if let Ok(read_dir) = std::fs::read_dir(&dir) {
        for entry_res in read_dir {
            if let Ok(entry) = entry_res {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with(&transfer_id) && name.ends_with(".tmp") {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    Ok(deleted)
}

// -----------------------------------------------------------------------------
// Step 51: Desktop Shell Lifecycle & Tray Management Commands
// -----------------------------------------------------------------------------

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::WindowEvent;

#[tauri::command]
fn show_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
fn hide_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
fn update_tray_status(
    app_handle: tauri::AppHandle,
    status: String,
    active_count: u32,
    tooltip: Option<String>,
) -> Result<(), String> {
    if let Some(tray) = app_handle.tray_by_id("main_tray") {
        let display_tooltip = tooltip.unwrap_or_else(|| {
            if active_count > 0 {
                format!("NearShare - {} ({} active)", status, active_count)
            } else {
                format!("NearShare - {}", status)
            }
        });
        let _ = tray.set_tooltip(Some(display_tooltip));
    }
    // Also emit tray status update event to webview
    let _ = app_handle.emit(
        "tray_status_updated",
        serde_json::json!({
            "status": status,
            "activeCount": active_count
        }),
    );
    Ok(())
}

#[tauri::command]
fn send_desktop_notification(
    app_handle: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    // Sanitize title and body bounds
    let safe_title = if title.len() > 100 { &title[..100] } else { &title };
    let safe_body = if body.len() > 250 { &body[..250] } else { &body };

    let _ = app_handle.emit(
        "desktop_notification",
        serde_json::json!({
            "title": safe_title,
            "body": safe_body,
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        }),
    );
    Ok(())
}

#[tauri::command]
fn quit_application(app_handle: tauri::AppHandle) -> Result<(), String> {
    app_handle.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create System Tray Menu
            let title_item = MenuItem::with_id(app, "title", "NearShare v0.1.0", false, None::<&str>)?;
            let status_item = MenuItem::with_id(app, "status", "Status: Idle", false, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let open_item = MenuItem::with_id(app, "open", "Open NearShare", true, None::<&str>)?;
            let new_transfer_item = MenuItem::with_id(app, "new_transfer", "New Transfer", true, None::<&str>)?;
            let transfers_item = MenuItem::with_id(app, "transfers", "Transfers", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit NearShare", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &title_item,
                    &status_item,
                    &sep1,
                    &open_item,
                    &new_transfer_item,
                    &transfers_item,
                    &settings_item,
                    &sep2,
                    &quit_item,
                ],
            )?;

            let _tray = TrayIconBuilder::with_id("main_tray")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .tooltip("NearShare - Fast, Local-First File Transfer")
                .on_menu_event(|app, event| {
                    let id_str = event.id().as_ref();
                    match id_str {
                        "open" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit("tray_navigate", "home");
                        }
                        "new_transfer" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit("tray_navigate", "new_transfer");
                        }
                        "transfers" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit("tray_navigate", "queue");
                        }
                        "settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit("tray_navigate", "settings");
                        }
                        "quit" => {
                            // Emit quit requested to frontend for safe shutdown & checkpoint flush
                            let _ = app.emit("app_quit_requested", ());
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Intercept close: hide window instead of terminating process
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_runtime_diagnostics,
            pick_files,
            create_native_file,
            read_native_file_chunk,
            write_native_file_chunk,
            get_native_file_size,
            close_native_file,
            pick_folder,
            scan_native_folder,
            close_native_folder,
            start_tcp_server,
            stop_tcp_server,
            connect_tcp,
            send_tcp_message,
            disconnect_tcp,
            get_tcp_connection_state,
            start_udp_discovery,
            stop_udp_discovery,
            send_discovery_advertisement,
            get_discovered_peers,
            save_transfer_checkpoint,
            load_transfer_checkpoint,
            list_incomplete_checkpoints,
            delete_transfer_checkpoint,
            show_main_window,
            hide_main_window,
            update_tray_status,
            send_desktop_notification,
            quit_application,
            macos_direct::direct_macos_init,
            macos_direct::direct_macos_get_capabilities,
            macos_direct::direct_macos_start_discovery,
            macos_direct::direct_macos_stop_discovery,
            macos_direct::direct_macos_start_advertising,
            macos_direct::direct_macos_stop_advertising,
            macos_direct::direct_macos_invite_peer,
            macos_direct::direct_macos_accept_invitation,
            macos_direct::direct_macos_open_stream,
            macos_direct::direct_macos_send_bytes,
            macos_direct::direct_macos_close_stream,
            macos_direct::direct_macos_disconnect,
            macos_direct::direct_macos_teardown,
            macos_direct::direct_macos_self_test,
            windows_direct::direct_windows_init,
            windows_direct::direct_windows_get_capabilities,
            windows_direct::direct_windows_start_discovery,
            windows_direct::direct_windows_stop_discovery,
            windows_direct::direct_windows_start_advertising,
            windows_direct::direct_windows_stop_advertising,
            windows_direct::direct_windows_connect,
            windows_direct::direct_windows_disconnect,
            windows_direct::direct_windows_open_stream,
            windows_direct::direct_windows_close_stream,
            windows_direct::direct_windows_send_bytes,
            windows_direct::direct_windows_get_connection_state,
            windows_direct::direct_windows_self_test,
            android_direct::direct_android_init,
            android_direct::direct_android_get_capabilities,
            android_direct::direct_android_get_connection_state,
            android_direct::direct_android_start_discovery,
            android_direct::direct_android_stop_discovery,
            android_direct::direct_android_start_advertising,
            android_direct::direct_android_stop_advertising,
            android_direct::direct_android_connect,
            android_direct::direct_android_disconnect,
            android_direct::direct_android_open_stream,
            android_direct::direct_android_close_stream,
            android_direct::direct_android_send_bytes,
            android_direct::direct_android_self_test,
            ios_direct::direct_ios_init,
            ios_direct::direct_ios_get_capabilities,
            ios_direct::direct_ios_get_connection_state,
            ios_direct::direct_ios_start_discovery,
            ios_direct::direct_ios_stop_discovery,
            ios_direct::direct_ios_start_advertising,
            ios_direct::direct_ios_stop_advertising,
            ios_direct::direct_ios_invite_peer,
            ios_direct::direct_ios_accept_invitation,
            ios_direct::direct_ios_reject_invitation,
            ios_direct::direct_ios_connect,
            ios_direct::direct_ios_disconnect,
            ios_direct::direct_ios_open_stream,
            ios_direct::direct_ios_close_stream,
            ios_direct::direct_ios_send_bytes,
            ios_direct::direct_ios_receive_bytes,
            ios_direct::direct_ios_self_test
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

