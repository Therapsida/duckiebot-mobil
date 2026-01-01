import { ButtonDuckie } from '@/components/ButtonDuckie';
import { useActiveDuckiebot } from '@/context/ActiveDuckiebotContext';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Text, View } from 'tamagui';

export default function HomeScreen() {
  const { duckiebot, connectionStatus, serviceCall } = useActiveDuckiebot();

  const isConnected = connectionStatus === 'connected';

  return (
    <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{duckiebot?.name}</Text>
      <Text style={{ fontSize: 16, color: '#666', marginBottom: 20 }}>
        IP: {duckiebot?.ip}
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

      
      <ButtonDuckie  
      text=' Start Lane Following'
        disabled={!isConnected}
        onPress={() => {
          console.log("Starting lane following", duckiebot?.name);
          serviceCall(
             `/fsm_node/set_state`, 
             'duckietown_msgs/SetFSMState',
             {
                "state": "LANE_FOLLOWING"   
             }
          );
        }}
      />
       
      
      <View style={{ height: 20 }} />

      <ButtonDuckie 
        text='Stop!'
        theme="red"
        disabled={!isConnected}
        opacity={!isConnected ? 0.5 : 1}
        onPress={() => {
          serviceCall(
             `/fsm_node/set_state`, 
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