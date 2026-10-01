//
//  NearShareDirectTypes.swift
//  NearShare macOS Native Direct Mode Module
//
//  Defines typed data models and C-ABI callback structures.
//

import Foundation

public enum NearShareConnectionState: Int32 {
    case notConnected = 0
    case connecting = 1
    case connected = 2
    case disconnecting = 3
    case failed = 4
}

public struct NearSharePeerInfo {
    public let peerId: String
    public let displayName: String
    public let deviceId: String
    public let platform: String
    public let appVersion: String
    public let discoveryInfo: [String: String]
}

public typealias PeerDiscoveredCallback = @convention(c) (
    UnsafePointer<CChar>?, // peerId
    UnsafePointer<CChar>?, // displayName
    UnsafePointer<CChar>?, // deviceId
    UnsafePointer<CChar>?  // platform
) -> Void

public typealias PeerLostCallback = @convention(c) (
    UnsafePointer<CChar>? // peerId
) -> Void

public typealias InvitationReceivedCallback = @convention(c) (
    UnsafePointer<CChar>?, // invitationId
    UnsafePointer<CChar>?, // peerId
    UnsafePointer<CChar>?  // displayName
) -> Void

public typealias ConnectionStateCallback = @convention(c) (
    UnsafePointer<CChar>?, // peerId
    Int32                  // state
) -> Void

public typealias StreamOpenedCallback = @convention(c) (
    UnsafePointer<CChar>?, // connectionId
    UnsafePointer<CChar>?, // peerId
    UnsafePointer<CChar>?  // streamName
) -> Void

public typealias DataReceivedCallback = @convention(c) (
    UnsafePointer<CChar>?, // connectionId
    UnsafePointer<UInt8>?, // dataPtr
    Int32                  // length
) -> Void

public typealias StreamClosedCallback = @convention(c) (
    UnsafePointer<CChar>? // connectionId
) -> Void
