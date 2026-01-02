import React from 'react';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Image, View, YStack } from 'tamagui';

interface Props {
  height?: number;
  onThrottle?: (value: number) => void; // 1 (İleri) ... 0 (Dur) ... -1 (Geri)
    translateY: SharedValue<number>;
}



const ThrottleComponent = ({ height = 200, onThrottle, translateY}: Props) => {
 
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
      <YStack
        // --- KONUMLANDIRMA (Sağ Alt & En Üst) ---
        position="absolute"
        bottom={40}
        right={40} // Sağ tarafta dursun
        zIndex={100}
        // ----------------------------------------
        
        height={height}
        width={80}
        justifyContent="center"
        alignItems="center"
      >
        {/* Arka Plandaki Kanal (Track) */}
        <View 
          width={10} 
          height="100%" 
          backgroundColor="rgba(255, 255, 255, 0.3)" 
          borderRadius={5} 
          position="absolute"
        />

        {/* Hareket Eden Pedal (Knob) */}
        <Animated.View style={[animatedStyle, { width: 80, height: 100, justifyContent: 'center', alignItems: 'center' }]}>
          <Image
            // Gaz Pedalı Görseli
            source={require('../assets/images/pedal.png')}
            width={70} 
            height={70} 
          />
        </Animated.View>
      </YStack>
  );
};

export const ThrottleController = React.memo(ThrottleComponent);