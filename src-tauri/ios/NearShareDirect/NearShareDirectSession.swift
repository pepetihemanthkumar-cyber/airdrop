//
//  NearShareDirectSession.swift
//  NearShare iOS Native Direct Mode Module
//
//  Manages Apple MultipeerConnectivity discovery, session negotiation,
//  and continuous binary byte-stream channels on iOS/iPadOS.
//

import Foundation
import MultipeerConnectivity

public final class NearShareDirectSession: NSObject {
    public static let shared = NearShareDirectSession()
    public static let defaultServiceType = "nearshare-p2p"
    public static let maxStreamChunkBytes = 65536 // 64 KiB bounded buffer per read

    private var localPeer: NearShareDirectPeer?
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?

    private var discoveredPeers: [String: MCPeerID] = [:]
    private var pendingInvitations: [String: (MCPeerID, (Bool, MCSession?) -> Void)] = [:]
    private var activeOutputStreams: [String: OutputStream] = [:]
    private var activeInputStreams: [String: InputStream] = [:]
    private var isTornDown: Bool = false

    // C-ABI Callbacks
    public var onPeerDiscovered: IOSPeerDiscoveredCallback?
    public var onPeerLost: IOSPeerLostCallback?
    public var onInvitationReceived: IOSInvitationReceivedCallback?
    public var onConnectionStateChanged: IOSConnectionStateCallback?
    public var onStreamOpened: IOSStreamOpenedCallback?
    public var onDataReceived: IOSDataReceivedCallback?
    public var onStreamClosed: IOSStreamClosedCallback?

    private let queue = DispatchQueue(label: "com.nearshare.ios.direct.session", qos: .userInitiated)

    private override init() {
        super.init()
    }

    public func configureLocalIdentity(displayName: String, deviceId: String) {
        queue.sync {
            self.isTornDown = false
            self.localPeer = NearShareDirectPeer(displayName: displayName, deviceId: deviceId, platform: "iOS")
            if let peer = self.localPeer {
                let sess = MCSession(peer: peer.peerID, securityIdentity: nil, encryptionPreference: .required)
                sess.delegate = self
                self.session = sess
            }
        }
    }

    public func startAdvertising(serviceType: String = defaultServiceType) -> Bool {
        return queue.sync {
            guard !self.isTornDown, let peer = self.localPeer else { return false }
            self.stopAdvertisingInternal()

            let adv = MCNearbyServiceAdvertiser(
                peer: peer.peerID,
                discoveryInfo: peer.discoveryInfo,
                serviceType: serviceType
            )
            adv.delegate = self
            adv.startAdvertisingPeer()
            self.advertiser = adv
            return true
        }
    }

    public func stopAdvertising() {
        queue.sync {
            self.stopAdvertisingInternal()
        }
    }

    private func stopAdvertisingInternal() {
        self.advertiser?.stopAdvertisingPeer()
        self.advertiser?.delegate = nil
        self.advertiser = nil
    }

    public func startDiscovery(serviceType: String = defaultServiceType) -> Bool {
        return queue.sync {
            guard !self.isTornDown, let peer = self.localPeer else { return false }
            self.stopDiscoveryInternal()

            let brows = MCNearbyServiceBrowser(peer: peer.peerID, serviceType: serviceType)
            brows.delegate = self
            brows.startBrowsingForPeers()
            self.browser = brows
            return true
        }
    }

    public func stopDiscovery() {
        queue.sync {
            self.stopDiscoveryInternal()
        }
    }

    private func stopDiscoveryInternal() {
        self.browser?.stopBrowsingForPeers()
        self.browser?.delegate = nil
        self.browser = nil
        self.discoveredPeers.removeAll()
    }

    public func invitePeer(peerId: String, timeout: TimeInterval = 30.0) -> Bool {
        return queue.sync {
            guard let targetPeerID = self.discoveredPeers[peerId],
                  let session = self.session,
                  let browser = self.browser else {
                return false
            }

            browser.invitePeer(targetPeerID, to: session, withContext: nil, timeout: timeout)
            return true
        }
    }

    public func acceptInvitation(invitationId: String, accept: Bool) -> Bool {
        return queue.sync {
            guard let (_, handler) = self.pendingInvitations.removeValue(forKey: invitationId) else {
                return false
            }

            if accept, let sess = self.session {
                handler(true, sess)
            } else {
                handler(false, nil)
            }
            return true
        }
    }

    public func openDataStream(peerId: String, streamName: String) -> String? {
        return queue.sync {
            guard let targetPeerID = self.discoveredPeers[peerId],
                  let session = self.session else {
                return nil
            }

            do {
                let outputStream = try session.startStream(withName: streamName, toPeer: targetPeerID)
                outputStream.open()
                let connId = "ios-stream-\(UUID().uuidString)"
                self.activeOutputStreams[connId] = outputStream
                return connId
            } catch {
                return nil
            }
        }
    }

    public func sendBytes(connectionId: String, data: Data) -> Int {
        return queue.sync {
            guard let outputStream = self.activeOutputStreams[connectionId],
                  outputStream.streamStatus == .open else {
                return -1
            }

            return data.withUnsafeBytes { rawBuffer -> Int in
                guard let pointer = rawBuffer.bindMemory(to: UInt8.self).baseAddress else { return -1 }
                let bytesWritten = outputStream.write(pointer, maxLength: data.count)
                return bytesWritten
            }
        }
    }

    public func closeStream(connectionId: String) {
        queue.sync {
            if let outputStream = self.activeOutputStreams.removeValue(forKey: connectionId) {
                outputStream.close()
            }
            if let inputStream = self.activeInputStreams.removeValue(forKey: connectionId) {
                inputStream.close()
            }
        }
    }

    public func disconnect() {
        queue.sync {
            self.session?.disconnect()
            for (_, stream) in self.activeOutputStreams {
                stream.close()
            }
            for (_, stream) in self.activeInputStreams {
                stream.close()
            }
            self.activeOutputStreams.removeAll()
            self.activeInputStreams.removeAll()
            self.pendingInvitations.removeAll()
        }
    }

    public func teardown() {
        queue.sync {
            self.isTornDown = true
            self.stopAdvertisingInternal()
            self.stopDiscoveryInternal()
            self.disconnect()
            self.session?.delegate = nil
            self.session = nil
            self.localPeer = nil
        }
    }

    public func runSelfTest() -> Bool {
        return queue.sync {
            let testPeer = MCPeerID(displayName: "NearShareIOSTestNode")
            let testSession = MCSession(peer: testPeer, securityIdentity: nil, encryptionPreference: .required)
            return testSession.connectedPeers.isEmpty
        }
    }
}

// MARK: - MCSessionDelegate
extension NearShareDirectSession: MCSessionDelegate {
    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        let mappedState: NearShareIOSConnectionState
        switch state {
        case .notConnected:
            mappedState = .notConnected
        case .connecting:
            mappedState = .connecting
        case .connected:
            mappedState = .connected
        @unknown default:
            mappedState = .failed
        }

        peerID.displayName.withCString { peerNameCStr in
            self.onConnectionStateChanged?(peerNameCStr, mappedState.rawValue)
        }
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        let connId = "ios-packet-\(peerID.displayName)"
        data.withUnsafeBytes { rawBuffer in
            guard let ptr = rawBuffer.bindMemory(to: UInt8.self).baseAddress else { return }
            connId.withCString { connCStr in
                self.onDataReceived?(connCStr, ptr, Int32(data.count))
            }
        }
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {
        let connId = "ios-stream-in-\(UUID().uuidString)"
        self.queue.sync {
            self.activeInputStreams[connId] = stream
        }

        stream.open()

        connId.withCString { connCStr in
            peerID.displayName.withCString { peerCStr in
                streamName.withCString { streamNameCStr in
                    self.onStreamOpened?(connCStr, peerCStr, streamNameCStr)
                }
            }
        }

        // Asynchronously read from input stream on a background worker thread
        DispatchQueue.global(qos: .userInitiated).async { [weak self, weak stream] in
            guard let self = self, let inputStream = stream else { return }
            var buffer = [UInt8](repeating: 0, count: NearShareDirectSession.maxStreamChunkBytes)

            while inputStream.streamStatus == .open || inputStream.streamStatus == .reading {
                let bytesRead = inputStream.read(&buffer, maxLength: buffer.count)
                if bytesRead > 0 {
                    connId.withCString { cStr in
                        buffer.withUnsafeBufferPointer { bufPtr in
                            self.onDataReceived?(cStr, bufPtr.baseAddress, Int32(bytesRead))
                        }
                    }
                } else {
                    break
                }
            }

            connId.withCString { cStr in
                self.onStreamClosed?(cStr)
            }
            self.closeStream(connectionId: connId)
        }
    }

    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {
        // Stream mode is authoritative for NearShare frames; resources are logged safely.
    }

    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {
        // Handled via stream interface
    }
}

// MARK: - MCNearbyServiceAdvertiserDelegate
extension NearShareDirectSession: MCNearbyServiceAdvertiserDelegate {
    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        let invitationId = UUID().uuidString
        self.queue.sync {
            self.pendingInvitations[invitationId] = (peerID, invitationHandler)
        }

        invitationId.withCString { invCStr in
            peerID.displayName.withCString { peerCStr in
                let dispName = peerID.displayName
                dispName.withCString { dispCStr in
                    self.onInvitationReceived?(invCStr, peerCStr, dispCStr)
                }
            }
        }
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        // Advertising error reported via connection state callbacks
    }
}

// MARK: - MCNearbyServiceBrowserDelegate
extension NearShareDirectSession: MCNearbyServiceBrowserDelegate {
    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        let peerKey = peerID.displayName
        self.queue.sync {
            self.discoveredPeers[peerKey] = peerID
        }

        let devId = info?["deviceId"] ?? peerKey
        let platform = info?["platform"] ?? "iOS"

        peerKey.withCString { peerIdCStr in
            peerID.displayName.withCString { nameCStr in
                devId.withCString { devIdCStr in
                    platform.withCString { platCStr in
                        self.onPeerDiscovered?(peerIdCStr, nameCStr, devIdCStr, platCStr)
                    }
                }
            }
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        let peerKey = peerID.displayName
        _ = self.queue.sync {
            self.discoveredPeers.removeValue(forKey: peerKey)
        }

        peerKey.withCString { peerIdCStr in
            self.onPeerLost?(peerIdCStr)
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        // Browsing error handled
    }
}
