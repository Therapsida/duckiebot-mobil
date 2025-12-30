import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import { useDiscoveredDuckiebotInfo } from '../../../../context/DuckiebotContext';
import { useRos } from '../../../../context/RosContext';

export default function DetailScreen() {
  const { id } = useLocalSearchParams(); 
  
  const { data: robotList } = useDiscoveredDuckiebotInfo();
  const { connect, disconnect, isConnected, sendMessage } = useRos();

  const [currentRobot, setCurrentRobot] = useState<any>(null);

  useEffect(() => {
    const foundRobot = robotList.find(r => r.name === id);
    if (foundRobot) {
      setCurrentRobot(foundRobot);
      connect(foundRobot.ip);
    }
    
    return () => {
      disconnect();
    };
  }, [id, robotList]);

  if (!currentRobot) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Duckiebot Could Not Be Found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{currentRobot.name}</Text>
      <Text style={{ fontSize: 16, color: '#666', marginBottom: 20 }}>
        IP: {currentRobot.ip}
      </Text>

      <View style={{ marginBottom: 30 }}>
        {isConnected ? (
          <Text style={{ color: 'green', fontSize: 18, fontWeight: 'bold' }}>
            ROS MASTER IS CONNECTED
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#0000ff" />
            <Text style={{ marginLeft: 10 }}>Connecting...</Text>
          </View>
        )}
      </View>

      
      <Button 
        title="Start Lane Following" 
        disabled={!isConnected}
        onPress={() => {

          sendMessage(
             `/${currentRobot.name}/fsm_node/set_state`, 
             'duckietown_msgs/SetFSMState',
             {
                "state": "LANE_FOLLOWING"   
             }
          );
        }}
      />
      
      <View style={{ height: 20 }} />

      <Button 
        title="Stop!" 
        color="red"
        disabled={!isConnected}
        onPress={() => {
          sendMessage(
             `/${currentRobot.name}/fsm_node/set_state`, 
             'duckietown_msgs/SetFSMState',
             {
                "state": "NORMAL_JOYSTICK_CONTROL"   
             }
          );
        }}
      />
    </View>
  );
}