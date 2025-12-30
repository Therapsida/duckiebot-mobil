import Zeroconf from 'react-native-zeroconf';

export interface DiscoveredRobotInfo {
  name: string;       
  ip: string;          
  type: string;         
  configuration: string;
}

export type MdnsCallback = (service: DiscoveredRobotInfo) => void;

class MdnsDiscoveryService {
  private zeroconf: Zeroconf;
  private services: Map<string, DiscoveredRobotInfo> = new Map();
  private callback: MdnsCallback | null = null;

  constructor() {
    this.zeroconf = new Zeroconf();

    this.zeroconf.on('found', (name) => {
      console.log(`[mDNS] Found service: ${name}`);
      // Only resolve if it looks like a Duckietown service
    });

   this.zeroconf.on('resolved', (service) => {
      console.log(`[mDNS] Resolved: ${service.name}`, service);
      this.handleServiceResolved(service);
    });

    this.zeroconf.on('error', (err) => {
      console.error('[mDNS] Error:', err);
    });
  }

  
  public start(onDiscover: MdnsCallback) {
    this.callback = onDiscover;
    this.services.clear();
    
    console.log('[mDNS] Starting scan...');
    this.zeroconf.scan('duckietown', 'tcp', 'local.');
  }

  public stop() {
    console.log('[mDNS] Stopping scan...');
    this.zeroconf.stop();
    this.callback = null;
  }

  private handleServiceResolved(service: any) {
    if (!service.name.startsWith('DT::ROBOT_CONFIGURATION')) return;

    let parsedTxt = {};
    if (service.txt) {
      try {
        parsedTxt = service.txt;
      } catch (e) {
        console.warn('Failed to parse TXT record', e);
      }
    }
    console.log('[mDNS] Parsed TXT:', parsedTxt);
    console.log('[mDNS] Service Info:', service);

    const dtService: DiscoveredRobotInfo = parseService(service);

    // Deduplicate
    this.services.set(dtService.name, dtService);

    if (this.callback) {
      this.callback(dtService);
    }
  }
}

export const parseService = (service: any): DiscoveredRobotInfo => {
  
  const nameParts = service.name ? service.name.split('::') : [];
  const cleanName = nameParts.length >= 3 ? nameParts[2] : service.name;

  let ip = service.host;
  if (service.addresses && Array.isArray(service.addresses)) {
    const ipv4 = service.addresses.find((addr: string) => addr.includes('.') && !addr.includes(':'));
    if (ipv4) ip = ipv4;
  }

  let configuration = 'DB21M';
  let type = 'Duckiebot';  

  if (service.txt) {
    const rawKeys = Object.keys(service.txt);
    
    if (rawKeys.length > 0) {
      try {
        const jsonString = rawKeys[0];
        const parsedData = JSON.parse(jsonString);

        if (parsedData.configuration) {
          configuration = parsedData.configuration; 
        }
        
        if (parsedData.type) {
          type = parsedData.type;
        }
      } catch (e) {
        console.warn('Failed to parse inner JSON from TXT record', e);
      }
    }
  }

  return {
    name: cleanName,
    ip: ip,
    type: type,
    configuration: configuration
  };
};



export const mdnsDiscovery = new MdnsDiscoveryService();