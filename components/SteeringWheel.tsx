import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Image, YStack } from 'tamagui';

interface Props {
  size?: number;
  onSteer?: (value: number) => void; // -1 (Sol) ile 1 (Sağ) arası değer döner
}

export const SteeringWheel = ({ size = 200, onSteer }: Props) => {
  const rotation = useSharedValue(0);
  const CENTER = size / 2;

  // Açıyı hesaplayan ve robota gönderen fonksiyon
  const handleUpdate = (x: number, y: number) => {
    // Merkeze göre koordinat farkları
    const deltaX = x - CENTER;
    const deltaY = y - CENTER;

    // Matematiksel açı hesabı (Radyan cinsinden)
    let angleRad = Math.atan2(deltaY, deltaX);
    
    // Radyanı dereceye çevir
    let angleDeg = angleRad * (180 / Math.PI);

    // Math.atan2 sonucu -180 ile 180 arasındadır. 
    // Ancak direksiyonun "üstü" 0 derece olsun isteriz, bu yüzden 90 derece kaydırıyoruz.
    angleDeg += 90;

    // Sınırlandırma (Opsiyonel): Direksiyon sonsuz dönmesin, max 90 derece sağ/sol olsun
    if (angleDeg > 180) angleDeg -= 360; // Açıyı normalize et
    
    // Açıyı -90 ile 90 arasına sıkıştır (Clamp)
    const clampedAngle = Math.max(-90, Math.min(90, angleDeg));

    rotation.value = clampedAngle;

    // Robota göndermek için normalize et (-1 sol, 0 orta, 1 sağ)
    const normalizedValue = clampedAngle / 90;
    
    if (onSteer) {
      runOnJS(onSteer)(normalizedValue);
    }
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      handleUpdate(e.x, e.y);
    })
    .onUpdate((e) => {
      handleUpdate(e.x, e.y);
    })
    .onEnd(() => {
      // Parmağını çekince direksiyon ortaya dönsün istersen:
      rotation.value = 0; 
      if (onSteer) runOnJS(onSteer)(0);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <YStack 
        width={size} 
        height={size} 
        justifyContent="center" 
        alignItems="center"
        backgroundColor="rgba(0,0,0,0.1)" // Test ederken alanı görmek için (sonra sil)
        borderRadius={size / 2}
      >
        <Animated.View style={[animatedStyle, { width: size, height: size }]}>
          {/* Direksiyon Resmin Buraya */}
          {/* Eğer elinde direksiyon resmi yoksa şimdilik tamagui Image kullanalım */}
          <Image
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/5400/5400936.png' }} 
            width={size} 
            height={size} 
            resizeMode="contain"
          />
        </Animated.View>
      </YStack>
    </GestureDetector>
  );
};