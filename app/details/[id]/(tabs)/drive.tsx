import { useActiveDuckiebot } from '@/context/ActiveDuckiebotContext';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview'; // WebView importu
import { Text } from 'tamagui';

interface VideoStreamProps {
  duckiebotName?: string;
}

const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
        body { margin: 0; padding: 0; background-color: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
        #streamImage { width: 100%; height: 100%; object-fit: contain; }
    </style>
</head>
<body>
    <img id="streamImage" src="" />
</body>
</html>
`;

const VideoStream: React.FC<VideoStreamProps> = () => {
  const { duckiebot, connectionStatus, serviceCall, subscribe, publish } = useActiveDuckiebot();
  const webViewRef = useRef<WebView>(null);
  const lastUpdate = useRef<number>(0);
  
  const TARGET_FPS = 20;
  const FRAME_INTERVAL = 1000 / TARGET_FPS; 

  const [steerValue, setSteerValue] = useState(0);

  const handleSteer = (value: number) => {
    setSteerValue(value);
    console.log("Steer Value:", value);
  };
  
  const [hasData, setHasData] = useState(false);
  const isConnected = connectionStatus === 'connected';

  useEffect(() => {
    if (!isConnected || !duckiebot?.name) return;
    // object detection nodu /${duckiebot.name}/object_detection_node/debug/image/compressed
    // /${duckiebot.name}/camera_node/image/compressed
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
  }, [connectionStatus, duckiebot?.name, hasData]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Camera Feed({duckiebot?.name})</Text>
      
      <View style={styles.frame}>
        <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: HTML_CONTENT }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            scrollEnabled={false}
            javaScriptEnabled={true}
            containerStyle={{backgroundColor: 'black'}} 
        />
        
       
        {(!isConnected || !hasData) && (
          <View style={[styles.placeholder, {position: 'absolute', width: '100%', height: '100%', backgroundColor: 'black'}]}>
             {isConnected ? (
              <ActivityIndicator size="large" color="#FFD700" /> 
            ) : (
              <Text style={styles.infoText}>Robot is not connected</Text>
            )}
          </View>
        )}
      </View>

      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  frame: {
    width: 320,
    height: 240,
    backgroundColor: '#000',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#444',
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    color: '#fff',
  }
});

export default VideoStream;