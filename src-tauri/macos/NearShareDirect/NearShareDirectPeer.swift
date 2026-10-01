//
//  NearShareDirectPeer.swift
//  NearShare macOS Native Direct Mode Module
//
//  Wraps Apple's MCPeerID and discovery metadata sanitization.
//

import Foundation
import MultipeerConnectivity

public final class NearShareDirectPeer {
    public let peerID: MCPeerID
    public let deviceId: String
    public let platform: String
    public let appVersion: String

    public init(displayName: String, deviceId: String) {
        let safeName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalName = safeName.isEmpty ? "NearShare macOS" : safeName
        self.peerID = MCPeerID(displayName: finalName)
        self.deviceId = deviceId.isEmpty ? UUID().uuidString : deviceId
        self.platform = "macOS"
        self.appVersion = "0.1.0"
    }

    public var discoveryInfo: [String: String] {
        return [
            "deviceId": self.deviceId,
            "platform": self.platform,
            "appVersion": self.appVersion,
            "transport": "direct-awdl"
        ]
    }
}
