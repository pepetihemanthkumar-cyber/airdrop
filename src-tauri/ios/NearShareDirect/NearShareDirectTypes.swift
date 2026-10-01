//
//  NearShareDirectTypes.swift
//  NearShare iOS Native Direct Mode Module
//
//  Defines typed data models and C-ABI callback structures for iOS MultipeerConnectivity.
//

import Foundation

public enum NearShareIOSConnectionState: Int32 {
    case notConnected = 0
    case connecting = 1
    case connected = 2
    case disconnecting = 3
    case failed = 4
}

public struct NearShareIOSPeerInfo {
    public let peerId: String
    public let displayName: String
    public let deviceId: String
    public let platform: String
    public let appVersion: String
    public let discoveryInfo: [String: String]
}

public typealias IOSPeerDiscoveredCallback = @convention(c) (
    UnsafePointer<CChar>?, // peerId
    UnsafePointer<CChar>?, // displayName
    UnsafePointer<CChar>?, // deviceId
    UnsafePointer<CChar>?  // platform
) -> Void

public typealias IOSPeerLostCallback = @convention(c) (
    UnsafePointer<CChar>? // peerId
) -> Void

public typealias IOSInvitationReceivedCallback = @convention(c) (
    UnsafePointer<CChar>?, // invitationId
    UnsafePointer<CChar>?, // peerId
    UnsafePointer<CChar>?  // displayName
) -> Void

public typealias IOSConnectionStateCallback = @convention(c) (
    UnsafePointer<CChar>?, // peerId
    Int32                  // state
) -> Void

public typealias IOSStreamOpenedCallback = @convention(c) (
    UnsafePointer<CChar>?, // connectionId
    UnsafePointer<CChar>?, // peerId
    UnsafePointer<CChar>?  // streamName
) -> Void

public typealias IOSDataReceivedCallback = @convention(c) (
    UnsafePointer<CChar>?, // connectionId
    UnsafePointer<UInt8>?, // dataPtr
    Int32                  // length
) -> Void

public typealias IOSStreamClosedCallback = @convention(c) (
    UnsafePointer<CChar>? // connectionId
) -> Void
