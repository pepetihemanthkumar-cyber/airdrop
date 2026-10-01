# NearShare Transfer Stress Testing & Verification Taxonomy

## 1. Test Category Taxonomy

To maintain absolute testing honesty, NearShare categorizes every verification scenario into one of four distinct tiers:

1. **DETERMINISTIC TEST**: Synthetic in-memory verification using deterministic clocks, fixed byte streams, and sparse file representations. Tests algorithms, boundaries, error handling, state machines, and resource limits without physical network interaction.
2. **LOCALHOST TEST**: Local TCP loopback (`127.0.0.1`) socket verification. Tests multi-threaded IPC, Tokio async runtime, and local socket framing.
3. **LAN TEST**: Local Wi-Fi router / subnet network testing across two devices connected to the same WLAN.
4. **PHYSICAL DEVICE TEST**: Pure off-grid direct radio testing (AWDL or Wi-Fi Direct) between two distinct physical devices without any external router or internet.

---

## 2. Step 60 Stress Testing Suite Summary

The Step 60 hardening test suite adds 25 deterministic stress tests (`STRESS-001` through `STRESS-025`):

- **Large Manifests**: 20,000-file folder trees with Unicode, nested directories, and duplicate names.
- **Queue Scaling**: 100 queued items with deterministic ordering and single active concurrency.
- **Backpressure**: Producer stalling when in-flight chunk permits reach 16 chunks / 64 MiB.
- **Interruption & Resumption**: Multi-file checkpoint resumption where completed files are skipped and partial files resume from missing byte ranges.
- **Integrity & Security**: Rejection of tampered final digests and sequence violations.
- **Memory Invariants**: Validation that buffer allocations stay strictly within configured limits.
