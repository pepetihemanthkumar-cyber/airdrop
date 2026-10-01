package com.nearshare.direct

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Base64
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * NearShare Android Direct Socket Controller
 *
 * Manages TCP ServerSocket and Socket streams bound strictly to the
 * Wi-Fi Direct network interface via ConnectivityManager.
 */
class NearShareDirectSocket(
    private val context: Context,
    private val onEvent: (AndroidDirectEvent) -> Unit
) {
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    private var boundNetwork: Network? = null
    private var serverSocket: ServerSocket? = null
    private var activeSocket: Socket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null

    private val isRunning = AtomicBoolean(false)
    private val executor: ExecutorService = Executors.newCachedThreadPool()

    companion object {
        const val CHUNK_SIZE = 65536 // 64 KiB
        const val MAX_IN_FLIGHT_CHUNKS = 16
        const val MAX_BUFFERED_DATA_BYTES = 64 * 1024 * 1024 // 64 MiB
    }

    init {
        bindWifiDirectNetwork()
    }

    private fun bindWifiDirectNetwork() {
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .build()

        connectivityManager?.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                boundNetwork = network
            }

            override fun onLost(network: Network) {
                if (boundNetwork == network) {
                    boundNetwork = null
                }
            }
        })
    }

    fun startServer(port: Int = 53318, connectionId: String) {
        isRunning.set(true)
        executor.execute {
            try {
                val server = ServerSocket(port)
                serverSocket = server
                val socket = server.accept()
                activeSocket = socket
                boundNetwork?.bindSocket(socket)

                inputStream = socket.getInputStream()
                outputStream = socket.getOutputStream()

                onEvent(AndroidDirectEvent.StreamOpened(connectionId, null, "nearshare-stream", System.currentTimeMillis()))
                readLoop(connectionId)
            } catch (e: Exception) {
                if (isRunning.get()) {
                    onEvent(AndroidDirectEvent.NativeError("SOCKET_SERVER_ERR", e.message ?: "Socket server error", System.currentTimeMillis()))
                }
            }
        }
    }

    fun connectClient(host: String, port: Int = 53318, connectionId: String) {
        isRunning.set(true)
        executor.execute {
            try {
                val socket = Socket()
                boundNetwork?.bindSocket(socket)
                socket.connect(InetSocketAddress(host, port), 10000)
                activeSocket = socket

                inputStream = socket.getInputStream()
                outputStream = socket.getOutputStream()

                onEvent(AndroidDirectEvent.StreamOpened(connectionId, null, "nearshare-stream", System.currentTimeMillis()))
                readLoop(connectionId)
            } catch (e: Exception) {
                if (isRunning.get()) {
                    onEvent(AndroidDirectEvent.NativeError("SOCKET_CLIENT_ERR", e.message ?: "Socket client error", System.currentTimeMillis()))
                }
            }
        }
    }

    private fun readLoop(connectionId: String) {
        val buffer = ByteArray(CHUNK_SIZE)
        val stream = inputStream ?: return

        try {
            while (isRunning.get()) {
                val read = stream.read(buffer)
                if (read == -1) {
                    onEvent(AndroidDirectEvent.StreamClosed(connectionId, System.currentTimeMillis()))
                    break
                }
                if (read > 0) {
                    val chunk = buffer.copyOf(read)
                    val base64Payload = Base64.encodeToString(chunk, Base64.NO_WRAP)
                    onEvent(AndroidDirectEvent.DataReceived(connectionId, base64Payload, read, System.currentTimeMillis()))
                }
            }
        } catch (e: Exception) {
            if (isRunning.get()) {
                onEvent(AndroidDirectEvent.StreamClosed(connectionId, System.currentTimeMillis()))
            }
        }
    }

    fun sendBytes(bytes: ByteArray): Int {
        val stream = outputStream ?: return 0
        synchronized(stream) {
            stream.write(bytes)
            stream.flush()
        }
        return bytes.size
    }

    fun closeStream(connectionId: String) {
        isRunning.set(false)
        try {
            inputStream?.close()
            outputStream?.close()
            activeSocket?.close()
            serverSocket?.close()
        } catch (ignored: Exception) {}
        inputStream = null
        outputStream = null
        activeSocket = null
        serverSocket = null
    }

    fun destroy() {
        isRunning.set(false)
        closeStream("all")
        executor.shutdownNow()
    }
}
