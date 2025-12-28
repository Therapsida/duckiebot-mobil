// context/RosContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// --- DEĞİŞİKLİK: Modülü require ile alıyoruz ---
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
    // 1. Kütüphane yüklendi mi kontrol et
    if (!ROSLIB) {
      console.error("❌ ROSLIB modülü boş geldi. utils/roslib.js sonuna 'module.exports = ROSLIB;' ekledin mi?");
      return;
    }

    // 2. Doğru yapıcıyı (Constructor) bul
    // Bazen direkt ROSLIB bir fonksiyondur, bazen ROSLIB.Ros bir fonksiyondur.
    let RosConstructor;
    if (typeof ROSLIB.Ros === 'function') {
      RosConstructor = ROSLIB.Ros;
    } else if (typeof ROSLIB === 'function') {
      // Bazen minified dosyalar direkt sınıfın kendisi olabilir
      RosConstructor = ROSLIB;
    } else {
       // Hiçbiri değilse global'e bak
       // @ts-ignore
       RosConstructor = global.ROSLIB?.Ros;
    }

    if (!RosConstructor) {
        console.error("❌ ROSLIB.Ros sınıfı bulunamadı. Yapıyı console.log(ROSLIB) ile incele.");
        return;
    }

    try {
      rosRef.current = new RosConstructor({
        encoding: 'ascii'
      });

      rosRef.current.on('connection', () => {
        console.log('✅ ROS Bağlantısı Başarılı!');
        setIsConnected(true);
      });

      rosRef.current.on('error', (error: any) => {
        console.log('❌ ROS Bağlantı Hatası');
        setIsConnected(false);
      });

      rosRef.current.on('close', () => {
        console.log('⚠️ ROS Bağlantısı Koptu');
        setIsConnected(false);
      });

    } catch (err) {
      console.error("ROS Başlatılamadı:", err);
    }
  }, []);

  const connect = (ip: string) => {
    if (!rosRef.current) return;
    const cleanIp = ip.trim();
    const url = `ws://${cleanIp}:9090`;
    console.log(`ROS Hedef: ${url}`);
    
    try {
      if (isConnected) rosRef.current.close();
      rosRef.current.connect(url);
    } catch (e) {
      console.error("Connect Hatası:", e);
    }
  };

  const disconnect = () => {
    if (rosRef.current) rosRef.current.close();
  };

  const sendMessage = (topicName: string, messageType: string, payload: any) => {
    if (!rosRef.current || !isConnected) return;

    try {
      // CDN versiyonunda sınıflar için güvenlik kontrolü
      const TopicClass = ROSLIB.Topic || (global as any).ROSLIB?.Topic;
      const MessageClass = ROSLIB.Message || (global as any).ROSLIB?.Message;

      if (!TopicClass || !MessageClass) {
          console.warn("Topic/Message sınıfı bulunamadı.");
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
      console.error("Mesaj Gönderme Hatası:", err);
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