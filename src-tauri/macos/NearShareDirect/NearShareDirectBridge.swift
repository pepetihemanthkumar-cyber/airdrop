//
//  NearShareDirectBridge.swift
//  NearShare macOS Native Direct Mode Module
//
//  C-ABI FFI Entry points for Tauri Rust Native Integration.
//

import Foundation

@_cdecl("nearshare_direct_init")
public func nearshare_direct_init(
    displayName: UnsafePointer<CChar>?,
    deviceId: UnsafePointer<CChar>?
) -> Bool {
    let name = displayName != nil ? String(cString: displayName!) : "NearShare macOS"
    let devId = deviceId != nil ? String(cString: deviceId!) : UUID().uuidString

    NearShareDirectSession.shared.configureLocalIdentity(displayName: name, deviceId: devId)
    return true
}

@_cdecl("nearshare_direct_register_callbacks")
public func nearshare_direct_register_callbacks(
    onPeerDiscovered: PeerDiscoveredCallback?,
    onPeerLost: PeerLostCallback?,
    onInvitationReceived: InvitationReceivedCallback?,
    onConnectionStateChanged: ConnectionStateCallback?,
    onStreamOpened: StreamOpenedCallback?,
    onDataReceived: DataReceivedCallback?,
    onStreamClosed: StreamClosedCallback?
) {
    let session = NearShareDirectSession.shared
    session.onPeerDiscovered = onPeerDiscovered
    session.onPeerLost = onPeerLost
    session.onInvitationReceived = onInvitationReceived
    session.onConnectionStateChanged = onConnectionStateChanged
    session.onStreamOpened = onStreamOpened
    session.onDataReceived = onDataReceived
    session.onStreamClosed = onStreamClosed
}

@_cdecl("nearshare_direct_start_advertising")
public func nearshare_direct_start_advertising(serviceType: UnsafePointer<CChar>?) -> Bool {
    let svc = serviceType != nil ? String(cString: serviceType!) : NearShareDirectSession.defaultServiceType
    return NearShareDirectSession.shared.startAdvertising(serviceType: svc)
}

@_cdecl("nearshare_direct_stop_advertising")
public func nearshare_direct_stop_advertising() {
    NearShareDirectSession.shared.stopAdvertising()
}

@_cdecl("nearshare_direct_start_discovery")
public func nearshare_direct_start_discovery(serviceType: UnsafePointer<CChar>?) -> Bool {
    let svc = serviceType != nil ? String(cString: serviceType!) : NearShareDirectSession.defaultServiceType
    return NearShareDirectSession.shared.startDiscovery(serviceType: svc)
}

@_cdecl("nearshare_direct_stop_discovery")
public func nearshare_direct_stop_discovery() {
    NearShareDirectSession.shared.stopDiscovery()
}

@_cdecl("nearshare_direct_invite_peer")
public func nearshare_direct_invite_peer(peerId: UnsafePointer<CChar>?) -> Bool {
    guard let peerId = peerId else { return false }
    return NearShareDirectSession.shared.invitePeer(peerId: String(cString: peerId))
}

@_cdecl("nearshare_direct_accept_invitation")
public func nearshare_direct_accept_invitation(invitationId: UnsafePointer<CChar>?, accept: Bool) -> Bool {
    guard let invitationId = invitationId else { return false }
    return NearShareDirectSession.shared.acceptInvitation(invitationId: String(cString: invitationId), accept: accept)
}

@_cdecl("nearshare_direct_open_stream")
public func nearshare_direct_open_stream(peerId: UnsafePointer<CChar>?, streamName: UnsafePointer<CChar>?, outConnId: UnsafeMutablePointer<CChar>?, maxLen: Int32) -> Bool {
    guard let peerId = peerId, let outConnId = outConnId else { return false }
    let sName = streamName != nil ? String(cString: streamName!) : "nearshare-stream"
    guard let connId = NearShareDirectSession.shared.openDataStream(peerId: String(cString: peerId), streamName: sName) else {
        return false
    }

    connId.withCString { cStr in
        strncpy(outConnId, cStr, Int(maxLen - 1))
        outConnId[Int(maxLen - 1)] = 0
    }
    return true
}

@_cdecl("nearshare_direct_send_bytes")
public func nearshare_direct_send_bytes(connectionId: UnsafePointer<CChar>?, bytes: UnsafePointer<UInt8>?, length: Int32) -> Int32 {
    guard let connectionId = connectionId, let bytes = bytes, length > 0 else { return -1 }
    let data = Data(bytes: bytes, count: Int(length))
    let written = NearShareDirectSession.shared.sendBytes(connectionId: String(cString: connectionId), data: data)
    return Int32(written)
}

@_cdecl("nearshare_direct_close_stream")
public func nearshare_direct_close_stream(connectionId: UnsafePointer<CChar>?) {
    guard let connectionId = connectionId else { return }
    NearShareDirectSession.shared.closeStream(connectionId: String(cString: connectionId))
}

@_cdecl("nearshare_direct_disconnect")
public func nearshare_direct_disconnect() {
    NearShareDirectSession.shared.disconnect()
}

@_cdecl("nearshare_direct_teardown")
public func nearshare_direct_teardown() {
    NearShareDirectSession.shared.teardown()
}

@_cdecl("nearshare_direct_self_test")
public func nearshare_direct_self_test() -> Bool {
    return NearShareDirectSession.shared.runSelfTest()
}
