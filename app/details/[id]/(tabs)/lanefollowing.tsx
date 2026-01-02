import { useActiveDuckiebot } from '@/context/ActiveDuckiebotContext';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from "react-native";
import WebView from 'react-native-webview';
import { Button, Stack, Text, XStack, YStack } from 'tamagui';

export default function HomeScreen() {
  const { duckiebot, connectionStatus, serviceCall, publish, subscribe} = useActiveDuckiebot();
  const webViewRef = useRef<WebView>(null);
  const lastUpdate = useRef<number>(0);
  const navigation = useNavigation();
  const router = useRouter();
  const isConnected = connectionStatus === 'connected';
  const [hasData, setHasData] = useState(false);
  const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
        body { margin: 0; padding: 0; background-color: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
        #streamImage { width: 100%; height: 100%; object-fit: contain;  object-fit: fill;}
    </style>
</head>
<body>
    <img id="streamImage" src="" />
</body>
</html>
`;
    const TARGET_FPS = 20;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

   useEffect(() => {
       if (!isConnected || !duckiebot?.name) return;
       const topicName = `/line_detector_node/debug/maps/compressed`;
       const messageType = 'sensor_msgs/CompressedImage';
   
       const unsubscribe = subscribe(topicName, messageType, (message: any) => {
         const now = Date.now();
         if (now - lastUpdate.current > FRAME_INTERVAL) {
           if (!hasData) setHasData(true);
           const base64Str = `data:image/jpeg;base64,${message.data}`;
           const script = `
             var img = document.getElementById('streamImage');
             if (img) img.src = "${base64Str}";
             true; 
           `;
           webViewRef.current?.injectJavaScript(script);
           lastUpdate.current = now;
         }
       });
       return () => unsubscribe;
     }, [connectionStatus, duckiebot?.name, hasData]);


  return (
    <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
    <YStack 
      fullscreen 
      alignItems="center" 
      justifyContent="center" 
      backgroundColor="$background" 
      space="$5" 
    >
      
      <Stack
        width={300}
        height={300}
        backgroundColor="black" 
        borderWidth={4}
        borderColor="$duckBlue"
        alignItems="center"
        justifyContent="center"
        borderRadius={0}
        overflow="hidden" 
        position="relative" 
      >
          
          <View style={styles.fullScreenVideo} pointerEvents='none'>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: HTML_CONTENT }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                scrollEnabled={false}
                javaScriptEnabled={true}
                containerStyle={{ backgroundColor: 'black' }} 
            />
            
            {(!isConnected || !hasData) && (
              <View style={styles.overlayPlaceholder}>
                {isConnected ? (
                  <YStack alignItems="center" space="$2">
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text color="white">Waiting for stream...</Text>
                  </YStack>
                ) : (
                  <Text style={styles.infoText}>Duckiebot Not Connected</Text>
                )}
              </View>
            )}
          </View>
      </Stack>

      <XStack space="$4">
        
        
        <Button 
          borderColor="black" 
          borderWidth={2}
          backgroundColor={!isConnected ? '#cccccc' : '$duckBlue'} 
          size="$5"
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
        >
          <Text color="white" fontFamily="$body">START LANE FOLLOWING</Text>
        </Button>

       <Button 
      theme="red"
      disabled={!isConnected}
   
      
      backgroundColor={!isConnected ? '#cccccc' : 'red'} 
      
      onPress={() => {
        serviceCall(
            `/fsm_node/set_state`, 
            'duckietown_msgs/SetFSMState',
            {
              "state": "NORMAL_JOYSTICK_CONTROL"   
            }
          );

          publish(`/wheels_driver_node/emergency_stop`, `duckietown_msgs/BoolStamped`, {
    header: {
      seq: 0,
      stamp: { secs: 0, nsecs: 0 }, 
      frame_id: ''
    },
    data: true
  })
        }}
        
  
      borderColor="black" 
      borderWidth={2}
      size="$5"
    >
  <Text color="white" fontFamily="$body">STOP!</Text>
</Button>

      </XStack>
    </YStack>
  
      
      

     

    </View>

    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
    zIndex: -1, 
    position: 'absolute', 
  },
  overlayPlaceholder: {
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  infoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerOverlay: {
    position: 'absolute',
    top: 20,
    right: 40,
    zIndex: 10,
  },
  controlsRow: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'flex-end', 
    zIndex: 10,
  },
  controlContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 220,
    height: 220,
    backgroundColor: 'transparent', 
  }
});
