package com.nearshare.direct

/**
 * NearShare Android Direct Native Types
 *
 * Defines the structured domain models, connection records, and lifecycle events
 * for Android Wi-Fi Direct (WifiP2pManager) and TCP socket streaming.
 */

data class AndroidDirectPeerInfo(
    val peerId: String,
    val displayName: String,
    val serviceType: String,
    val discoveredAt: Long,
    val rssi: Int? = null,
    val estimatedDistanceMeters: Double = 3.0,
    val state: String = "discovered",
    val isGroupOwner: Boolean = false
)

data class AndroidDirectConnectionInfo(
    val connectionId: String,
    val peerId: String,
    val establishedAt: Long,
    val channelType: String = "stream",
    val isEncryptedTransport: Boolean = true,
    val groupRole: String? = "client"
)

sealed class AndroidDirectEvent {
    data class DiscoveryStarted(val serviceType: String, val timestamp: Long) : AndroidDirectEvent()
    data class DiscoveryStopped(val timestamp: Long) : AndroidDirectEvent()
    data class AdvertiserStarted(val serviceType: String, val timestamp: Long) : AndroidDirectEvent()
    data class AdvertiserStopped(val timestamp: Long) : AndroidDirectEvent()
    data class PeerDiscovered(val peer: AndroidDirectPeerInfo, val timestamp: Long) : AndroidDirectEvent()
    data class PeerLost(val peerId: String, val timestamp: Long) : AndroidDirectEvent()
    data class ConnectionStarted(val peerId: String, val timestamp: Long) : AndroidDirectEvent()
    data class ConnectionEstablished(val connection: AndroidDirectConnectionInfo, val timestamp: Long) : AndroidDirectEvent()
    data class ConnectionFailed(val peerId: String, val error: String, val timestamp: Long) : AndroidDirectEvent()
    data class ConnectionLost(val connectionId: String, val peerId: String, val reason: String? = null, val timestamp: Long) : AndroidDirectEvent()
    data class StreamOpened(val connectionId: String, val peerId: String? = null, val streamName: String? = null, val timestamp: Long) : AndroidDirectEvent()
    data class StreamClosed(val connectionId: String, val timestamp: Long) : AndroidDirectEvent()
    data class DataReceived(val connectionId: String, val payloadBase64: String, val byteLength: Int, val timestamp: Long) : AndroidDirectEvent()
    data class SendCompleted(val peerId: String, val bytesSent: Int, val timestamp: Long) : AndroidDirectEvent()
    data class NativeError(val code: String, val message: String, val timestamp: Long) : AndroidDirectEvent()
}

interface AndroidDirectEventListener {
    fun onEvent(event: AndroidDirectEvent)
}
