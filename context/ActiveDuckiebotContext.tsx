import { DiscoveredRobotInfo } from '@/utils/mdns';
import { useLocalSearchParams } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useDiscoveredDuckiebotInfo } from './DuckiebotContext'; // Senin DuckiebotProvider dosyanın yolu
import { useRos } from './RosContext'; // Senin RosProvider dosyanın yolu

interface ActiveRobotContextType {
  duckiebot: DiscoveredRobotInfo | null;
  connectionStatus: 'idle' | 'searching' | 'connecting' | 'connected' | 'failed';
  subscribe: (topicName: string, messageType: string, payload: any) => void;
  publish: (topicName: string, messageType: string, payload: any) => void;
  serviceCall: (serviceName: string, serviceType: string, args: any) => Promise<any>;
  retryConnection: () => void;
}

const ActiveRobotContext = createContext<ActiveRobotContextType | undefined>(undefined);

export const ActiveRobotProvider = ({ children }: { children: React.ReactNode }) => {

  const { id } = useLocalSearchParams(); 
  const { data: duckiebots, isLoading: isDiscoveryLoading } = useDiscoveredDuckiebotInfo();
  const { connect, disconnect, isConnected: isRosConnected, sendMessage, getMessage, callService } = useRos();


  const [duckiebot, setDuckiebot] = useState<DiscoveredRobotInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'searching' | 'connecting' | 'connected' | 'failed'>('idle');


    const subscribe = (topicName: string, messageType: string, callback: (msg: any) => void) => {
      if (getMessage && duckiebot) {
        return getMessage(`/${duckiebot.name}${topicName}`, messageType, callback);
      }
      return () => {};
    };

    const publish = (topicName: string, messageType: string, payload: any) => {
      if (sendMessage && duckiebot) {
        sendMessage(`/${duckiebot.name}${topicName}`, messageType, payload);
      }
    };

    const serviceCall = async (serviceName: string, serviceType: string, args: any) => {
      if (callService && duckiebot) {
        return await callService(`/${duckiebot.name}${serviceName}`, serviceType, args);
      }
      return Promise.reject('ROS service call not available');
    };

    const retryConnection = () => {
      if (duckiebot) {
        setStatus('connecting');
        connect(duckiebot.ip);
      }
    };

   useEffect(() => {
      const foundDuckiebot = duckiebots.find(r => r.name === id);
    if (foundDuckiebot) {
        setDuckiebot(foundDuckiebot);
        setStatus('connecting');
        connect(foundDuckiebot.ip);
      }
      
      return () => {
        disconnect();
      };
    }, [id, duckiebots]);

    useEffect(() => {
        if (isRosConnected) {
            setStatus('connected');
        } else {
            if (status === 'connecting') {
                setStatus('failed');
            }
        }
    }, [isRosConnected]);

    if (!duckiebot) {
      return (
        <ActiveRobotContext.Provider value={{ 
          duckiebot: null,
          connectionStatus: 'failed'
          , subscribe, publish, serviceCall, retryConnection
        }}>
          {children}
        </ActiveRobotContext.Provider>
      );
    }

  
  

  return (
    <ActiveRobotContext.Provider value={{ 
      duckiebot, 
      connectionStatus: status
      , subscribe, publish, serviceCall, retryConnection
    }}>
      {children}
    </ActiveRobotContext.Provider>
  );
};

export const useActiveDuckiebot = () => {
  const context = useContext(ActiveRobotContext);
  if (!context) throw new Error("useActiveDuckiebot must be used within an ActiveRobotProvider");
  return context;
};
