import { useDiscoveredDuckiebotInfo } from '@/context/DuckiebotContext';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview'; // WebView importu
import { useRos } from '../../../../context/RosContext';

interface VideoStreamProps {
  robotName?: string;
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
  const { isConnected, getMessage } = useRos();
  const { id } = useLocalSearchParams(); 
  const { data: robotList } = useDiscoveredDuckiebotInfo();
  
  // WebView referansı
  const webViewRef = useRef<WebView>(null);
  const lastUpdate = useRef<number>(0);
  
  const TARGET_FPS = 20;
  const FRAME_INTERVAL = 1000 / TARGET_FPS; 

  const duckiebotName = robotList?.find(r => r.name === id)?.name || 'yakisikli';
  
  // İlk veri geldi mi kontrolü (Loading spinner için)
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!isConnected || !duckiebotName) return;
    // object detection nodu /${duckiebotName}/object_detection_node/debug/image/compressed
    // /${duckiebotName}/camera_node/image/compressed
    const topicName = `/${duckiebotName}/line_detector_node/debug/maps/compressed`;
    const messageType = 'sensor_msgs/CompressedImage';

    const unsubscribe = getMessage(topicName, messageType, (message: any) => {
      const now = Date.now();
      
      if (now - lastUpdate.current > FRAME_INTERVAL) {
        if (!hasData) setHasData(true);

        // KRİTİK NOKTA: State güncellemek yerine doğrudan WebView içindeki JS'i tetikliyoruz.
        // Bu, React render döngüsüne girmez, titremeyi engeller.
        const base64Str = `data:image/jpeg;base64,${message.data}`;
        const script = `
          var img = document.getElementById('streamImage');
          if (img) img.src = "${base64Str}";
          true; // İnjeksiyonun başarılı dönmesi için
        `;
        
        webViewRef.current?.injectJavaScript(script);
        lastUpdate.current = now;
      }
    });

    return () => {
      // unsubscribe();
    };
  }, [isConnected, duckiebotName, hasData]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Kamera Akışı ({duckiebotName})</Text>
      
      <View style={styles.frame}>
        {/* WebView Her zaman render edilir, ancak veri gelene kadar gizli tutulabilir veya siyah görünür */}
        <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: HTML_CONTENT }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            scrollEnabled={false}
            javaScriptEnabled={true}
            // Android'de transparanlık sorunu olmaması için:
            containerStyle={{backgroundColor: 'black'}} 
        />
        
        {/* Veri gelmediyse üstte Loading göster */}
        {(!isConnected || !hasData) && (
          <View style={[styles.placeholder, {position: 'absolute', width: '100%', height: '100%', backgroundColor: 'black'}]}>
             {isConnected ? (
              <ActivityIndicator size="large" color="#FFD700" /> 
            ) : (
              <Text style={styles.infoText}>Robot Bağlı Değil</Text>
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
    position: 'relative', // Absolute loading için
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