import { useActiveDuckiebot } from '@/context/ActiveDuckiebotContext';
import React from 'react';
import { Button, Image, Spinner, Text, XStack, YStack } from 'tamagui';

export default function HomeScreen() {
  const { duckiebot, connectionStatus, serviceCall, retryConnection } = useActiveDuckiebot();

   const renderStatus = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <YStack alignItems="center" space="$2">
            <Text 
              color="$green10" 
              fontFamily="$heading" 
              fontSize="$5" 
              textAlign="center"
            >
              ROS MASTER IS CONNECTED
            </Text>
            <Text fontSize="$2" opacity={0.6}>Ready to drive!</Text>
          </YStack>
        );

      case 'searching':
      case 'connecting':
        return (
          <XStack alignItems="center" space="$3">
            <Spinner size="large" color="$color" />
            <Text fontFamily="$body" fontSize="$4" color="$color">
              {connectionStatus === 'searching' ? 'Searching...' : 'Connecting...'}
            </Text>
          </XStack>
        );

      case 'failed':
        return (
          <YStack alignItems="center" space="$3">
            <Text color="$red10" fontFamily="$heading" fontSize="$4">
              CONNECTION FAILED
            </Text>
            <Button size="$3" onPress={retryConnection} theme="red">
              Retry
            </Button>
          </YStack>
        );

      case 'idle':
      default:
        return (
          <Text fontFamily="$body" color="$gray10">
            Waiting for status...
          </Text>
        );
    }
  };

  return (

    <YStack flex={1} backgroundColor="$background" padding="$4" justifyContent="center" alignItems="center">
      
    <YStack marginBottom="$8" alignItems="center">
      <Image
      source={require('../../../../assets/images/duckietownTown.png')} 
      width={150}
      height={150}
      marginBottom="$4" 
    />
    <Text 
      fontFamily="$heading" 
      fontSize="$8" 
      color="$color" 
      textAlign="center" 
      marginBottom="$2"
  
      textShadowColor="rgba(0,0,0,0.2)"
      textShadowOffset={{ width: 1, height: 1 }}
      textShadowRadius={1}
    >
      WELCOME TO
    </Text>

    <Text 
      fontFamily="$heading" 
      fontSize="$9" 
      color="white"
      textAlign="center"
       textShadowColor="rgba(0,0,0,0.2)"
      textShadowOffset={{ width: 3, height: 3 }}
      textShadowRadius={1}
    >
      DUCKIETOWN
    </Text>

  </YStack>

      
      <YStack 
        backgroundColor="rgba(255,255,255, 0.9)" 
        padding="$5" 
        borderRadius="$4" 
        width="100%" 
        maxWidth={400}
        borderWidth={2}
        borderColor="$color"
        elevation="$4"
        alignItems="center"
        space="$4"
      >
        <YStack alignItems="center">
          <Text fontFamily="$heading" fontSize="$5" color="$color">
            {duckiebot?.name || "Unknown Bot"}
          </Text>
          <Text fontFamily="$body" fontSize="$3" color="$gray10">
            IP: {duckiebot?.ip || "0.0.0.0"}
          </Text>
        </YStack>

      
        <YStack 
          padding="$4" 
          backgroundColor="$background" 
          borderRadius="$3"
          width="100%"
          alignItems="center"
          borderWidth={1}
          borderColor="rgba(0,0,0,0.1)"
        >
          {renderStatus()}
        </YStack>
      </YStack>

    </YStack>
  );
}