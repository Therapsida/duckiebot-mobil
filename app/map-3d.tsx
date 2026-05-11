import { MapCanvas } from '@/components/Map3D/MapCanvas';
import { useDiscoveredDuckiebotInfo } from '@/context/DuckiebotContext';
import { useRobotPaths } from '@/hooks/useRobotPaths';
import { useRobotPoses } from '@/hooks/useRobotPoses';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, View } from 'react-native';
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

  const livePoseCount = Object.keys(livePoses).length;
  const usingFallback = duckiebots.length === 0;

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <MapCanvas robots={mappedRobots} livePoses={livePoses} livePaths={livePaths} />
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
      <MapCanvas robots={mappedRobots} livePoses={livePoses} livePaths={livePaths} />

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
