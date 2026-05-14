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

      var speedValue;
      if (speed > 0) {
        speedValue = 1;
      } else if (speed < 0) {
        speedValue = -1;
      } else {
        speedValue = 0;
      }

      publish(`/joy_mapper_node/car_cmd`, "duckietown_msgs/Twist2DStamped", {
        header: { seq: 0, stamp: { secs: 0, nsecs: 0 }, frame_id: "" },
        v: speed * 0.41 * 0.6,
        omega: -steer * speedValue * 3.2 * 1.6,
      });
    }, 100);

    return () => clearInterval(timer);
  }, [publish]);

  useFocusEffect(
    useCallback(() => {
      const lockLandscape = async () => {
        try {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.LANDSCAPE,
          );
        } catch (e) {}
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
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {});
      };
    }, [isWeb, navigation]),
  );

  const handleBack = async () => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {});
    router.back();
  };

  const toggleFullscreen = useCallback(async () => {
    if (!isWeb || typeof window === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE,
        ).catch(() => {});
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {});
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

  const steerTranslateX = useSharedValue(0);
  const MAX_STEER_MOVE = 100;

  const updateSteerFromPoint = (
    startX: number,
    startVal: number,
    currentX: number,
  ) => {
    const deltaX = currentX - startX;
    const newX = Math.max(
      -MAX_STEER_MOVE,
      Math.min(MAX_STEER_MOVE, startVal + deltaX),
    );
    steerTranslateX.value = newX;

    // Map the horizontal translation to rotation (-100 to 100 degrees)
    const mappedRotation = (newX / MAX_STEER_MOVE) * 100;
    rotation.value = mappedRotation;
    handleSteer(mappedRotation / 100);
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

  const steerActiveRef = useRef<{ startX: number; startVal: number } | null>(
    null,
  );
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
            startX: touch.x,
            startY: touch.y,
            startVal:
              target === "steer" ? steerTranslateX.value : translateY.value,
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
          const deltaX = touch.x - tracker.startX;
          const newX = Math.max(
            -MAX_STEER_MOVE,
            Math.min(MAX_STEER_MOVE, tracker.startVal + deltaX),
          );
          steerTranslateX.value = newX;
          const mappedRotation = (newX / MAX_STEER_MOVE) * 100;
          rotation.value = mappedRotation;
          runOnJS(handleSteer)(mappedRotation / 100);
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
            steerTranslateX.value = withSpring(0);
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
            steerActiveRef.current = {
              startX: e.nativeEvent.pageX,
              startVal: steerTranslateX.value,
            };
          }}
          onPointerMove={(e: any) => {
            if (steerActiveRef.current) {
              updateSteerFromPoint(
                steerActiveRef.current.startX,
                steerActiveRef.current.startVal,
                e.nativeEvent.pageX,
              );
            }
          }}
          onPointerUp={(e: any) => {
            steerActiveRef.current = null;
            steerTranslateX.value = withSpring(0);
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
              startY: e.nativeEvent.pageY,
              startVal: translateY.value,
            };
          }}
          onPointerMove={(e: any) => {
            if (throttleActiveRef.current) {
              updateThrottleFromPoint(
                throttleActiveRef.current.startY,
                throttleActiveRef.current.startVal,
                e.nativeEvent.pageY,
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
