# NearShare Real-Time Transfer Telemetry & Connection Diagnostics Architecture

## 1. Overview & Core Tenets

NearShare's telemetry layer provides accurate, real-time diagnostic visibility into transfer throughput, round-trip latency, connection stability, retry rates, and estimated completion times across all supported platforms (macOS, Windows, Android, iOS, Web).

### Key Architectural Tenets:
1. **Reality-Based Measurement**: Speeds and latencies are computed exclusively from observed byte movements and protocol timing. Telemetry never manufactures artificial metrics.
2. **Transport Independence**: The telemetry model is completely decoupled from whether bytes move over native Apple AWDL, Windows/Android Wi-Fi Direct, TCP sockets, or mock adapters.
3. **Strict Transport Mode Separation**: Direct Mode and Wi-Fi Mode are distinct product choices. If Direct Mode fails, NearShare reports connection degradation or failure — it **NEVER** silently falls back to Wi-Fi/LAN.
4. **Bounded Memory Retention**: Real-time sliding windows retain at most 60 high-resolution snapshots, aggregating into lightweight summaries on transfer completion.
5. **Zero Secret Leakage**: File contents, absolute filesystem paths, ECDH private keys, pairing PINs, and authentication tokens are strictly barred from telemetry records.

---

## 2. Event Pipeline

```
  Native Transport (AWDL / Wi-Fi Direct / TCP Socket)
                         ↓
  TransportAdapter / ProtocolStateMachine Events
                         ↓
       TelemetryCollector (`startTransferSession`)
                         ↓
  ThroughputEstimator  |  LatencyEstimator  |  StabilityEstimator
                         ↓
       TransferTelemetry Snapshot (Every Chunk / 500ms)
                         ↓
            TelemetryManager (Singleton Hub)
                         ↓
       ConnectionHealthContext (React State Synchronizer)
                         ↓
  UI: TransferProgressVessel | ConnectionHealthPanel | TelemetryInspector
```

---

## 3. Metric Calculations

### 3.1 Throughput Estimation (Sliding Window)
- **Instantaneous Speed ($S_{\text{inst}}$)**: Calculated as $\frac{\Delta \text{Bytes}}{\Delta \text{Time}}$ between the two most recent samples. Decays to 0 if no progress occurs within the sliding window duration.
- **Rolling Average Speed ($S_{\text{avg}}$)**: Sum of all byte deltas within the active 5-second window divided by total window elapsed time:
  $$S_{\text{avg}} = \frac{\sum_{i \in W} \Delta B_i}{t_{\text{now}} - t_{\text{oldest}}}$$
- **Peak Speed ($S_{\text{peak}}$)**: Monotonically tracked maximum instantaneous speed observed throughout the transfer session.
- **Zero & Large File Safety**: 0-byte transfers report 0 speed and 0 remaining time; $>4\text{ GB}$ transfers use safe float arithmetic without 32-bit integer overflow.

### 3.2 Latency Estimation (RTT)
- **Sample Origin**: Derived from protocol heartbeats (`HEARTBEAT_ACK`) and chunk acknowledgments (`CHUNK_ACK`). React rendering cycles are completely excluded.
- **Rolling RTT (EMA)**: Exponential moving average with smoothing factor $\alpha = 0.25$:
  $$\text{RTT}_{\text{rolling}} = \alpha \cdot \text{RTT}_{\text{new}} + (1 - \alpha) \cdot \text{RTT}_{\text{prev}}$$
- **Min / Max / Average**: Continuously updated across the active connection.

### 3.3 Connection Stability Assessment
Connection health is classified into 6 discrete states:
1. `stable`: Normal operation, score $\ge 80$.
2. `degraded`: Moderate packet retries or recovery in progress, score $50 \le \text{score} < 80$.
3. `unstable`: Severe retries, high latency jitter ($>80\text{ ms}$), score $< 50$.
4. `reconnecting`: Link severed; active transport reconnect in progress.
5. `disconnected`: Socket closed by peer or user.
6. `failed`: Fatal unrecoverable transport or protocol error.

**Score Heuristic Calculation**:
- Starts at 100.
- $-5$ per chunk retry.
- $-15$ per chunk transmission failure.
- $-20$ per reconnect attempt.
- $-3$ per high latency jitter spike ($>80\text{ ms}$).
- $+2$ recovery per 5 consecutive successful chunks without incident (clamped to 100).

### 3.4 Estimated Time Remaining (ETA)
$$\text{ETA}_{\text{ms}} = \begin{cases} 
0 & \text{if } \text{Bytes}_{\text{completed}} \ge \text{Bytes}_{\text{total}} \\ 
\text{null (Unknown)} & \text{if } S_{\text{avg}} \le 0 \\ 
\frac{\text{Bytes}_{\text{remaining}}}{S_{\text{avg}}} \times 1000 & \text{otherwise} 
\end{cases}$$

---

## 4. Transfer History & Recovery Integration

### 4.1 History Aggregation
Upon transfer completion, `TelemetryCollector.completeTransfer()` produces an `AggregatedTransferSummary` containing:
- Duration in ms
- Total bytes transferred
- True average speed over total duration
- Peak speed
- Average latency
- Reconnect count & retry count
- Integrity failure count

Raw sample arrays are purged from memory, keeping transfer history storage lightweight.

### 4.2 Recovery Manager Integration
When `TransferSessionRecoveryManager` triggers a resume after connection interruption, a `RecoveryTelemetryRecord` logs:
- Interruption timestamp
- Bytes completed at interruption
- Resume timestamp
- Reconnect attempts
- Total recovery duration in ms

---

## 5. Direct Mode vs. Wi-Fi Separation Invariants

| Dimension | Direct Mode (`transportMode = 'direct'`) | Wi-Fi Mode (`transportMode = 'wifi'`) |
| :--- | :--- | :--- |
| **Physical Layer** | AWDL (Apple) / Wi-Fi Direct (Win/Android) | Local Router Infrastructure / LAN |
| **Telemetry Identifier** | `transportMode = 'direct'` | `transportMode = 'wifi'` |
| **On Disconnect** | Reports `disconnected` or `reconnecting`; prompts user retry | Reports `disconnected` or `reconnecting`; prompts user retry |
| **Automatic Fallback** | **STRICTLY FORBIDDEN** | **STRICTLY FORBIDDEN** |
| **Mode Switching** | Explicit user confirmation only | Explicit user confirmation only |
