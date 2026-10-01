# NearShare macOS Direct Mode: Two-Device Physical Validation Runbook

## Objective
Provide a step-by-step, reproducible physical test procedure for validating the native `MultipeerConnectivity` Direct Mode transport when two physical Apple Silicon / Intel macOS devices are available.

---

## Equipment & Requirements

| Item | Requirement |
|:---|:---|
| **Device A (Host/Sender)** | Physical Mac (macOS 13+), Wi-Fi & Bluetooth enabled |
| **Device B (Peer/Receiver)** | Physical Mac (macOS 13+), Wi-Fi & Bluetooth enabled |
| **NearShare Build** | Synchronized production build (v0.1.0+) running native Swift binary |
| **Network State** | Wi-Fi disconnected from local router OR isolated test subnet (Direct mode relies on Apple P2P radio) |
| **Permissions** | Local Network permission granted on both devices |

---

## Step-by-Step Validation Procedure

### Phase 1: Preparation & Setup
1. **Launch on Mac A**:
   - Start the NearShare desktop application.
   - Open Developer Direct Validation Inspector (click **DIRECT VALIDATOR** floating badge or press `Cmd+Opt+D`).
   - Select **ROLE**: `SENDER`.
   - Select **ENVIRONMENT**: `physicalDirect`.

2. **Launch on Mac B**:
   - Start NearShare desktop application.
   - Open Developer Direct Validation Inspector.
   - Select **ROLE**: `RECEIVER`.
   - Select **ENVIRONMENT**: `physicalDirect`.

### Phase 2: Over-the-Air Discovery & Pairing
1. On **Mac A**, click **Start Direct Discovery** (`direct_macos_start_discovery`).
2. On **Mac B**, click **Start Direct Discovery** (starts advertising `nearshare-p2p` Bonjour service).
3. Confirm **DIRECT-PHYS-001 (Peer Discovery)**: Mac A detects Mac B in discovered peer list.
4. Confirm **DIRECT-PHYS-002 (Peer Invitation)**: Mac A invites Mac B; Mac B auto-accepts invitation based on trust state.
5. Confirm **DIRECT-PHYS-003 (Pairing)** & **DIRECT-PHYS-004 (Secure Session)**: NearShare cryptographic ECDH key agreement succeeds; ephemeral `connectionId` and `secureSessionId` are established.

### Phase 3: Boundary & Stream Transfer Validation
1. **DIRECT-PHYS-005 (0-byte file)**: Send empty file; verify 0-byte file created atomically on Mac B.
2. **DIRECT-PHYS-006 (1-byte file)**: Send 1-byte file; verify stream reads single byte correctly.
3. **DIRECT-PHYS-007 (4 KiB file)**: Send 4 KiB block; verify frame parsing and integrity.
4. **DIRECT-PHYS-008 (1 MiB file)**: Send 1 MiB chunked payload.
5. **DIRECT-PHYS-009 (100 MiB file)**: Execute streaming payload; observe throughput telemetry and backpressure controller.
6. **DIRECT-PHYS-011 (Nested Folder)**: Send directory with nested subfolders and Unicode files; verify relative hierarchy preservation without path traversal.
7. **DIRECT-PHYS-021 (SHA-256 Integrity)**: Verify sender SHA-256 matches receiver written file SHA-256.

### Phase 4: Interruption, Control & Recovery
1. **DIRECT-PHYS-015 / 016 (Pause & Resume)**: Pause transfer at ~50%; verify producer halts without stream disconnect; resume to 100%.
2. **DIRECT-PHYS-018 / 020 (Disconnect & Resume)**:
   - Begin 100 MiB transfer.
   - Turn off Wi-Fi/Bluetooth on Mac B at ~40%.
   - Verify transfer enters recoverable state with identical `transferId`.
   - Re-enable radio; re-establish Direct stream; verify new `connectionId` and receiver-authoritative range completion.
3. **DIRECT-PHYS-017 (Cancellation)**: Cancel transfer; verify stream closes immediately and resources drain.

### Phase 5: Security & Fail-Closed Scenarios
1. **DIRECT-PHYS-023 (Blocked Peer)**: Add Mac B device ID to blocked list; verify incoming connection is rejected immediately.
2. **DIRECT-PHYS-027 (Corrupted Ciphertext)**: Inject corrupted byte; verify AES-GCM AEAD tag check fails and connection closes immediately.

### Phase 6: Report Generation
1. In the Inspector on Mac A, click **Export Report (JSON)** and **Copy MD**.
2. Save report to `docs/macos-direct-physical-results.md` recording actual measured throughput and device hardware specifics.
