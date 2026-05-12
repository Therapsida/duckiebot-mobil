import { DiscoveredRobotInfo, mdnsDiscovery } from "@/utils/mdns";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

// ── Mock robots ───────────────────────────────────────────────────────────────
// Both mocks are toggled on/off together with one boolean.
// isMock=true so the ROS layer can skip connecting to them.
const MOCK_ROBOTS: DiscoveredRobotInfo[] = [
  {
    name: "hostname",
    ip: "10.42.0.201",
    type: "Duckiebot",
    configuration: "DB21M",
    isMock: true,
  },
  {
    name: "duckiebot-beta",
    ip: "192.168.1.102",
    type: "Duckiebot",
    configuration: "DB21M",
    isMock: true,
  },
];

interface ListContextType {
  /** All visible robots: real discovered ones + mocks when showMocks is true */
  data: DiscoveredRobotInfo[];
  refreshData: () => void;
  isLoading: boolean;
  addDuckiebotByIP: (ip: string, name?: string) => void;
  /** Single toggle that shows/hides ALL mock robots at once */
  showMocks: boolean;
  setShowMocks: (value: boolean) => void;
}

const ListContext = createContext<ListContextType | undefined>(undefined);

export const DuckiebotProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [realData, setRealData] = useState<DiscoveredRobotInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMocks, setShowMocks] = useState(false);
  const isWeb = Platform.OS === "web";

  // Merge real + mocks into a single list consumed by the rest of the app
  const data: DiscoveredRobotInfo[] = showMocks
    ? [...realData, ...MOCK_ROBOTS.filter((m) => !realData.find((r) => r.ip === m.ip))]
    : realData;

  const scanWebServer = async () => {
    try {
      setIsLoading(true);
      setRealData([]);

      const serverHost = process.env.EXPO_PUBLIC_LOCAL_IP || "localhost";
      const serverPort = process.env.EXPO_PUBLIC_SCANNER_PORT || "3000";
      const serverUrl = `http://${serverHost}:${serverPort}/api/scan`;

      const response = await fetch(serverUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      console.log("[Web Discovery] Response:", response.status);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.robots) {
          setRealData(result.robots);
          console.log(
            `[Web Discovery] Found ${result.robots.length} duckiebots`,
          );
        }
      }
    } catch (error) {
      console.warn(
        "[Web Discovery] Failed to connect to server:",
        error,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const startScan = () => {
    if (isWeb) {
      scanWebServer();
      return;
    }

    mdnsDiscovery.stop();
    setIsLoading(true);
    setRealData([]);

    mdnsDiscovery.start((newRobot) => {
      setRealData((prev) => {
        if (prev.find((r) => r.ip === newRobot.ip)) return prev;
        return [...prev, newRobot];
      });
    });

    setTimeout(() => setIsLoading(false), 3000);
  };

  const addDuckiebotByIP = (ip: string, name?: string) => {
    const newRobot: DiscoveredRobotInfo = {
      name: name || `Duckiebot-${ip.split(".").pop()}`,
      ip: ip,
      type: "Duckiebot",
      configuration: "DB21M",
    };

    setRealData((prev) => {
      if (prev.find((r) => r.ip === newRobot.ip)) return prev;
      return [...prev, newRobot];
    });
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
    <ListContext.Provider
      value={{
        data,
        refreshData: startScan,
        isLoading,
        addDuckiebotByIP,
        showMocks,
        setShowMocks,
      }}
    >
      {children}
    </ListContext.Provider>
  );
};

export const useDiscoveredDuckiebotInfo = () => {
  const context = useContext(ListContext);
  if (!context)
    throw new Error("DuckiebotContext must be used within a DuckiebotProvider");
  return context;
};
