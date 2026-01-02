import { SteeringWheel } from '@/components/SteeringWheel';
import { ThrottleController } from '@/components/ThrottleController';
import { useActiveDuckiebot } from '@/context/ActiveDuckiebotContext';
import { ChevronLeft } from '@tamagui/lucide-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withSpring } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { Button, Text, YStack } from 'tamagui';

// Ekran boyutlarını al (Hesaplamalar için gerekli)
const { width, height } = Dimensions.get('window');

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
  const { duckiebot, connectionStatus, subscribe, publish } = useActiveDuckiebot();
  const webViewRef = useRef<WebView>(null);
  const lastUpdate = useRef<number>(0);
  const navigation = useNavigation();
  const router = useRouter();

  const TARGET_FPS = 20;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const [hasData, setHasData] = useState(false);
  const isConnected = connectionStatus === 'connected';

  const [steerValue, setSteerValue] = useState<number>(0);


  const handleSteer = useCallback((value: number) => {
    setSteerValue(steerValue)
  }, []);

  const handleThrottle = useCallback((value: number) => {
    const val_left = ((1 - steerValue) / 2)*value
    const val_right = ((1 + steerValue) / 2)*value

    publish(`/wheels_driver_node/wheels_cmd`, 'duckietown_msgs/WheelsCmdStamped', {
      header: { seq: 0, stamp: { secs: 0, nsecs: 0 }, frame_id: '' },
      vel_left: val_left,
      vel_right: val_right
      
    }
    )
  }, []);


  const rotation = useSharedValue(0);
  
  const translateY = useSharedValue(0);
  const MAX_THROTTLE_MOVE = 220 / 2 - 40;

  const activeTrackers = useSharedValue<Record<number, { 
    target: 'steer' | 'throttle', 
    startY: number, 
    startVal: number 
  }>>({}); 

  const COMPONENT_SIZE = 220; 
  const MARGIN = 20; 

  const masterGesture = Gesture.Manual()
    .onTouchesDown((e, manager) => {
      
      for (const touch of e.changedTouches) {
     
        const isInsideSteering = 
            touch.x >= MARGIN && 
            touch.x <= (MARGIN + COMPONENT_SIZE) &&
            touch.y >= (height - MARGIN - COMPONENT_SIZE) && 
            touch.y <= (height - MARGIN);
       
        const isInsideThrottle = 
            touch.x >= (width - MARGIN - COMPONENT_SIZE) && 
            touch.x <= (width - MARGIN) &&
            touch.y >= (height - MARGIN - COMPONENT_SIZE) && 
            touch.y <= (height - MARGIN);

      
        if (!isInsideSteering && !isInsideThrottle) {
           continue; 
        }

        const target = isInsideSteering ? 'steer' : 'throttle';
        

        const currentVal = target === 'steer' ? rotation.value : translateY.value;

        activeTrackers.value = {
          ...activeTrackers.value,
          [touch.id]: {
            target: target,
            startY: touch.y,
            startVal: currentVal
          }
        };
      }
    })
    .onTouchesMove((e, manager) => {
      for (const touch of e.changedTouches) {
        const tracker = activeTrackers.value[touch.id];
        if (tracker) {

           const isInsideSteering = 
            touch.x >= MARGIN && 
            touch.x <= (MARGIN + COMPONENT_SIZE) &&
            touch.y >= (height - MARGIN - COMPONENT_SIZE) && 
            touch.y <= (height - MARGIN);
        
            const isInsideThrottle = 
            touch.x >= (width - MARGIN - COMPONENT_SIZE) && 
            touch.x <= (width - MARGIN) &&
            touch.y >= (height - MARGIN - COMPONENT_SIZE) && 
            touch.y <= (height - MARGIN);

          if (!isInsideSteering && !isInsideThrottle) {
              continue; 
          }

          if (tracker.target === 'throttle') {

           

            const deltaY = touch.y - tracker.startY;
            const newY = tracker.startVal + deltaY;
            const clampedY = Math.max(-MAX_THROTTLE_MOVE, Math.min(MAX_THROTTLE_MOVE, newY));
            
            translateY.value = clampedY;
            const normalizedValue = -clampedY / MAX_THROTTLE_MOVE;
            runOnJS(handleThrottle)(normalizedValue);

          } else {
        
            const centerX = MARGIN + (COMPONENT_SIZE / 2); 
            const centerY = height - MARGIN - (COMPONENT_SIZE / 2);
            
            const deltaX = touch.x - centerX;
            const deltaY = touch.y - centerY;

            let angleRad = Math.atan2(deltaY, deltaX);
            let angleDeg = angleRad * (180 / Math.PI);
            angleDeg += 90; 
            if (angleDeg > 180) angleDeg -= 360;
            
            const clampedAngle = Math.max(-100, Math.min(100, angleDeg));
            rotation.value = clampedAngle;
            const normalizedSteer = clampedAngle / 100;
            runOnJS(handleSteer)(normalizedSteer);
          }
        }
      }
    })
    .onTouchesUp((e, manager) => {
      for (const touch of e.changedTouches) {
        const tracker = activeTrackers.value[touch.id];
        if (tracker) {
          if (tracker.target === 'throttle') {
            translateY.value = withSpring(0);
            runOnJS(handleThrottle)(0);
          } else {
            rotation.value = withSpring(0);
            runOnJS(handleSteer)(0);
          }
        
        }
      }
    });


  useFocusEffect(
    useCallback(() => {
      const lockLandscape = async () => {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        navigation.setOptions({ tabBarStyle: { display: "none" } });
      };
      lockLandscape();
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => {
        subscription.remove();
        navigation.setOptions({ tabBarStyle: undefined });
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, [])
  );

  const handleBack = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    router.back();
  };

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={masterGesture}>
        <View style={styles.container}>
          <StatusBar hidden />

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

          <Button
            position="absolute"
            top={20}
            left={20}
            zIndex={100} 
            size="$3"
            circular 
            backgroundColor="rgba(0,0,0,0.5)" 
            borderWidth={1}
            borderColor="rgba(255,255,255,0.3)"
            onPress={handleBack}
            icon={ChevronLeft} 
          />
         
          <View style={styles.controlsRow} pointerEvents="none">
            
            <Animated.View style={styles.controlContainer}> 
              <SteeringWheel 
                size={200} 
                onSteer={handleSteer} 
                rotation={rotation} 
              />
            </Animated.View>

            {/* SAĞ: GAZ */}
            <Animated.View style={styles.controlContainer}>
              <ThrottleController 
                height={220} 
                onThrottle={handleThrottle} 
                translateY={translateY} 
              />
            </Animated.View>

          </View>

          <View style={styles.headerOverlay} pointerEvents="none">
            <Text color="white" fontWeight="bold" style={{textShadowColor: 'black', textShadowRadius: 3}}>
                {duckiebot?.name || "Unknown"}
            </Text>
          </View>
          
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
    
  );
};

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

export default VideoStream;