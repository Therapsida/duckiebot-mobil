import { SteeringWheel } from "@/components/SteeringWheel";
import { ThrottleController } from "@/components/ThrottleController";
import { useActiveDuckiebot } from "@/context/ActiveDuckiebotContext";
import { ChevronLeft, Maximize2, Minimize2 } from "@tamagui/lucide-icons";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { runOnJS, useSharedValue, withSpring } from "react-native-reanimated";
import { WebView } from "react-native-webview";
import { Button, Text, YStack, useWindowDimensions } from "tamagui";

interface VideoStreamProps {
  duckiebotName?: string;
}

const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            background-color: #000; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            width: 100vw;
            overflow: hidden; 
        }
        #streamImage { 
            width: 100vw; 
            height: 100vh; 
            object-fit: cover;
        }
    </style>
</head>
<body>
    <img id="streamImage" src="" />
</body>
</html>
`;

const VideoStream: React.FC<VideoStreamProps> = () => {
  const { duckiebot, connectionStatus, subscribe, publish } =
    useActiveDuckiebot();
  const webViewRef = useRef<WebView>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastUpdate = useRef<number>(0);
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const navigation = useNavigation();
  const router = useRouter();

  const TARGET_FPS = 20;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const [hasData, setHasData] = useState(false);
  const isConnected = connectionStatus === "connected";
  const [isFullscreen, setIsFullscreen] = useState(false);

  const steerValue = useSharedValue<number>(0);
  const throttleValue = useSharedValue<number>(0);

  const rotation = useSharedValue(0);
  const translateY = useSharedValue(0);
  const MAX_THROTTLE_MOVE = 220 / 2 - 40;
  const COMPONENT_SIZE = 220;
  const MARGIN = 20;

  const handleSteer = useCallback((value: number) => {
    steerValue.value = value;
  }, []);

  const handleThrottle = useCallback((value: number) => {
    throttleValue.value = value;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const speed = throttleValue.value;
      const steer = steerValue.value;

      publish(`/joy_mapper_node/car_cmd`, "duckietown_msgs/Twist2DStamped", {
        header: { seq: 0, stamp: { secs: 0, nsecs: 0 }, frame_id: "" },
        v: speed,
        omega: steer * speed,
      });
    }, 100);

    return () => clearInterval(timer);
  }, [publish]);

  useFocusEffect(
    useCallback(() => {
      const lockLandscape = async () => {
        if (!isWeb) {
          try {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.LANDSCAPE,
            );
          } catch (e) {}
        }
        navigation.setOptions({ tabBarStyle: { display: "none" } });
      };
      lockLandscape();

      const onBackPress = () => {
        handleBack();
        return true;
      };

      const subscription = !isWeb
        ? BackHandler.addEventListener("hardwareBackPress", onBackPress)
        : null;

      return () => {
        subscription?.remove();
        navigation.setOptions({ tabBarStyle: undefined });
        if (!isWeb) {
          ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP,
          ).catch(() => {});
        }
      };
    }, [isWeb, navigation]),
  );

  const handleBack = async () => {
    if (!isWeb) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => {});
    }
    router.back();
  };

  const toggleFullscreen = useCallback(async () => {
    if (!isWeb || typeof window === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen error:", e);
    }
  }, [isWeb]);

  useEffect(() => {
    if (!isWeb) return;
    const updateFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", updateFs);
    return () => document.removeEventListener("fullscreenchange", updateFs);
  }, [isWeb]);

  const updateSteerFromPoint = (x: number, y: number) => {
    const centerX = COMPONENT_SIZE / 2;
    const centerY = COMPONENT_SIZE / 2;
    const deltaX = x - centerX;
    const deltaY = y - centerY;
    let angleDeg = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    if (angleDeg > 180) angleDeg -= 360;
    const clampedAngle = Math.max(-100, Math.min(100, angleDeg));
    rotation.value = clampedAngle;
    handleSteer(clampedAngle / 100);
  };

  const updateThrottleFromPoint = (
    startY: number,
    startVal: number,
    currentY: number,
  ) => {
    const deltaY = currentY - startY;
    const newY = Math.max(
      -MAX_THROTTLE_MOVE,
      Math.min(MAX_THROTTLE_MOVE, startVal + deltaY),
    );
    translateY.value = newY;
    handleThrottle(-newY / MAX_THROTTLE_MOVE);
  };

  const steerActiveRef = useRef(false);
  const throttleActiveRef = useRef<{ startY: number; startVal: number } | null>(
    null,
  );

  useEffect(() => {
    if (!isConnected || !duckiebot?.name) return;
    const topicName = `/camera_node/image/compressed`;
    const messageType = "sensor_msgs/CompressedImage";

    const unsubscribe = subscribe(topicName, messageType, (message: any) => {
      const now = Date.now();
      if (now - lastUpdate.current > FRAME_INTERVAL) {
        if (!hasData) setHasData(true);
        const base64Str = `data:image/jpeg;base64,${message.data}`;

        if (isWeb) {
          if (imgRef.current) {
            imgRef.current.src = base64Str;
          }
        } else {
          const script = `
            var img = document.getElementById('streamImage');
            if (img) img.src = "${base64Str}";
            true; 
          `;
          webViewRef.current?.injectJavaScript(script);
        }
        lastUpdate.current = now;
      }
    });
    return unsubscribe;
  }, [connectionStatus, duckiebot?.name, hasData, isWeb, subscribe]);

  const activeTrackers = useSharedValue<Record<number, any>>({});
  const masterGesture = Gesture.Native()
    .onTouchesDown((e, manager) => {
      manager.activate();
      for (const touch of e.changedTouches) {
        const isInsideSteering =
          touch.x >= MARGIN &&
          touch.x <= MARGIN + COMPONENT_SIZE &&
          touch.y >= height - MARGIN - COMPONENT_SIZE;
        const isInsideThrottle =
          touch.x >= width - MARGIN - COMPONENT_SIZE &&
          touch.x <= width - MARGIN &&
          touch.y >= height - MARGIN - COMPONENT_SIZE;
        if (!isInsideSteering && !isInsideThrottle) continue;
        const target = isInsideSteering ? "steer" : "throttle";
        activeTrackers.value = {
          ...activeTrackers.value,
          [touch.id]: {
            target,
            startY: touch.y,
            startVal: target === "steer" ? rotation.value : translateY.value,
          },
        };
      }
    })
    .onTouchesMove((e) => {
      for (const touch of e.changedTouches) {
        const tracker = activeTrackers.value[touch.id];
        if (!tracker) continue;
        if (tracker.target === "throttle") {
          const newY = Math.max(
            -MAX_THROTTLE_MOVE,
            Math.min(
              MAX_THROTTLE_MOVE,
              tracker.startVal + (touch.y - tracker.startY),
            ),
          );
          translateY.value = newY;
          runOnJS(handleThrottle)(-newY / MAX_THROTTLE_MOVE);
        } else {
          const dx = touch.x - (MARGIN + COMPONENT_SIZE / 2);
          const dy = touch.y - (height - MARGIN - COMPONENT_SIZE / 2);
          let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          if (angle > 180) angle -= 360;
          const clamped = Math.max(-100, Math.min(100, angle));
          rotation.value = clamped;
          runOnJS(handleSteer)(clamped / 100);
        }
      }
    })
    .onTouchesUp((e) => {
      for (const touch of e.changedTouches) {
        const tracker = activeTrackers.value[touch.id];
        if (tracker) {
          if (tracker.target === "throttle") {
            translateY.value = withSpring(0);
            runOnJS(handleThrottle)(0);
          } else {
            rotation.value = withSpring(0);
            runOnJS(handleSteer)(0);
          }
          const updated = { ...activeTrackers.value };
          delete updated[touch.id];
          activeTrackers.value = updated;
        }
      }
    });

  const content = (
    <View style={styles.container}>
      <StatusBar hidden />

      <View style={styles.fullScreenVideo} pointerEvents="none">
        {isWeb ? (
          <img
            ref={imgRef as any}
            style={{ width: "100%", height: "100%", objectFit: "cover" } as any}
          />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: HTML_CONTENT }}
            style={{ flex: 1, backgroundColor: "black" }}
            scrollEnabled={false}
            javaScriptEnabled={true}
          />
        )}

        {(!isConnected || !hasData) && (
          <View style={styles.overlayPlaceholder}>
            <YStack alignItems="center" space="$2">
              <ActivityIndicator size="large" color="#FFD700" />
              <Text color="white">
                {isConnected
                  ? "Waiting for stream..."
                  : "Duckiebot Not Connected"}
              </Text>
            </YStack>
          </View>
        )}
      </View>

      <Button
        position="absolute"
        top={20}
        left={20}
        zIndex={100}
        circular
        backgroundColor="rgba(0,0,0,0.5)"
        onPress={handleBack}
        icon={ChevronLeft}
      />

      {isWeb && (
        <Button
          position="absolute"
          top={20}
          right={20}
          zIndex={100}
          circular
          backgroundColor="rgba(0,0,0,0.5)"
          onPress={toggleFullscreen}
          icon={isFullscreen ? Minimize2 : Maximize2}
        />
      )}

      <View style={styles.controlsRow} pointerEvents="box-none">
        <View
          style={[styles.controlContainer, isWeb && styles.controlContainerWeb]}
          onPointerDown={(e: any) => {
            if (isWeb) e.target.setPointerCapture(e.pointerId);
            steerActiveRef.current = true;
            updateSteerFromPoint(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          }}
          onPointerMove={(e: any) => {
            if (steerActiveRef.current)
              updateSteerFromPoint(
                e.nativeEvent.offsetX,
                e.nativeEvent.offsetY,
              );
          }}
          onPointerUp={(e: any) => {
            steerActiveRef.current = false;
            rotation.value = withSpring(0);
            handleSteer(0);
          }}
        >
          <SteeringWheel size={200} onSteer={handleSteer} rotation={rotation} />
        </View>

        <View
          style={[styles.controlContainer, isWeb && styles.controlContainerWeb]}
          onPointerDown={(e: any) => {
            if (isWeb) e.target.setPointerCapture(e.pointerId);
            throttleActiveRef.current = {
              startY: e.nativeEvent.offsetY,
              startVal: translateY.value,
            };
          }}
          onPointerMove={(e: any) => {
            if (throttleActiveRef.current) {
              updateThrottleFromPoint(
                throttleActiveRef.current.startY,
                throttleActiveRef.current.startVal,
                e.nativeEvent.offsetY,
              );
            }
          }}
          onPointerUp={() => {
            throttleActiveRef.current = null;
            translateY.value = withSpring(0);
            handleThrottle(0);
          }}
        >
          <ThrottleController
            height={220}
            onThrottle={handleThrottle}
            translateY={translateY}
          />
        </View>
      </View>

      <View style={styles.headerOverlay} pointerEvents="none">
        <Text color="white" fontWeight="bold">
          {duckiebot?.name || "Unknown"}
        </Text>
      </View>
    </View>
  );

  return isWeb ? (
    content
  ) : (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={masterGesture}>{content}</GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  fullScreenVideo: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  overlayPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerOverlay: { position: "absolute", top: 20, right: 80, zIndex: 10 },
  controlsRow: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    zIndex: 10,
  },
  controlContainer: {
    width: 220,
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  controlContainerWeb: {
    touchAction: "none",
    userSelect: "none",
  } as any,
});

export default VideoStream;
