import React from 'react';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Image, YStack } from 'tamagui';

interface Props {
  size?: number;
  onSteer?: (value: number) => void;
    rotation: SharedValue<number>;
}

const SteeringWheelComponent = ({ size = 180, onSteer, rotation }: Props) => {
    
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
      <YStack
        position="absolute"
        bottom={0}
        left={0}
        zIndex={100}
        width={size}
        height={size}
        justifyContent="center"
        alignItems="center"
        borderRadius={size / 2}
      >
        <Animated.View style={[animatedStyle, { width: size, height: size }]}>
          <Image
            source={require('../assets/images/steering_wheel.png')}
            width="100%"
            height="100%"
            resizeMode="contain"
          />
        </Animated.View>
      </YStack>
  );
};

export const SteeringWheel = React.memo(SteeringWheelComponent);