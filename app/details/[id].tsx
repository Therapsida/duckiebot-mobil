import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import { useDiscoveredDuckiebotInfo } from '../../context/DuckiebotContext';
import { useRos } from '../../context/RosContext';

export default function DetailScreen() {
  // 1. URL'deki parametreyi al (dosya adı [id].tsx olduğu için 'id' gelir)
  const { id } = useLocalSearchParams(); 
  
  // 2. Contextlerden veriyi çek
  const { data: robotList } = useDiscoveredDuckiebotInfo();
  const { connect, disconnect, isConnected, sendMessage } = useRos();

  const [currentRobot, setCurrentRobot] = useState<any>(null);

  useEffect(() => {
    const foundRobot = robotList.find(r => r.name === id);
    
    if (foundRobot) {
      setCurrentRobot(foundRobot);
      // 3. Robot bulunduysa, IP adresine bağlan!
      connect(foundRobot.ip);
    }
    
    // Sayfadan çıkınca bağlantıyı kes
    return () => {
      disconnect();
    };
  }, [id, robotList]); // ID değişirse tekrar çalış

  if (!currentRobot) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Robot bulunamadı veya liste boş.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{currentRobot.name}</Text>
      <Text style={{ fontSize: 16, color: '#666', marginBottom: 20 }}>
        IP: {currentRobot.ip}
      </Text>

      {/* Bağlantı Durumu */}
      <View style={{ marginBottom: 30 }}>
        {isConnected ? (
          <Text style={{ color: 'green', fontSize: 18, fontWeight: 'bold' }}>
            ✅ ROS Bağlı
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#0000ff" />
            <Text style={{ marginLeft: 10 }}>Bağlanıyor...</Text>
          </View>
        )}
      </View>

      {/* Kontrol Butonları */}
      <Button 
        title="İleri Sür" 
        disabled={!isConnected} // Bağlı değilse basamasın
        onPress={() => {
          // Örnek Hız Komutu
          sendMessage(
             `/${currentRobot.name}/wheels_driver_node/wheels_cmd`, 
             'duckietown_msgs/WheelsCmdStamped',
             {
               header: { seq: 0, stamp: { secs: 0, nsecs: 0 }, frame_id: '' },
               vel_left: 0.4,
               vel_right: 0.4
             }
          );
        }}
      />
      
      <View style={{ height: 20 }} />

      <Button 
        title="Dur" 
        color="red"
        disabled={!isConnected}
        onPress={() => {
          sendMessage(
             `/${currentRobot.name}/wheels_driver_node/wheels_cmd`, 
             'duckietown_msgs/WheelsCmdStamped',
             { header: { seq: 0, stamp: { secs: 0, nsecs: 0 }, frame_id: '' }, vel_left: 0, vel_right: 0 }
          );
        }}
      />
    </View>
  );
}