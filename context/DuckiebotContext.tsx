// context/ListContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
// Yeni yazdığımız dosyayı import et
import { DiscoveredRobotInfo, startDuckiebotDiscovery } from '../utils/udpscanner';

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
    // Önceki listeyi temizle (isteğe bağlı)
    // setData([]); 

    const stopScan = await startDuckiebotDiscovery((newRobot) => {
      setData((prev) => {
        // Çift kaydı engelle
        if (prev.find(r => r.ip === newRobot.ip)) return prev;
        return [...prev, newRobot];
      });
    });
    
    // Yüklenme ikonunu 3 sn sonra kapat (veya tarama bitince)
    setTimeout(() => setIsLoading(false), 3000);

    // Cleanup fonksiyonu döndür
    return stopScan;
  };

  useEffect(() => {
    let stopFn: (() => void) | undefined;
    
    // Sayfa açılınca taramayı başlat
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