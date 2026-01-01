import { DiscoveredRobotInfo } from '@/utils/mdns';
import React from 'react';
import { Text, View, XStack, YStack } from 'tamagui';

interface DuckiebotCardsProps {
  item: DiscoveredRobotInfo;
  onPress: () => void;
}

export const DuckiebotCards = ({ item, onPress }: DuckiebotCardsProps) => {
  return (
    <YStack
     
      backgroundColor="rgba(255, 255, 255, 0.85)"
      borderRadius="$4"
      padding="$4"
      marginBottom="$3"
      borderWidth={2}
      borderColor="$color"
      
      
      shadowColor="$color"
      shadowOffset={{ width: 0, height: 4 }}
      shadowOpacity={0.2}
      shadowRadius={0} 
      
      
      onPress={onPress}
      pressStyle={{
        scale: 0.97,
        opacity: 0.9,
        borderColor: '$background' 
      }}
      animation="bouncy" 
    >
      
      
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
        
        <Text 
          fontFamily="$heading" 
          fontSize="$4" 
          color="$color" 
        >
          {item.name}
        </Text>

        
        <View 
          backgroundColor="$color" 
          paddingHorizontal="$2" 
          paddingVertical="$1.5" 
          borderRadius="$2"
        >
          <Text 
            color="white" 
            fontSize="$1" 
            fontWeight="bold"
            fontFamily="$body"
          >
            {item.type}
          </Text>
        </View>
      </XStack>

      <InfoRow label="IP:" value={item.ip} />
      <InfoRow label="Config:" value={item.configuration} />

    </YStack>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <XStack marginTop="$2" space="$2">
    <Text 
      width={80} 
      color="$gray10" 
      fontSize="$3"
      fontFamily="$body"
    >
      {label}
    </Text>
    <Text 
      color="$color" 
      fontWeight="600" 
      fontSize="$3"
      fontFamily="$body"
      flex={1} 
    >
      {value}
    </Text>
  </XStack>
);