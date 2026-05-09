import * as Linking from 'expo-linking';
import QRCode from 'qrcode';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Platform } from 'react-native';
import { Button, Text, YStack } from 'tamagui';

export default function QrScreen() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState('');
  const isWeb = Platform.OS === 'web';

  const generateQr = useCallback((url: string) => {
    if (!isWeb || !url) return;
    QRCode.toDataURL(url, { margin: 1, width: 280 })
      .then(setQrDataUrl)
      .catch((err) => console.error('QR generation failed', err));
  }, [isWeb]);

  useEffect(() => {
    let url = '';
    if (isWeb) {
      // Use the IP from our script, or fallback to whatever the browser sees
      const ip = process.env.EXPO_PUBLIC_LOCAL_IP || window.location.hostname;
      const port = window.location.port || '8081'; 
      url = `http://${ip}:${port}/`;
    } else {
      url = Linking.createURL('/');
    }
    setTargetUrl(url);
  }, [isWeb]);

  useEffect(() => {
    if (targetUrl) generateQr(targetUrl);
  }, [generateQr, targetUrl]);

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$4" space="$4">
      <Text fontSize="$6" fontWeight="bold">Scan to open Ducktor</Text>

      {isWeb ? (
        qrDataUrl ? (
          <YStack space="$4" alignItems="center">
            <Image source={{ uri: qrDataUrl }} style={{ width: 280, height: 280 }} />
            <Text textAlign="center" color="$gray10">{targetUrl}</Text>
          </YStack>
        ) : (
          <Text>Generating QR...</Text>
        )
      ) : (
        <Text>Switch to Web view to generate QR</Text>
      )}

      <Button themeInverse size="$4" onPress={() => generateQr(targetUrl)}>
        Refresh QR
      </Button>
    </YStack>
  );
}