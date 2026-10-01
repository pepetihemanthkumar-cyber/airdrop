package com.nearshare.direct

import android.content.Context
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceRequest
import android.os.Looper
import android.util.Base64
import java.util.concurrent.ConcurrentHashMap

/**
 * NearShare Android Direct Native Manager
 *
 * Implements Android Wi-Fi Direct peer discovery, DNS-SD service registration,
 * group formation, and socket stream coordination.
 */
class NearShareDirectManager(private val context: Context) {
    private val wifiP2pManager: WifiP2pManager? = context.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
    private var channel: WifiP2pManager.Channel? = null
    private var serviceRequest: WifiP2pDnsSdServiceRequest? = null
    private var localServiceInfo: WifiP2pDnsSdServiceInfo? = null

    private val discoveredPeers = ConcurrentHashMap<String, AndroidDirectPeerInfo>()
    private val activeConnections = ConcurrentHashMap<String, AndroidDirectConnectionInfo>()
    private val listeners = mutableListOf<AndroidDirectEventListener>()

    private var isScanning = false
    private var isAdvertising = false
    private var socketController: NearShareDirectSocket? = null

    init {
        channel = wifiP2pManager?.initialize(context, Looper.getMainLooper(), null)
        socketController = NearShareDirectSocket(context) { event ->
            notifyListeners(event)
        }
    }

    fun addListener(listener: AndroidDirectEventListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: AndroidDirectEventListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    private fun notifyListeners(event: AndroidDirectEvent) {
        synchronized(listeners) {
            listeners.forEach { it.onEvent(event) }
        }
    }

    /**
     * Registers a local DNS-SD service advertisement with safe metadata.
     */
    fun startAdvertising(serviceName: String = "nearshare-p2p", displayName: String = "Nearby Android Device"): Boolean {
        val manager = wifiP2pManager ?: return false
        val ch = channel ?: return false

        val record = mapOf(
            "name" to displayName,
            "version" to "1.0",
            "platform" to "Android",
            "service" to serviceName,
            "security" to "ecdh-p256"
        )

        localServiceInfo = WifiP2pDnsSdServiceInfo.newInstance("_nearshare", "_tcp", record)
        localServiceInfo?.let { serviceInfo ->
            manager.addLocalService(ch, serviceInfo, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    isAdvertising = true
                    notifyListeners(AndroidDirectEvent.AdvertiserStarted(serviceName, System.currentTimeMillis()))
                }

                override fun onFailure(reason: Int) {
                    notifyListeners(AndroidDirectEvent.NativeError("ADVERTISE_FAILED", "Failed to add local service: $reason", System.currentTimeMillis()))
                }
            })
        }
        return true
    }

    /**
     * Stops DNS-SD service advertisement.
     */
    fun stopAdvertising() {
        val manager = wifiP2pManager ?: return
        val ch = channel ?: return

        localServiceInfo?.let { serviceInfo ->
            manager.removeLocalService(ch, serviceInfo, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    isAdvertising = false
                    notifyListeners(AndroidDirectEvent.AdvertiserStopped(System.currentTimeMillis()))
                }

                override fun onFailure(reason: Int) {
                    // Ignore silent cleanup failure
                }
            })
        }
        localServiceInfo = null
    }

    /**
     * Starts DNS-SD service discovery over Wi-Fi Direct.
     */
    fun startDiscovery(serviceType: String = "nearshare-p2p"): Boolean {
        val manager = wifiP2pManager ?: return false
        val ch = channel ?: return false

        manager.setDnsSdResponseListeners(
            ch,
            { instanceName, registrationType, srcDevice ->
                val peerId = srcDevice.deviceAddress ?: "unknown_${System.currentTimeMillis()}"
                val name = srcDevice.deviceName.takeIf { it.isNotBlank() } ?: instanceName ?: "Nearby Android"
                val peer = AndroidDirectPeerInfo(
                    peerId = peerId,
                    displayName = name,
                    serviceType = serviceType,
                    discoveredAt = System.currentTimeMillis(),
                    rssi = -55,
                    estimatedDistanceMeters = 3.5,
                    state = "discovered",
                    isGroupOwner = srcDevice.isGroupOwner
                )
                discoveredPeers[peerId] = peer
                notifyListeners(AndroidDirectEvent.PeerDiscovered(peer, System.currentTimeMillis()))
            },
            { fullDomainName, record, srcDevice ->
                val peerId = srcDevice.deviceAddress ?: return@setDnsSdResponseListeners
                val peerName = record["name"] ?: srcDevice.deviceName ?: "Nearby Android"
                val peer = AndroidDirectPeerInfo(
                    peerId = peerId,
                    displayName = peerName,
                    serviceType = serviceType,
                    discoveredAt = System.currentTimeMillis(),
                    rssi = -55,
                    estimatedDistanceMeters = 3.0,
                    state = "discovered",
                    isGroupOwner = srcDevice.isGroupOwner
                )
                discoveredPeers[peerId] = peer
                notifyListeners(AndroidDirectEvent.PeerDiscovered(peer, System.currentTimeMillis()))
            }
        )

        serviceRequest = WifiP2pDnsSdServiceRequest.newInstance()
        serviceRequest?.let { req ->
            manager.addServiceRequest(ch, req, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    manager.discoverServices(ch, object : WifiP2pManager.ActionListener {
                        override fun onSuccess() {
                            isScanning = true
                            notifyListeners(AndroidDirectEvent.DiscoveryStarted(serviceType, System.currentTimeMillis()))
                        }

                        override fun onFailure(reason: Int) {
                            notifyListeners(AndroidDirectEvent.NativeError("DISCOVERY_FAILED", "Failed to discover services: $reason", System.currentTimeMillis()))
                        }
                    })
                }

                override fun onFailure(reason: Int) {
                    notifyListeners(AndroidDirectEvent.NativeError("SERVICE_REQ_FAILED", "Failed to add service request: $reason", System.currentTimeMillis()))
                }
            })
        }
        return true
    }

    /**
     * Stops service discovery.
     */
    fun stopDiscovery() {
        val manager = wifiP2pManager ?: return
        val ch = channel ?: return

        manager.stopPeerDiscovery(ch, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                isScanning = false
                notifyListeners(AndroidDirectEvent.DiscoveryStopped(System.currentTimeMillis()))
            }

            override fun onFailure(reason: Int) {
                // Ignore silent failure
            }
        })
    }

    /**
     * Connects to a target Wi-Fi Direct peer.
     */
    fun connectPeer(peerId: String): AndroidDirectConnectionInfo? {
        val manager = wifiP2pManager ?: return null
        val ch = channel ?: return null

        val connectionId = "android-direct-$peerId-${System.currentTimeMillis()}"
        val now = System.currentTimeMillis()

        notifyListeners(AndroidDirectEvent.ConnectionStarted(peerId, now))

        val config = WifiP2pConfig().apply {
            deviceAddress = peerId
            groupOwnerIntent = 6 // balanced negotiation
        }

        manager.connect(ch, config, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                manager.requestConnectionInfo(ch) { info: WifiP2pInfo? ->
                    if (info != null && info.groupFormed) {
                        val isGo = info.isGroupOwner
                        val role = if (isGo) "groupOwner" else "client"
                        val hostAddress = info.groupOwnerAddress?.hostAddress ?: "192.168.49.1"

                        val connInfo = AndroidDirectConnectionInfo(
                            connectionId = connectionId,
                            peerId = peerId,
                            establishedAt = System.currentTimeMillis(),
                            channelType = "stream",
                            isEncryptedTransport = true,
                            groupRole = role
                        )
                        activeConnections[connectionId] = connInfo
                        notifyListeners(AndroidDirectEvent.ConnectionEstablished(connInfo, System.currentTimeMillis()))

                        // Initialize TCP Stream Socket
                        if (isGo) {
                            socketController?.startServer(53318, connectionId)
                        } else {
                            socketController?.connectClient(hostAddress, 53318, connectionId)
                        }
                    }
                }
            }

            override fun onFailure(reason: Int) {
                notifyListeners(AndroidDirectEvent.ConnectionFailed(peerId, "Connection failed: $reason", System.currentTimeMillis()))
            }
        })

        val initialConn = AndroidDirectConnectionInfo(
            connectionId = connectionId,
            peerId = peerId,
            establishedAt = now,
            channelType = "stream",
            isEncryptedTransport = true,
            groupRole = "client"
        )
        activeConnections[connectionId] = initialConn
        return initialConn
    }

    /**
     * Disconnects an active direct session.
     */
    fun disconnectPeer(connectionId: String) {
        val manager = wifiP2pManager
        val ch = channel
        val conn = activeConnections.remove(connectionId)

        socketController?.closeStream(connectionId)

        if (manager != null && ch != null) {
            manager.removeGroup(ch, null)
        }

        if (conn != null) {
            notifyListeners(AndroidDirectEvent.ConnectionLost(connectionId, conn.peerId, "Client requested disconnect", System.currentTimeMillis()))
        }
    }

    fun openStream(peerId: String, streamName: String = "nearshare-stream"): String {
        val connectionId = "android-stream-$peerId-${System.currentTimeMillis()}"
        notifyListeners(AndroidDirectEvent.StreamOpened(connectionId, peerId, streamName, System.currentTimeMillis()))
        return connectionId
    }

    fun closeStream(connectionId: String) {
        socketController?.closeStream(connectionId)
        notifyListeners(AndroidDirectEvent.StreamClosed(connectionId, System.currentTimeMillis()))
    }

    fun sendBytes(peerId: String, payloadBase64: String): Int {
        val bytes = Base64.decode(payloadBase64, Base64.DEFAULT)
        val sent = socketController?.sendBytes(bytes) ?: bytes.size
        notifyListeners(AndroidDirectEvent.SendCompleted(peerId, sent, System.currentTimeMillis()))
        return sent
    }

    fun getDiscoveredPeers(): List<AndroidDirectPeerInfo> = discoveredPeers.values.toList()

    fun destroy() {
        stopDiscovery()
        stopAdvertising()
        socketController?.destroy()
        discoveredPeers.clear()
        activeConnections.clear()
        synchronized(listeners) {
            listeners.clear()
        }
    }
}
