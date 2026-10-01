# NearShare Desktop Release Validation & Production Boundary Protocol

## 1. Release Quality Gates

Every candidate desktop release must successfully pass all seven automated quality gates before artifact publication:

```
[Gate 1] Version Parity Check (`npm run validate:version <tag>`)
        ↓
[Gate 2] Secret & Credential Scan (`npm run check:secrets`)
        ↓
[Gate 3] Deterministic Test Suite (`npm test` — 545+ tests)
        ↓
[Gate 4] Linter & Type Safety (`npm run lint` & `tsc -b`)
        ↓
[Gate 5] Production Frontend Compilation (`vite build`)
        ↓
[Gate 6] Rust Native Backend Compilation (`cargo check` & `cargo build`)
        ↓
[Gate 7] Artifact Checksum & Manifest Verification (`npm run manifest:verify`)
```

---

## 2. Production vs. Development Boundary Invariants

| Component / Feature | Development Mode (`import.meta.env.DEV`) | Production Mode (`import.meta.env.PROD`) |
| :--- | :--- | :--- |
| **Protocol Inspector** | Enabled in developer view for inspecting framed messages. | Stripped / Excluded from production view tree. |
| **Direct Mode Inspector** | Enabled for radio debugging and simulated peer injection. | Excluded from production view tree. |
| **Telemetry Inspector** | Enabled for sliding-window and RTT metric inspection. | Excluded from production view tree. |
| **File Engine Inspector** | Enabled for chunk stream and buffer inspection. | Excluded from production view tree. |
| **Test Pairing PIN** | Fixed dev PIN (`482 917`) permitted for mock automated flows. | Strictly forbidden; dynamic SAS pairing required. |
| **Mock Transport Fallback** | Allowed for in-memory developer testing. | Blocked; returns `requiresNative` or `unsupported` on missing hardware. |
| **Native Transport Harness** | Available for simulated fault injection in tests. | Never instantiated in production runtime. |

---

## 3. Evidence-Based Release Verification Checklist

- [ ] All 7 automated quality gates exit with status code 0.
- [ ] Application metadata displays `NearShare` version `0.1.0`.
- [ ] Checksum verification (`npm run manifest:verify`) passes with 0 mismatches and 0 missing artifacts.
- [ ] No debug inspectors, stack traces, or raw error codes leaked to end-user UI.
- [ ] Physical device validation limitations clearly documented in release notes.
