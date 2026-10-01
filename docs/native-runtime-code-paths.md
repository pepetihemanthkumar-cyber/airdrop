# NearShare Native Runtime Code Paths & Byte Flow

> Traces the exact control flow, memory buffers, cryptographic operations, and socket/stream transport paths across NearShare subsystems.

---

## 1. End-to-End File Transfer Byte Path (macOS / Windows LAN Mode)

```mermaid
sequenceDiagram
    autonumber
    participant UI as React UI (TransferComposer)
    participant Q as TransferQueueContext
    participant TM as TransportManager
    participant NTM as NativeTransportManager
    participant CS as ChunkStream / FileEngine
    participant SS as SecureTransportSession
    participant NP as NativeTcpProtocolPeer
    participant IPC as Tauri IPC (invoke)
    participant Rust as Rust Tokio / std::net (lib.rs)
    participant Wire as TCP Socket (Port 52140+)
    participant Disk as Host OS Filesystem (std::fs)

    UI->>Q: User selects files & clicks "Send"
    Q->>TM: createTransfer(transferItem)
    TM->>NTM: resolveTransport({ mode: 'wifi', platform: 'macOS' })
    NTM->>NP: connect(remoteIp, remotePort)
    NP->>IPC: invoke('tcp_spike_connect', { targetAddress })
    IPC->>Rust: TcpStream::connect(addr)
    Rust-->>NP: Connection Established (connection_id)

    Note over NP,SS: Step A: Handshake & Cryptographic Key Agreement
    NP->>SS: establishSession(peerIdentityKey)
    SS-->>NP: Derived AES-256-GCM Session Keys (HKDF-SHA256)

    Note over CS,Disk: Step B: File Chunk Streaming & Encryption
    CS->>Disk: native_fs_read_chunk(fileId, offset, 4 MiB)
    Disk-->>CS: Raw File Bytes (Uint8Array)
    CS->>SS: encryptFrame(SecureFrameType.CHUNK_DATA, rawBytes, seqNum)
    SS-->>CS: Encrypted AEAD Envelope + Auth Tag (16B)
    CS->>NP: sendProtocolMessage(CHUNK_DATA, encryptedPayload)
    NP->>IPC: invoke('tcp_spike_send_data', { connectionId, 4-byte BE length + packet })
    IPC->>Rust: writer.write_all(framedBytes)
    Rust->>Wire: TCP Wire Transmission

    Note over Wire,Disk: Step C: Receiving, Decryption & Disk Commit
    Wire->>Rust: Remote TCP socket receives bytes
    Rust->>IPC: emit('tcp_spike_data_received', { dataBase64 })
    IPC->>NP: onData(framedBytes)
    NP->>SS: decryptFrame(encryptedEnvelope, expectedSeqNum)
    SS-->>NP: Decrypted Plaintext Chunk
    NP->>Disk: native_fs_write_chunk(destinationPath, offset, chunkBytes)
    Disk-->>NP: Chunk written & flushed (std::fs::File.sync_data())
    NP->>CS: sendProtocolMessage(CHUNK_ACK, { chunkIndex, committedOffset })
```

---

## 2. End-to-End File Transfer Byte Path (macOS Direct Mode — Multipeer / AWDL)

```mermaid
sequenceDiagram
    autonumber
    participant UI as React UI (TransferComposer)
    participant Q as TransferQueueContext
    participant TM as TransportManager
    participant DTA as DirectTransportAdapter
    participant DMB as MacOSDirectPeerBridge
    participant IPC as Tauri IPC (invoke)
    participant Rust as Rust Bridge (macos_direct.rs)
    participant Swift as Swift Static Lib (NearShareDirectSession)
    participant Apple as Apple Multipeer / Network (MCSession Stream)
    participant SS as SecureTransportSession
    participant CS as FileEngine / ChunkStream

    UI->>Q: User selects Direct Mode & target Mac peer
    Q->>TM: createTransfer(transferItem)
    TM->>DTA: connect(directPeerId)
    DTA->>DMB: connect(directPeerId)
    DMB->>IPC: invoke('direct_macos_invite_peer', { peerId })
    IPC->>Rust: nearshare_direct_invite_peer(c_peer_id)
    Rust->>Swift: NearShareDirectSession.shared.invitePeer(...)
    Swift->>Apple: MCNearbyServiceBrowser.invitePeer(...)
    Apple-->>Swift: MCSessionDelegate state -> .connected
    DMB->>IPC: invoke('direct_macos_open_stream', { peerId })
    IPC->>Rust: nearshare_direct_open_stream(c_peer_id, ...)
    Rust->>Swift: NearShareDirectSession.shared.openStream(...)
    Swift->>Apple: MCSession.startStream(withName:toPeer:) -> NSOutputStream

    Note over CS,SS: Encryption & Framing
    CS->>SS: encryptFrame(CHUNK_DATA, rawBytes, seqNum)
    SS-->>CS: Encrypted AEAD Envelope (AES-256-GCM)
    CS->>DMB: sendBytes(connectionId, base64Payload)
    DMB->>IPC: invoke('direct_macos_send_bytes', { connectionId, bytesBase64 })
    IPC->>Rust: nearshare_direct_send_bytes(conn_id, data_ptr, len)
    Rust->>Swift: NearShareDirectSession.shared.sendBytes(...)
    Swift->>Apple: NSOutputStream.write(buffer, maxLength)
    Apple->>Apple: AWDL / Ad-hoc Wi-Fi Frame Emission
```

---

## 3. Storage & Checkpoint Atomic Path

```
Transfer in progress...
       ↓
Committed ByteRange merged ([0..524288] + [524288..1048576] -> [0..1048576])
       ↓
ResumeCheckpoint serialized to JSON
       ↓
Tauri IPC: `native_fs_atomic_replace(targetPath, checkpointJson)`
       ↓
Rust: Write to temporary file `<targetPath>.<uuid>.tmp`
       ↓
Rust: `std::fs::File::sync_all()`
       ↓
Rust: `std::fs::rename(tmpPath, targetPath)` (Atomic OS replacement)
       ↓
Checkpoint safely committed on disk without corruption risk
```
