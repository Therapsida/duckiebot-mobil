import { useDiscoveredDuckiebotInfo } from '../context/DuckiebotContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, View, Platform } from 'react-native';
import { Button, Spinner, Switch, Text, XStack, YStack } from 'tamagui';
import { DuckiebotCards } from '../components/DuckiebotCards';

export default function HomeScreen() {
  const { data, refreshData, isLoading, showMocks, setShowMocks } = useDiscoveredDuckiebotInfo();
  const router = useRouter();
  const [showDriveList, setShowDriveList] = useState(false);

  const hasBots = data && data.length > 0;

  return (
    <YStack flex={1} backgroundColor="$background" padding="$4" justifyContent="center">
      {hasBots ? (
        <YStack flex={showDriveList ? 1 : 0} space="$6" alignItems="center" paddingHorizontal="$2" marginTop={showDriveList ? '$6' : 0}>
          <Text
            fontFamily="$heading"
            fontSize="$7"
            color="$color"
            textAlign="center"
            marginBottom="$2"
            lineHeight={40}
          >
            {showDriveList ? 'Select a Duckiebot' : `Duckiebots are found!\nWhere do you want to go?`}
          </Text>

          {!showDriveList ? (
            <XStack space="$4" width="100%">
              <Button
                size="$5"
                flex={1}
                backgroundColor="$color"
                pressStyle={{ scale: 0.97 }}
                onPress={() => setShowDriveList(true)}
              >
                <Text color="$background" fontFamily="$body" fontSize="$4" fontWeight="bold">
                  Manual drive
                </Text>
              </Button>

              <Button
                size="$5"
                flex={1}
                backgroundColor="$color"
                pressStyle={{ scale: 0.97 }}
                onPress={() => router.push('/map-3d')}
              >
                <Text color="$background" fontFamily="$body" fontSize="$4" fontWeight="bold">
                  Open map
                </Text>
              </Button>
            </XStack>
          ) : (
            <YStack width="100%" flex={1}>
              <FlatList
                data={data}
                keyExtractor={(item) => item.ip}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={{ marginBottom: 12 }}>
                    <DuckiebotCards
                      item={item}
                      onPress={() => {
                        router.push({ pathname: '/details/[id]', params: { id: item.name } });
                      }}
                    />
                  </View>
                )}
              />
              <Button
                size="$4"
                backgroundColor="transparent"
                borderWidth={1}
                borderColor="$color"
                marginTop="$4"
                marginBottom="$4"
                onPress={() => setShowDriveList(false)}
              >
                <Text color="$color" fontFamily="$body" fontSize="$3" fontWeight="bold">
                  Back
                </Text>
              </Button>
            </YStack>
          )}
        </YStack>
      ) : (
        <YStack flex={1} justifyContent="center" alignItems="center" space="$5">
          <Text fontFamily="$body" fontSize="$5" color="$color">
            {isLoading ? 'Searching...' : 'No duckiebots found.'}
          </Text>

          <Button
            size="$5"
            backgroundColor="$color"
            disabled={isLoading}
            onPress={refreshData}
            opacity={isLoading ? 0.7 : 1}
            icon={isLoading ? <Spinner color="$background" /> : undefined}
          >
            <Text color="$background" fontFamily="$body" fontSize="$4" fontWeight="bold">
              Search Duckiebots
            </Text>
          </Button>

        </YStack>
      )}

      {/* Mock robots toggle — one switch controls ALL mock robots together */}
      <XStack
        alignSelf="center"
        alignItems="center"
        space="$3"
        marginTop="$4"
        opacity={0.75}
      >
        <Text fontFamily="$body" fontSize="$3" color="$color">
          Mock robots
        </Text>
        <Switch
          id="mock-robots-toggle"
          size="$3"
          checked={showMocks}
          onCheckedChange={setShowMocks}
        >
          <Switch.Thumb animation="quick" />
        </Switch>
      </XStack>

      {Platform.OS === 'web' && (
        <Button
          size="$4"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$color"
          marginTop="$4"
          alignSelf="center"
          onPress={() => router.push('/qr')}
        >
          <Text color="$color" fontFamily="$body" fontSize="$3" fontWeight="bold">
            Scan QR to open on Phone
          </Text>
        </Button>
      )}
    </YStack>
  );
}