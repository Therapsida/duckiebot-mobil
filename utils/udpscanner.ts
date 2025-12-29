import { Buffer } from 'buffer';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import dgram from 'react-native-udp';

// We must make Buffer global in React Native
global.Buffer = global.Buffer || Buffer;

// --- Constants ---
const REMOTE_PORT = 11411; // Port Duckiebot listens on

// --- Interfaces & Types ---
export interface DiscoveredRobotInfo {
  ip: string;
  name: string;
  type: string;
  configuration: string;
  hardware: string;
}

const MOCK_ROBOTS: DiscoveredRobotInfo[] = [
  { ip: '192.168.43.64', name: 'yakisikli', type: 'Duckiebot', configuration: 'DB21M', hardware: 'Raspberry Pi 4' },
  { ip: '192.168.1.106', name: 'duckiebot-test-2', type: 'Watchtower', configuration: 'WT18', hardware: 'Raspberry Pi 3B+' },
];

interface PacketData {
  version: string;
  [key: string]: any;
}

interface PingData extends PacketData {
  port: number;
}

interface PongData extends PacketData {
  name: string;
  type: string;
  configuration: string;
  hardware: string;
}



class Packet {
  version: string;

  constructor(version: string) {
    this.version = version;
  }

  asDict(): PacketData {
    return { version: this.version };
  }

  serialize(): Buffer {
    return Buffer.from(JSON.stringify(this.asDict()));
  }

  static deserialize<T extends PacketData>(data: string | Buffer): T {
    try {
      const strData = typeof data === 'string' ? data : data.toString();
      return JSON.parse(strData) as T;
    } catch (e) {
      throw new Error(`Could not deserialize data: ${data}`);
    }
  }
}

class PingPacket extends Packet {
  port: number;

  constructor(version: string, port: number) {
    super(version);
    this.port = port;
  }

  asDict(): PingData {
    return { version: this.version, port: this.port };
  }
}


export class UDPScanner {
  private socket: any; 
  private port: number = 0;
  private stopped: boolean = false;

  constructor() {
    this.socket = dgram.createSocket({ type: 'udp4' });
  }

  public stop(): void {
    this.stopped = true;
    try {
      this.socket.close();
      console.log("Scanner socket closed.");
    } catch (e) {
     
    }
  }

  private async generateTargetIps(): Promise<string[]> {
    try {
      const ip = await Network.getIpAddressAsync();
      console.log(`Device IP: ${ip}`);

      if (!ip || ip === '0.0.0.0') return [];

      const parts = ip.split('.');
      const prefix = parts.slice(0, 3).join('.');
      
      const targets: string[] = [];
      for (let i = 1; i < 255; i++) {
        targets.push(`${prefix}.${i}`);
      }
      return targets;

    } catch (e) {
      console.error("Failed to get IP:", e);
      return [];
    }
  }

  private async sendPing(host: string): Promise<void> {
    return new Promise((resolve) => {
      const ping = new PingPacket('1', this.port);
      const message = ping.serialize();
      
      // react-native-udp send format: msg, offset, length, port, host, callback
      this.socket.send(message, 0, message.length, REMOTE_PORT, host, (err: any) => {
        if (err) {
            // console.warn(`Send error to ${host}:`, err);
        }
        resolve();
      });
    });
  }

  public async scan(onFound: (robot: DiscoveredRobotInfo) => void): Promise<void> {
    return new Promise<void>(async (resolve) => {
      
     
      this.socket.on('message', (msg: any, rinfo: any) => {
        if (this.stopped) return;
        try {
          
          const bufferMsg = Buffer.from(msg); 
          
        
          const pong = Packet.deserialize<PongData>(bufferMsg);
          
          onFound({
            ip: rinfo.address,
            name: pong.name || 'Unknown',
            type: pong.type || 'Duckiebot',
            configuration: pong.configuration,
            hardware: pong.hardware
          });

        } catch (e) {
          console.warn(`Invalid packet (${rinfo.address}):`, e);
        }
      });

      this.socket.on('error', (err: any) => {
        console.log('Socket error:', err);
        this.stop();
      });

  
      this.socket.bind(44444); 
      this.port = 44444; 
      
      console.log(`Scanner listening on port ${this.port}`);


      const targetIps = await this.generateTargetIps();
      console.log(`${targetIps.length} IPs will be scanned...`);

      let count = 0;
      for (const ip of targetIps) {
        if (this.stopped) break;

        await this.sendPing(ip);
        count++;

        // Small pause every 10 packets to avoid flooding the network
        if (count % 10 === 0) {
           await new Promise(r => setTimeout(r, 2));
        }
      }

      console.log("Ping sending finished, waiting for replies...");
      
      // Wait a moment for responses
      if (!this.stopped) {
        await new Promise(r => setTimeout(r, 2000));
      }

      resolve();
    });
  }
}

export const startDuckiebotDiscovery = async (
  onRobotFound: (robot: DiscoveredRobotInfo) => void
): Promise<() => void> => {



  if (Platform.OS === 'web') {
      console.log("Web environment detected: using mock data...");
      onRobotFound(MOCK_ROBOTS[0]);
      onRobotFound(MOCK_ROBOTS[1]);
      // Return a no-op stop function for web
      return () => {};
  }

  const scanner = new UDPScanner();
  
  onRobotFound(MOCK_ROBOTS[0]);
  onRobotFound(MOCK_ROBOTS[1]);

  scanner.scan(onRobotFound).then(() => {
      console.log("Scan routine finished.");
  });

  return () => {
    scanner.stop();
  };
  
};
