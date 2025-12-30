import { mdnsDiscovery } from '@/utils/mdns';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { DiscoveredRobotInfo } from '../utils/mdns';

interface ListContextType {
  data: DiscoveredRobotInfo[];
  refreshData: () => void;
  isLoading: boolean;
}

const ListContext = createContext<ListContextType | undefined>(undefined);

export const DuckiebotProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<DiscoveredRobotInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const startScan = async () => {
    setIsLoading(true);
    setData([]);
    const stopScan = await mdnsDiscovery.start((newRobot) => {
      setData((prev) => {
        if (prev.find(r => r.ip === newRobot.ip)) return prev;
        return [...prev, newRobot];
      });
    });
    
    setTimeout(() => setIsLoading(false), 3000);

    return stopScan;
  };

  useEffect(() => {
    let stopFn: (() => void) | undefined;
    
    startScan().then(fn => { stopFn = fn; });

    return () => {
      if (stopFn) stopFn();
    };
  }, []);

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