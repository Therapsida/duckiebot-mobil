import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// @ts-ignore
const ROSLIB = require('../utils/roslib.js'); 

import 'text-encoding';

interface RosContextType {
  isConnected: boolean;
  connect: (ip: string) => void;
  disconnect: () => void;
  ros: any;
  sendMessage: (topicName: string, messageType: string, payload: any) => void;
}

const RosContext = createContext<RosContextType | undefined>(undefined);

export const RosProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const rosRef = useRef<any>(null);

  useEffect(() => {
    if (!ROSLIB) {
      console.error("ROSLIB module could not be loaded.");
      return;
    }

    let RosConstructor;
    if (typeof ROSLIB.Ros === 'function') {
      RosConstructor = ROSLIB.Ros;
    } else if (typeof ROSLIB === 'function') {
      RosConstructor = ROSLIB;
    } else {
       // @ts-ignore
       RosConstructor = global.ROSLIB?.Ros;
    }

    if (!RosConstructor) {
        console.error("ROSLIB.Ros constructor could not be found.");
        return;
    }

    try {
      rosRef.current = new RosConstructor({
        encoding: 'ascii'
      });

      rosRef.current.on('connection', () => {
        console.log('ROS is connected!');
        setIsConnected(true);
      });

      rosRef.current.on('error', (error: any) => {
        console.log('ROS connection error:', error);
        setIsConnected(false);
      });

      rosRef.current.on('close', () => {
        console.log('ROS connection closed.');
        setIsConnected(false);
      });

    } catch (err) {
      console.error("Ros could not start: ", err);
    }
  }, []);

  const connect = (ip: string) => {
    if (!rosRef.current) return;
    const cleanIp = ip.trim();
    const url = `ws://${cleanIp}:9001`;
    console.log(`ROS Target URL: ${url}`);
    rosRef.current.connect(url);
    try {
      if (isConnected) rosRef.current.close();
      rosRef.current.connect(url);
    } catch (e) {
      console.error("Connection error:", e);
    }
  };

  const disconnect = () => {
    if (rosRef.current) rosRef.current.close();
  };

  const sendMessage = (topicName: string, messageType: string, payload: any) => {
    if (!rosRef.current || !isConnected) return;

    try {

      const TopicClass = ROSLIB.Topic || (global as any).ROSLIB?.Topic;
      const MessageClass = ROSLIB.Message || (global as any).ROSLIB?.Message;

      if (!TopicClass || !MessageClass) {
          console.warn("Topic/Message class could not be found in ROSLIB.");
          return;
      }

      const topic = new TopicClass({
        ros: rosRef.current,
        name: topicName,
        messageType: messageType
      });

      const msg = new MessageClass(payload);
      topic.publish(msg);
      
    } catch (err) {
      console.error("Message send error:", err);
    }
  };

  return (
    <RosContext.Provider value={{ isConnected, connect, disconnect, ros: rosRef.current, sendMessage }}>
      {children}
    </RosContext.Provider>
  );
};

export const useRos = () => {
  const context = useContext(RosContext);
  if (!context) throw new Error("useRos must be used within a RosProvider");
  return context;
};