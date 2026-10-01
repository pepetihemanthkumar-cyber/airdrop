//
//  NearShareDirectPeer.swift
//  NearShare iOS Native Direct Mode Module
//
//  Wraps Apple MultipeerConnectivity MCPeerID and advertised TXT discovery metadata.
//

import Foundation
import MultipeerConnectivity

public final class NearShareDirectPeer {
    public let peerID: MCPeerID
    public let deviceId: String
    public let platform: String
    public let appVersion: String
    public let discoveryInfo: [String: String]

    public init(displayName: String, deviceId: String, platform: String = "iOS", appVersion: String = "0.1.0") {
        self.peerID = MCPeerID(displayName: displayName)
        self.deviceId = deviceId
        self.platform = platform
        self.appVersion = appVersion

        self.discoveryInfo = [
            "deviceId": deviceId,
            "platform": platform,
            "appVersion": appVersion,
            "protocolVersion": "1.0",
            "pairingRequired": "true",
            "supportsStream": "true"
        ]
    }
}
