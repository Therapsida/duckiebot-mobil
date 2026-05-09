import { DiscoveredRobotInfo, mdnsDiscovery } from '@/utils/mdns';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';


const USE_MOCK_DATA = false; 




interface ListContextType {
  data: DiscoveredRobotInfo[];
  refreshData: () => void;
  isLoading: boolean;
}

const mockRobots: DiscoveredRobotInfo[] = [
  {
    name: "yakisikli2",
    ip: "192.168.43.64",
    type: "Duckiebot",
    configuration: "DB21M"
  },
  {
    name: "duckiebot-beta",
    ip: "192.168.1.102",
    type: "Duckiebot",
    configuration: "DB21M"
  }
];


const ListContext = createContext<ListContextType | undefined>(undefined);

export const DuckiebotProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<DiscoveredRobotInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isWeb = Platform.OS === 'web';

  const startScan = () => {
    if (isWeb) {
      setIsLoading(false);
      setData(mockRobots);
      return;
    }

    if(USE_MOCK_DATA) {
      setIsLoading(true);
      setData(mockRobots);
      setTimeout(() => setIsLoading(false), 1000);
      return;
    }


    mdnsDiscovery.stop();

    setIsLoading(true);
    setData([]);

    mdnsDiscovery.start((newRobot) => {
      setData((prev) => {
        if (prev.find(r => r.ip === newRobot.ip)) return prev;
        return [...prev, newRobot];
      });
    });
    
    setTimeout(() => setIsLoading(false), 3000);
  };

  useEffect(() => {
    startScan();
    return () => {
      if (!isWeb) {
        mdnsDiscovery.stop();
      }
    };
  }, [isWeb]);

  return (
    <ListContext.Provider value={{ data, refreshData: startScan, isLoading }}>
      {children}
    </ListContext.Provider>
  );
};

export const useDiscoveredDuckiebotInfo = () => {
  const context = useContext(ListContext);
  if (!context) throw new Error("DuckiebotContext must be used within a DuckiebotProvider");
  return context;
};