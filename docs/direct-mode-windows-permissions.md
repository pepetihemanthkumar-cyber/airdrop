# NearShare — Windows Direct Mode Security, Permissions & Background Limitations

## 1. Windows Firewall Architecture

When establishing a native Wi-Fi Direct connection on Windows 10/11, Windows creates an ephemeral virtual network adapter (typically named `Local Area Connection* X` or `Wi-Fi Direct Virtual Adapter`).

### Key Firewall Constraints:
1. **Network Profile Assignment**:
   - The virtual Wi-Fi Direct adapter is assigned a private or unidentified network profile.
   - If Windows Firewall blocks inbound connections on Public or Unidentified networks, incoming `StreamSocketListener` connections will fail silently unless an explicit application firewall exception exists.
2. **Application-Level Rule (Recommended)**:
   - NSIS installer or initial application launch should register an authorized application rule for `NearShare.exe` (`netsh advfirewall firewall add rule name="NearShare Direct" dir=in action=allow program="<InstallDir>\NearShare.exe" enable=yes`).
   - Do **NOT** disable Windows Firewall globally or open all ports indiscriminately.
3. **Zero-Admin Fallback**:
   - If the user is running without administrative privileges (Standard User), NearShare operates as a Wi-Fi Direct client connecting outbound to an autonomous Group Owner, avoiding inbound listening firewall prompts.

---

## 2. Windows Permissions & App Capabilities

### MSIX / AppX Capability Manifest (`Package.appxmanifest`):
```xml
<Capabilities>
  <Capability Name="internetClient" />
  <Capability Name="internetClientServer" />
  <Capability Name="privateNetworkClientServer" />
  <DeviceCapability Name="wiFiDirect" />
</Capabilities>
```

### Win32 / Desktop App (NSIS Installer):
- Does not use AppX sandboxing capabilities.
- Accesses Wi-Fi Direct via WinRT desktop interop (`RoInitialize` / `RoActivateInstance` / C++/WinRT headers).
- Requires device Wi-Fi radio powered ON and Wi-Fi adapter driver supporting WDI / NDIS 6.50+ Wi-Fi Direct.

---

## 3. Windows Background Execution & Power Lifecycle

| Execution State | Behavior in Windows Direct Mode | NearShare Mitigation |
| :--- | :--- | :--- |
| **Active Foreground** | Full CPU and 5GHz Wi-Fi throughput (20–80 MB/s). | Standard active transfer streaming. |
| **Window Hidden / Minimized to Tray** | Process continues running at normal priority. | Handled via Tauri `hideMainWindow()` and `DesktopLifecycleManager`. |
| **Modern Standby / Connected Standby** | OS may throttle background network sockets or power down Wi-Fi radio. | NearShare requests `PowerCreateRequest` (`POWER_REQUEST_TYPE_SYSTEM_REQUIRED`) during active transfer. |
| **System Sleep / Lid Closed** | Sockets disconnect immediately when the device enters sleep state. | Atomic checkpointing saves byte offset; user can resume upon wake. |
| **Process Crash / Hard Reboot** | Active in-memory buffers lost; filesystem flushed. | Receiver-authoritative resume inspects disk chunk headers and resumes transfer. |

---

## 4. Technical Honesty Invariant

- Background transfer is classified as **`restricted`** on Windows because Modern Standby and aggressive battery savers can terminate ad-hoc peer links without warning.
- Checkpointed resume (`supportsResume: 'supported'`) guarantees data safety across disconnections without promising uninterrupted sleep-mode transfers.
