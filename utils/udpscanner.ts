import { Buffer } from 'buffer'; // You might need 'buffer' polyfill in Expo
import dgram from 'react-native-udp';

// Interface matching the Python "PongPacket" structure
export interface PongPacket {
  name: string;
  hardware: string;
  type: string;
  configuration: string;
  hostname: string;
  ip: string;
}

export interface DiscoveredRobotInfo {
  name: string;
  ip: string;
}

// Interface for the callback
export type DiscoveryCallback = (robot: DiscoveredRobotInfo) => void;

class DuckietownDiscoveryService {
  private socket: any;
  private isDiscovering: boolean = false;
  private discoveryPort: number = 19000; // Standard Duckietown UDP port (Verify this matches your robots)
  private callback: DiscoveryCallback | null = null;

  constructor() {
    this.socket = dgram.createSocket({type: 'udp4'});
  }

  /**
   * Starts the discovery process.
   * @param onDiscover Callback function when a robot is found.
   */
  public async start(onDiscover: DiscoveryCallback) {
    if (this.isDiscovering) return;
    
    this.callback = onDiscover;
    this.isDiscovering = true;

    // 1. Bind the socket
    // We bind to a random port to listen for responses
    this.socket.bind(this.discoveryPort, (err: any) => {
      if (err) {
        console.error('Error binding socket:', err);
        this.stop();
        return;
      }
      
      // 2. Enable Broadcast
      this.socket.setBroadcast(true);
      console.log('Discovery socket bound and broadcast enabled.');
      
      // 3. Start sending pings
      this.startBroadcasting();
    });

    // 4. Listen for responses (The "Pong")
    this.socket.on('message', (msg: Uint8Array, rinfo: any) => {
      console.log(`Received message from ${rinfo.address}, ${msg}`);
      this.handleMessage(msg, rinfo);
    });

    this.socket.on('error', (err: any) => {
      console.error('Socket error:', err);
    });
  }

  /**
   * Stops the discovery process and closes the socket.
   */
  public stop() {
    this.isDiscovering = false;
    this.callback = null;
    
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        console.warn('Error closing socket', e);
      }
      // Re-create socket instance for next use
      this.socket = dgram.createSocket({type: 'udp4'});
    }
  }

  /**
   * Sends a generic broadcast packet to find robots.
   */
  private async startBroadcasting() {
    if (!this.isDiscovering) return;

    try {
      // In Python's UDPScanner, a packet is sent to trigger a response.
      // We send a simple ping payload.
      const message = Buffer.from('DT_PING'); 
      const broadcastAddr = '255.255.255.255';

      // If we can get a specific subnet broadcast, it's better, but global works for local.
      this.socket.send(message, 0, message.length, this.discoveryPort, broadcastAddr, (err: any) => {
        if (err) console.error('Error sending broadcast:', err);
      });

      // Repeat every second (REFRESH_HZ = 1.0 in Python script)
      setTimeout(() => this.startBroadcasting(), 1000);

    } catch (error) {
      console.error('Broadcasting loop error:', error);
    }
  }

  /**
   * Parses the incoming UDP packet.
   * Replicates logic: listener.add_external(...)
   */
  private handleMessage(msg: Uint8Array, rinfo: any) {
    try {
      const msgString = String.fromCharCode(...msg);

      // Ignore our own broadcast packets if they loop back
      if (msgString === 'DT_PING') return;

      // Assuming the robot replies with JSON (Standard Duckietown PongPacket)
      // If the robot replies with raw text, you will need to parse that format manually.
      const data = JSON.parse(msgString);

      // Map response to our interface
      // The Python script expects: name, hardware, type, model (configuration)
      const robot: PongPacket = {
        name: data.hostname || data.name || 'Unknown',
        hardware: data.hardware || 'physical',
        type: data.type || 'ND',
        configuration: data.configuration || data.model || 'ND',
        hostname: data.hostname || 'ND',
        ip: rinfo.address,
      };

      if (this.callback) {
        this.callback(robot);
      }
    } catch (e) {
      // If JSON parse fails, log it (might be a different protocol packet)
      // console.debug('Received non-JSON packet:', String.fromCharCode(...msg));
    }
  }
}

export const duckietownDiscovery = new DuckietownDiscoveryService();