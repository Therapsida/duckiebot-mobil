import { config as configBase } from '@tamagui/config/v3'; // Veya kullandığın base config
import { createFont, createTamagui, createTokens } from 'tamagui';

// 1. Font Tanımı
const silkscreenFont = createFont({
  family: 'Silkscreen',
  size: {
    1: 12,
    1.5: 13,
    2: 14,
    3: 16,
    4: 20,
    4.5: 22,
    5: 24,
    6: 32,
    8: 40,
    9: 44,
    10: 48,
    true: 16,
  },
  lineHeight: {
    1: 17,
    2: 22,
    3: 25,
    true: 25,
  },
  weight: {
    400: '400',
    700: '700', 
  },
  
  letterSpacing: {
    400: 0,
    700: 0,
  },
  face: {
    400: { normal: 'Silkscreen_400Regular' },
    700: { normal: 'Silkscreen_700Bold' }, 
  },
});


const customTokens = createTokens({
  ...configBase.tokens, 
  color: {
    ...configBase.tokens.color,
    duckYellow: '#F2A900', 
    duckBlue: '#2FA4E7',  
  },
});

const config = createTamagui({
  ...configBase,
  fonts: {
    ...configBase.fonts,
    body: silkscreenFont,    
    heading: silkscreenFont, 
  },
  tokens: customTokens,
  themes: {
    ...configBase.themes,
    'pixel-duck': {
      background: customTokens.color.duckYellow, 
      color: customTokens.color.duckBlue,        
      borderColor: customTokens.color.duckBlue, 
      primary: customTokens.color.duckBlue, 
    },
  },
});

export default config;
export type Conf = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}