import { Buffer } from 'buffer';
import dgram from 'react-native-udp';

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


export type DiscoveryCallback = (robot: DiscoveredRobotInfo) => void;

class DuckietownDiscoveryService {
  private socket: any;
  private isDiscovering: boolean = false;
  private discoveryPort: number = 19000;
  private callback: DiscoveryCallback | null = null;

  constructor() {
    this.socket = dgram.createSocket({type: 'udp4'});
  }

  
  public async start(onDiscover: DiscoveryCallback) {
    if (this.isDiscovering) return;
    
    this.callback = onDiscover;
    this.isDiscovering = true;

    this.socket.bind(this.discoveryPort, (err: any) => {
      if (err) {
        console.error('Error binding socket:', err);
        this.stop();
        return;
      }
      
      this.socket.setBroadcast(true);
      console.log('Discovery socket bound and broadcast enabled.');
      

      this.startBroadcasting();
    });


    this.socket.on('message', (msg: Uint8Array, rinfo: any) => {
      console.log(`Received message from ${rinfo.address}, ${msg}`);
      this.handleMessage(msg, rinfo);
    });

    this.socket.on('error', (err: any) => {
      console.error('Socket error:', err);
    });
  }


  public stop() {
    this.isDiscovering = false;
    this.callback = null;
    
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        console.warn('Error closing socket', e);
      }

      this.socket = dgram.createSocket({type: 'udp4'});
    }
  }


  private async startBroadcasting() {
    if (!this.isDiscovering) return;

    try {

      const message = Buffer.from('DT_PING'); 
      const broadcastAddr = '255.255.255.255';


      this.socket.send(message, 0, message.length, this.discoveryPort, broadcastAddr, (err: any) => {
        if (err) console.error('Error sending broadcast:', err);
      });

     
      setTimeout(() => this.startBroadcasting(), 1000);

    } catch (error) {
      console.error('Broadcasting loop error:', error);
    }
  }


  private handleMessage(msg: Uint8Array, rinfo: any) {
    try {
      const msgString = String.fromCharCode(...msg);

      if (msgString === 'DT_PING') return;

      const data = JSON.parse(msgString);


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

    }
  }
}

export const duckietownDiscovery = new DuckietownDiscoveryService();