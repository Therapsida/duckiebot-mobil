import { useActiveDuckiebot } from "@/context/ActiveDuckiebotContext";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import WebView from "react-native-webview";
import { Button, Stack, Text, XStack, YStack } from "tamagui";

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();

  const { duckiebot, connectionStatus, serviceCall, publish, subscribe } =
    useActiveDuckiebot();
  const webViewRef = useRef<WebView>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const TARGET_FPS = 20;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const lastUpdate = useRef<number>(0);
  const isConnected = connectionStatus === "connected";
  const isWeb = Platform.OS === "web";
  const [hasData, setHasData] = useState(false);

  const dynamicVideoSize = Math.min(width * 0.8, height * 0.45);

  const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
        body { margin: 0; padding: 0; background-color: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
        #streamImage { width: 100vw; height: 100vh; object-fit: cover; }
    </style>
</head>
<body>
    <img id="streamImage" src="" />
</body>
</html>
`;

  useEffect(() => {
    if (!isConnected || !duckiebot?.name) return;
    const topicName = `/line_detector_node/debug/maps/compressed`;
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
    return () => unsubscribe;
  }, [connectionStatus, duckiebot?.name, hasData, isWeb]);

  return (
    <View style={styles.container}>
      <YStack
        fullscreen
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
        space="$5"
        padding="$4"
      >
        <Stack
          width={dynamicVideoSize}
          height={dynamicVideoSize}
          backgroundColor="black"
          borderWidth={4}
          borderColor="$duckBlue"
          alignItems="center"
          justifyContent="center"
          borderRadius={20}
          overflow="hidden"
          position="relative"
        >
          <View style={styles.fullScreenVideo} pointerEvents="none">
            {isWeb ? (
              <img
                ref={imgRef as any}
                style={
                  { width: "100%", height: "100%", objectFit: "cover" } as any
                }
              />
            ) : (
              <WebView
                ref={webViewRef}
                originWhitelist={["*"]}
                source={{ html: HTML_CONTENT }}
                style={{ flex: 1, backgroundColor: "transparent" }}
                scrollEnabled={false}
                javaScriptEnabled={true}
                containerStyle={{ backgroundColor: "black" }}
              />
            )}

            {(!isConnected || !hasData) && (
              <View style={styles.overlayPlaceholder}>
                <YStack alignItems="center" space="$2">
                  {isConnected ? (
                    <>
                      <ActivityIndicator size="large" color="#FFD700" />
                      <Text color="white">Waiting for stream...</Text>
                    </>
                  ) : (
                    <Text style={styles.infoText}>Duckiebot Not Connected</Text>
                  )}
                </YStack>
              </View>
            )}
          </View>
        </Stack>

        <XStack space="$4" flexWrap="wrap" justifyContent="center">
          <Button
            borderColor="black"
            borderWidth={2}
            backgroundColor={!isConnected ? "#cccccc" : "$duckBlue"}
            size="$5"
            disabled={!isConnected}
            onPress={() => {
              publish(
                `/joy_mapper_node/joystick_override`,
                "duckietown_msgs/BoolStamped",
                { data: false },
              );
            }}
          >
            <Text color="white" fontWeight="bold">
              START LANE FOLLOWING
            </Text>
          </Button>

          <Button
            theme="red"
            disabled={!isConnected}
            backgroundColor={!isConnected ? "#cccccc" : "red"}
            borderColor="black"
            borderWidth={2}
            size="$5"
            onPress={() => {
              publish(
                `/joy_mapper_node/joystick_override`,
                "duckietown_msgs/BoolStamped",
                { data: true },
              );

              publish(
                `/joy_mapper_node/car_cmd`,
                "duckietown_msgs/Twist2DStamped",
                {
                  v: 0.0,
                  omega: 0.0,
                },
              );
            }}
          >
            <Text color="white" fontWeight="bold">
              STOP!
            </Text>
          </Button>
        </XStack>
      </YStack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullScreenVideo: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  overlayPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  infoText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});
