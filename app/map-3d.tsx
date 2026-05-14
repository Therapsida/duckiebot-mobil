import { MapCanvas } from '@/components/Map3D/MapCanvas';
import { useDiscoveredDuckiebotInfo } from '@/context/DuckiebotContext';
import { useMultiRos } from '@/context/RosContext';
import { useRobotPaths } from '@/hooks/useRobotPaths';
import { useRobotPoses } from '@/hooks/useRobotPoses';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Platform, View, Alert } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Button, Text, YStack } from 'tamagui';

// ── Coordinate system & Tile Size ───────────────────────────────────────
// Each tile is 0.6m × 0.6m in the real world
// TILE_SIZE = 1 unit = 0.6m
// Origin (0,0) is at tile[2][4] (bottom-right area):
//   Old centered system: tile[2][4] was at (1.5, 0.5)
//   New system: tile[2][4] is at (0, 0)
//   Offset: subtract (1.5, 0.5) from all coordinates
const TILE_SIZE_METERS = 0.6;
const ORIGIN_OFFSET = { x: 1.5, z: 0.5 };

// ── Fallback robots shown when no real bots are discovered ─────────────────
// Positions in the new coordinate system (0,0 at tile[2][4])
const FALLBACK_ROBOTS = [
  { name: 'Duckiebot-1', x: 4.2, z: 1.5, color: '#FFD700' },
  { name: 'Duckiebot-2', x: 0.8, z: 1.5, color: '#FF6B6B' },
];

export default function Map3DScreen() {
  const { data: duckiebots } = useDiscoveredDuckiebotInfo();
  const { callServiceOnBot } = useMultiRos();
  const router = useRouter();

  // If real bots are discovered use them; otherwise fall back to the demo set
  const mappedRobots = useMemo(() => {
    if (duckiebots.length > 0) {
      const COLS = 5;
      const ROWS = 3;
      const TILE_SIZE = 1;
      return duckiebots.map((bot, idx) => {
        // Old centered system position
        const centeredX = ((idx % COLS) - COLS / 2) * TILE_SIZE;
        const centeredZ = (Math.floor(idx / COLS) - ROWS / 2) * TILE_SIZE;
        // Apply origin offset (0,0 at tile[2][4])
        return {
          name: bot.name,
          x: centeredX - ORIGIN_OFFSET.x,
          z: centeredZ - ORIGIN_OFFSET.z,
          color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#FFA07A'][idx % 5],
        };
      });
    }
    return FALLBACK_ROBOTS;
  }, [duckiebots]);

  // The pose hook receives the names of whichever robots are actually on the map
  const botNames = useMemo(() => mappedRobots.map((r) => r.name), [mappedRobots]);
  const livePoses = useRobotPoses(botNames);
  const livePaths = useRobotPaths(botNames);

  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});

      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, [])
  );

  /**
   * Called by MapCanvas when the user picks a target point in Global Path mode.
   * Invokes `/<botName>/graph_search` with the ROS-frame (x, y) coordinates.
   */
  const handleGlobalPathTarget = useCallback(
    (botName: string, targetX: number, targetY: number) => {
      console.log(`[GlobalPath] ${botName} → target_x=${targetX.toFixed(3)}, target_y=${targetY.toFixed(3)}`);
      callServiceOnBot(
        botName,
        `/${botName}/graph_search`,
        'duckietown_msgs/GraphSearchSrv',
        { target_x: targetX, target_y: targetY },
      ).then((result) => {
        console.log(`[GlobalPath] ${botName} graph_search result:`, result);
        Alert.alert("Success", "Global plan is sent.");
      }).catch((err) => {
        console.warn(`[GlobalPath] ${botName} graph_search failed:`, err);
        Alert.alert("Error", "Clicked to wrong location.");
      });
    },
    [callServiceOnBot],
  );

  const livePoseCount = Object.keys(livePoses).length;
  const usingFallback = duckiebots.length === 0;

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <MapCanvas robots={mappedRobots} livePoses={livePoses} livePaths={livePaths} onCallService={handleGlobalPathTarget} />
        </div>

        {/* Back button */}
        <Button
          position="absolute"
          top={20}
          left={20}
          zIndex={100}
          size="$3"
          circular
          backgroundColor="rgba(0,0,0,0.7)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.3)"
          onPress={() => router.replace('/')}
        >
          <Text color="white">←</Text>
        </Button>

        {/* Status overlay */}
        <YStack
          position="absolute"
          bottom={20}
          left={20}
          backgroundColor="rgba(0,0,0,0.8)"
          padding="$3"
          borderRadius="$2"
          zIndex={100}
          gap="$1"
        >
          <Text color="white" fontSize="$2" fontWeight="bold">
            Bots: {mappedRobots.length}
            {usingFallback ? ' (demo)' : ''}
          </Text>
          <Text color={livePoseCount > 0 ? '#4ECDC4' : '#888'} fontSize="$1">
            {livePoseCount > 0
              ? `📡 ${livePoseCount} live pose${livePoseCount > 1 ? 's' : ''}`
              : '📭 No live poses yet'}
          </Text>
        </YStack>
      </View>
    );
  }

  // Mobile — Metro automatically picks MapCanvas.native.tsx on iOS/Android
  return (
    <View style={{ flex: 1 }}>
      <MapCanvas robots={mappedRobots} livePoses={livePoses} livePaths={livePaths} onCallService={handleGlobalPathTarget} />

      {/* Back button */}
      <Button
        position="absolute"
        top={50}
        right={16}
        zIndex={100}
        size="$3"
        circular
        backgroundColor="rgba(0,0,0,0.7)"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.3)"
        onPress={() => router.replace('/')}
      >
        <Text color="white">←</Text>
      </Button>

      {/* Status badge */}
      <YStack
        position="absolute"
        bottom={32}
        right={16}
        backgroundColor="rgba(0,0,0,0.8)"
        padding="$2"
        borderRadius="$2"
        zIndex={100}
        alignItems="flex-end"
        gap="$1"
      >
        <Text color="white" fontSize="$1" fontWeight="bold">
          {mappedRobots.length} bot{mappedRobots.length !== 1 ? 's' : ''}
          {usingFallback ? ' (demo)' : ''}
        </Text>
        <Text color={livePoseCount > 0 ? '#4ECDC4' : '#888'} fontSize="$1">
          {livePoseCount > 0 ? `📡 ${livePoseCount} live` : '📭 no poses'}
        </Text>
      </YStack>
    </View>
  );
}
