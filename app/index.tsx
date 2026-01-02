import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList } from 'react-native';
import { Button, Spinner, Text, View, YStack } from 'tamagui';
import { DuckiebotCards } from '../components/DuckiebotCards';
import { useDiscoveredDuckiebotInfo } from '../context/DuckiebotContext';

export default function HomeScreen() {
  const { data, refreshData, isLoading } = useDiscoveredDuckiebotInfo();
  const router = useRouter();
  return (
    <YStack flex={1} backgroundColor="$background" padding="$4">
      
      {/* Başlık */}
      {data?.length > 0 && (
        <Text 
          fontFamily="$heading" 
          fontSize="$6"        
          color="$color"        
          textAlign="center"
          marginBottom="$10"
          marginTop="$5"

        >
          Found Duckiebots
        </Text>
      )}

      <FlatList
        data={data}
        keyExtractor={(item) => item.ip}
        
        contentContainerStyle={{ flexGrow: 1, justifyContent: data?.length ? 'flex-start' : 'center' }}
        
        ListEmptyComponent={
          <YStack flex={1} justifyContent="center" alignItems="center" space="$4">
            
            <Text fontFamily="$body" fontSize="$5" color="$color">
              {isLoading ? 'Searching...' : 'No duckiebots found.'}
            </Text>

            <Button
              size="$4"
              backgroundColor="$color"
              disabled={isLoading}
              onPress={refreshData}
              opacity={isLoading ? 0.7 : 1}
              icon={isLoading ? <Spinner color="$background" /> : undefined}
            >
              <Text color="$background" fontFamily="$body">
                Search Duckiebots
              </Text>
            </Button>
          </YStack>
        }

        renderItem={({ item }) => (
          <View marginBottom="$3">
            <DuckiebotCards
              item={item}
              onPress={() => {
                router.push({ pathname: '/details/[id]', params: { id: item.name } });
              }}
            />
          </View>
        )}
      />
    </YStack>
  );
}