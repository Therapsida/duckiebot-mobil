import { Buffer } from 'buffer';
import * as Network from 'expo-network';
import dgram from 'react-native-udp';

// React Native'de Buffer'ı global yapmak zorundayız
global.Buffer = global.Buffer || Buffer;

// --- Constants ---
const REMOTE_PORT = 11411; // Duckiebot'un dinlediği port

// --- Interfaces & Types ---
export interface DiscoveredRobotInfo {
  ip: string;
  name: string;
  type: string;
  configuration: string;
  hardware: string;
}

const MOCK_ROBOTS: DiscoveredRobotInfo[] = [
  { ip: '172.17.0.2', name: 'yunus', type: 'Duckiebot', configuration: 'DB21M', hardware: 'Raspberry Pi 4' },
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

// --- Packet Classes (Mantık Aynen Korundu) ---

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

// --- Main Scanner Class ---

export class UDPScanner {
  private socket: any; // dgram tipi RN'de bazen typescript hatası verebilir, any güvenlidir
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
      // Socket zaten kapalı olabilir
    }
  }

  // --- IP Üretme Mantığı (Mobile Uyarlanmış) ---
  // Node.js'deki os.networkInterfaces yerine telefonun IP'sini alıp subnet'i tahmin ediyoruz.
  private async generateTargetIps(): Promise<string[]> {
    try {
      const ip = await Network.getIpAddressAsync();
      console.log(`Cihaz IP: ${ip}`);

      if (!ip || ip === '0.0.0.0') return [];

      // Basit varsayım: /24 subnet (Class C) tarıyoruz.
      // Örn: IP 192.168.1.35 ise -> 192.168.1.1'den 192.168.1.254'e kadar
      const parts = ip.split('.');
      const prefix = parts.slice(0, 3).join('.');
      
      const targets: string[] = [];
      for (let i = 1; i < 255; i++) {
        // Kendi IP'mizi atlayabiliriz ama Duckiebot simülasyonu kendimizdeyse gerekebilir.
        targets.push(`${prefix}.${i}`);
      }
      return targets;

    } catch (e) {
      console.error("IP alınamadı:", e);
      return [];
    }
  }

  private async sendPing(host: string): Promise<void> {
    return new Promise((resolve) => {
      // Senin PingPacket yapını kullanıyoruz
      const ping = new PingPacket('1', this.port);
      const message = ping.serialize();
      
      // react-native-udp send formatı: msg, offset, length, port, host, callback
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
      
      // 1. Dinleyiciyi Kur
      this.socket.on('message', (msg: any, rinfo: any) => {
        if (this.stopped) return;
        try {
          // Gelen mesaj Buffer array gelir, string'e veya Buffer'a çevir
          const bufferMsg = Buffer.from(msg); 
          
          // Senin PongPacket deserializer'ını kullanıyoruz
          const pong = Packet.deserialize<PongData>(bufferMsg);
          
        //   console.log(`Robot bulundu: ${rinfo.address}`);
          
          onFound({
            ip: rinfo.address,
            name: pong.name || 'Unknown',
            type: pong.type || 'Duckiebot',
            configuration: pong.configuration,
            hardware: pong.hardware
          });

        } catch (e) {
        //   console.warn(`Geçersiz paket (${rinfo.address}):`, e);
        }
      });

      this.socket.on('error', (err: any) => {
        console.log('Socket Hatası:', err);
        this.stop();
      });

      // 2. Soketi Bağla (Bind)
      // Port 0 verince rastgele boş bir port seçer (Ephemeral Port)
      this.socket.bind(44444); 
      this.port = 44444; 
      
      console.log(`Scanner listening on port ${this.port}`);

      // 3. Hedefleri Belirle
      const targetIps = await this.generateTargetIps();
      console.log(`${targetIps.length} adet IP taranacak...`);

      // 4. Taramayı Başlat
      let count = 0;
      for (const ip of targetIps) {
        if (this.stopped) break;

        await this.sendPing(ip);
        count++;

        // Ağ trafiğini boğmamak için her 10 pakette bir minik bekleme
        if (count % 10 === 0) {
           await new Promise(r => setTimeout(r, 2));
        }
      }

      console.log("Ping paketi gönderimi bitti, cevaplar bekleniyor...");
      
      // Cevapların gelmesi için 2 saniye bekle
      if (!this.stopped) {
        await new Promise(r => setTimeout(r, 2000));
      }

      resolve();
    });
  }
}

// --- Usage Wrapper (Bunu React Component'inden çağıracaksın) ---

export const startDuckiebotDiscovery = async (
  onRobotFound: (robot: DiscoveredRobotInfo) => void
): Promise<() => void> => {

 onRobotFound(MOCK_ROBOTS[0])
      onRobotFound(MOCK_ROBOTS[1])
      return () => {
    () => {console.log("Mock tarama durduruldu.");};
  }; 

  

/*
if (Platform.OS === 'web') {
      console.log("Web ortamı algılandı: Mock (Sahte) veri kullanılıyor...");
      onRobotFound(MOCK_ROBOTS[0])
      onRobotFound(MOCK_ROBOTS[1])
      return () => {
    scanner.stop();
  };
}

  const scanner = new UDPScanner();
  
  // Asenkron olarak taramayı başlat (await kullanmıyoruz ki UI donmasın)
  scanner.scan(onRobotFound).then(() => {
      console.log("Scan routine finished.");
      // Otomatik kapatmak istersen burayı aç:
      // scanner.stop(); 
  });

  // Geriye durdurma fonksiyonu döndür (useEffect cleanup için)
  return () => {
    scanner.stop();
  };
  */
};