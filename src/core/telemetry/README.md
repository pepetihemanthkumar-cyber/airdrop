# NearShare Real-Time Telemetry & Connection Diagnostics

This directory contains NearShare's transport-independent telemetry, throughput calculation, latency estimation, and connection stability diagnostic layer.

## Architecture & Principles

1. **Reality-Based Measurement**:
   - Zero manufactured speed values.
   - All throughput, latency, and reliability metrics are derived exclusively from concrete wire events, heartbeat RTTs, and chunk acknowledgments.
2. **Explicit Transport Separation**:
   - Direct Mode (`transportMode = 'direct'`) and Wi-Fi Mode (`transportMode = 'wifi'`) are strictly distinct product modes.
   - Failures in Direct Mode trigger re-pairing or user-explicit switching — NEVER silent background fallback.
3. **Bounded Memory Retention**:
   - Live samples use sliding time windows (max 60 high-resolution snapshots).
   - Completed transfers produce a lightweight `AggregatedTransferSummary` for transfer history.
4. **Privacy & Security**:
   - Telemetry strictly excludes filesystem paths, private keys, authentication tokens, pairing secrets, or file payloads.
