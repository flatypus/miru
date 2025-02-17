import Foundation
import CoreLocation
import Combine
import SwiftUI

class WebSocketManager {
    private var webSocketTask: URLSessionWebSocketTask?
    private let urlSession = URLSession(configuration: .default)
    
    init(url: URL) {
            // Initialize and start the WebSocket connection.
        webSocketTask = urlSession.webSocketTask(with: url)
        webSocketTask?.resume()
        receive() // Start listening for messages (if needed)
    }
    
        /// Sends the current heading to the WebSocket server.
    func send(heading: Double) {
            // Format the heading as a string (you could also send JSON, etc.)
        let messageString = String(format: "%.1f", heading)
        let message = URLSessionWebSocketTask.Message.string(messageString)
        
        webSocketTask?.send(message) { error in
            if let error = error {
                print("Error sending heading: \(error.localizedDescription)")
            }
        }
    }
    
        /// Continuously receives messages from the server (optional).
    private func receive() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .failure(let error):
                print("WebSocket receive error: \(error)")
            case .success(let message):
                switch message {
                case .string(let text):
                    print("Received string: \(text)")
                case .data(let data):
                    print("Received data: \(data)")
                @unknown default:
                    print("Received an unknown message type")
                }
            }
                // Continue to listen for the next message.
            self?.receive()
        }
    }
    
        /// Disconnects from the WebSocket server.
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
    }
}

class CompassManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    @Published var heading: Double = 0.0
    
        // Instance of WebSocketManager
    private var webSocketManager: WebSocketManager?
    
    override init() {
        super.init()
        locationManager.delegate = self
        
            // Request location permissions.
        locationManager.requestWhenInUseAuthorization()
        
            // Check if heading updates are available.
        if CLLocationManager.headingAvailable() {
            locationManager.headingFilter = 1.0  // Update when heading changes by at least 1 degree.
            locationManager.startUpdatingHeading()
        } else {
            print("Heading not available on this device.")
        }
        
            // Initialize WebSocketManager with your WebSocket server URL.
        if let url = URL(string: "ws://PUTWEBSOCKETIPHERE:4000/ws-for-ios") {
            webSocketManager = WebSocketManager(url: url)
        }
    }
    
    func reconnectFlat() {
        if let url = URL(string: "ws://PUTWEBSOCKETIPHERE:4000/ws-for-ios") {
            webSocketManager = WebSocketManager(url: url)
        }
    }
    
    func reconnectProd() {
        if let url = URL(string: "ws://PUTWEBSOCKETIPHERE:4000/ws-for-ios") {
            webSocketManager = WebSocketManager(url: url)
        }
    }
    
        // CLLocationManagerDelegate method that receives heading updates.
    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        DispatchQueue.main.async {
                // Update the published heading value.
            self.heading = newHeading.magneticHeading
                // Send the updated heading to the WebSocket server.
            self.webSocketManager?.send(heading: newHeading.magneticHeading)
        }
    }
    
        // Optional: Handle errors.
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location Manager error: \(error.localizedDescription)")
    }
}

struct ContentView: View {
    @ObservedObject var compassManager = CompassManager()
    
    var body: some View {
        VStack {
            Spacer()
            Text("flatypus\ncommunicator")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(.primary)
                .padding(.bottom, 10)
            Text(String(format: "%.1f°", compassManager.heading))
                .font(.largeTitle)
                .padding(.bottom, 50)
            Button("reFlatypus", action: compassManager.reconnectFlat)
            Spacer()
            Button("reProdpus ", action: compassManager.reconnectProd)
            Spacer()
        }
    }
}
