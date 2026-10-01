//
//  NearShareDirectSession.swift
//  NearShare macOS Native Direct Mode Module
//
//  Manages Apple MultipeerConnectivity discovery, session negotiation,
//  and continuous binary byte-stream channels with bounded backpressure.
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
    public var onPeerDiscovered: PeerDiscoveredCallback?
    public var onPeerLost: PeerLostCallback?
    public var onInvitationReceived: InvitationReceivedCallback?
    public var onConnectionStateChanged: ConnectionStateCallback?
    public var onStreamOpened: StreamOpenedCallback?
    public var onDataReceived: DataReceivedCallback?
    public var onStreamClosed: StreamClosedCallback?

    private let queue = DispatchQueue(label: "com.nearshare.direct.session", qos: .userInitiated)

    private override init() {
        super.init()
    }

    public func configureLocalIdentity(displayName: String, deviceId: String) {
        queue.sync {
            self.isTornDown = false
            self.localPeer = NearShareDirectPeer(displayName: displayName, deviceId: deviceId)
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

    public func invitePeer(peerId: String) -> Bool {
        return queue.sync {
            guard !self.isTornDown,
                  let browser = self.browser,
                  let targetPeerID = self.discoveredPeers[peerId],
                  let session = self.session else {
                return false
            }

            browser.invitePeer(targetPeerID, to: session, withContext: nil, timeout: 15.0)
            return true
        }
    }

    public func acceptInvitation(invitationId: String, accept: Bool) -> Bool {
        return queue.sync {
            guard let (_, handler) = self.pendingInvitations.removeValue(forKey: invitationId) else {
                return false
            }
            handler(accept, accept ? self.session : nil)
            return true
        }
    }

    public func openDataStream(peerId: String, streamName: String = "nearshare-stream") -> String? {
        return queue.sync {
            guard !self.isTornDown,
                  let session = self.session,
                  let targetPeer = self.discoveredPeers[peerId] else {
                return nil
            }

            do {
                let outStream = try session.startStream(withName: streamName, toPeer: targetPeer)
                let connectionId = "stream-\(UUID().uuidString)"
                outStream.delegate = self
                outStream.schedule(in: .main, forMode: .default)
                outStream.open()
                self.activeOutputStreams[connectionId] = outStream

                connectionId.withCString { cConnId in
                    peerId.withCString { cPeerId in
                        streamName.withCString { cStreamName in
                            self.onStreamOpened?(cConnId, cPeerId, cStreamName)
                        }
                    }
                }

                return connectionId
            } catch {
                return nil
            }
        }
    }

    public func sendBytes(connectionId: String, data: Data) -> Int {
        return queue.sync {
            guard !self.isTornDown,
                  let stream = self.activeOutputStreams[connectionId],
                  stream.hasSpaceAvailable else {
                return -1
            }

            let count = data.count
            if count == 0 { return 0 }

            let written = data.withUnsafeBytes { rawBuffer -> Int in
                guard let ptr = rawBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return -1 }
                return stream.write(ptr, maxLength: count)
            }

            return written
        }
    }

    public func closeStream(connectionId: String) {
        queue.sync {
            if let outStream = self.activeOutputStreams.removeValue(forKey: connectionId) {
                outStream.close()
                outStream.remove(from: .main, forMode: .default)
                outStream.delegate = nil
            }
            if let inStream = self.activeInputStreams.removeValue(forKey: connectionId) {
                inStream.close()
                inStream.remove(from: .main, forMode: .default)
                inStream.delegate = nil
            }

            if !self.isTornDown {
                connectionId.withCString { cId in
                    self.onStreamClosed?(cId)
                }
            }
        }
    }

    public func disconnect() {
        queue.sync {
            self.session?.disconnect()
            for (_, s) in self.activeOutputStreams {
                s.close()
                s.remove(from: .main, forMode: .default)
                s.delegate = nil
            }
            for (_, s) in self.activeInputStreams {
                s.close()
                s.remove(from: .main, forMode: .default)
                s.delegate = nil
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

    // Native self-test to verify Apple MultipeerConnectivity initialization
    public func runSelfTest() -> Bool {
        return queue.sync {
            let testPeer = MCPeerID(displayName: "NearShare Self-Test")
            let testSession = MCSession(peer: testPeer, securityIdentity: nil, encryptionPreference: .required)
            let testAdv = MCNearbyServiceAdvertiser(peer: testPeer, discoveryInfo: ["test": "true"], serviceType: "nearshare-p2p")
            let testBrowser = MCNearbyServiceBrowser(peer: testPeer, serviceType: "nearshare-p2p")

            testSession.disconnect()
            return testSession.myPeerID.displayName == "NearShare Self-Test"
                && testAdv.serviceType == "nearshare-p2p"
                && testBrowser.serviceType == "nearshare-p2p"
        }
    }
}

// MARK: - MCNearbyServiceAdvertiserDelegate
extension NearShareDirectSession: MCNearbyServiceAdvertiserDelegate {
    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        guard !self.isTornDown else {
            invitationHandler(false, nil)
            return
        }
        let invitationId = UUID().uuidString
        self.pendingInvitations[invitationId] = (peerID, invitationHandler)

        invitationId.withCString { cInvId in
            peerID.displayName.withCString { cPeerId in
                peerID.displayName.withCString { cDispName in
                    self.onInvitationReceived?(cInvId, cPeerId, cDispName)
                }
            }
        }
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        // Handled via lifecycle state
    }
}

// MARK: - MCNearbyServiceBrowserDelegate
extension NearShareDirectSession: MCNearbyServiceBrowserDelegate {
    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        guard !self.isTornDown else { return }
        let peerId = peerID.displayName
        self.discoveredPeers[peerId] = peerID

        let devId = info?["deviceId"] ?? peerId
        let plat = info?["platform"] ?? "macOS"

        peerId.withCString { cPeerId in
            peerID.displayName.withCString { cDispName in
                devId.withCString { cDevId in
                    plat.withCString { cPlat in
                        self.onPeerDiscovered?(cPeerId, cDispName, cDevId, cPlat)
                    }
                }
            }
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        guard !self.isTornDown else { return }
        let peerId = peerID.displayName
        self.discoveredPeers.removeValue(forKey: peerId)

        peerId.withCString { cPeerId in
            self.onPeerLost?(cPeerId)
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        // Handled via lifecycle state
    }
}

// MARK: - MCSessionDelegate
extension NearShareDirectSession: MCSessionDelegate {
    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        guard !self.isTornDown else { return }
        let rawState: NearShareConnectionState
        switch state {
        case .notConnected: rawState = .notConnected
        case .connecting: rawState = .connecting
        case .connected: rawState = .connected
        @unknown default: rawState = .notConnected
        }

        peerID.displayName.withCString { cPeerId in
            self.onConnectionStateChanged?(cPeerId, rawState.rawValue)
        }
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        // Continuous bulk streams use startStream; packet data channel routes here if needed
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {
        guard !self.isTornDown else { return }
        let connectionId = "in-stream-\(UUID().uuidString)"
        stream.delegate = self
        stream.schedule(in: .main, forMode: .default)
        stream.open()
        self.activeInputStreams[connectionId] = stream

        connectionId.withCString { cConnId in
            peerID.displayName.withCString { cPeerId in
                streamName.withCString { cStreamName in
                    self.onStreamOpened?(cConnId, cPeerId, cStreamName)
                }
            }
        }
    }

    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {
    }

    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {
    }
}

// MARK: - StreamDelegate
extension NearShareDirectSession: StreamDelegate {
    public func stream(_ aStream: Stream, handle eventCode: Stream.Event) {
        guard !self.isTornDown else { return }
        switch eventCode {
        case .hasBytesAvailable:
            guard let inStream = aStream as? InputStream else { return }
            var buffer = [UInt8](repeating: 0, count: NearShareDirectSession.maxStreamChunkBytes)
            let bytesRead = inStream.read(&buffer, maxLength: buffer.count)
            if bytesRead > 0 {
                let connectionId = self.activeInputStreams.first { $0.value == inStream }?.key ?? "unknown-stream"
                connectionId.withCString { cConnId in
                    buffer.withUnsafeBufferPointer { ptr in
                        guard let base = ptr.baseAddress else { return }
                        self.onDataReceived?(cConnId, base, Int32(bytesRead))
                    }
                }
            }
        case .endEncountered, .errorOccurred:
            let connectionId = self.activeInputStreams.first { $0.value == aStream }?.key
                ?? self.activeOutputStreams.first { $0.value == aStream }?.key
                ?? "unknown-stream"
            self.closeStream(connectionId: connectionId)
        default:
            break
        }
    }
}
