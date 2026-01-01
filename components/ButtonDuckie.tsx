import React from 'react'
import { GetProps, styled, Text, View } from 'tamagui'


const ButtonFrame = styled(View, {
  name: 'MyButton',
  backgroundColor: '$blue10',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '$4',
  flexDirection: 'row',
  

  pressStyle: {
    opacity: 0.8,
    scale: 0.97,
  },

  variants: {
    size: {
      small: { padding: '$2', height: 30 },
      medium: { padding: '$3', height: 44 },
      large: { padding: '$4', height: 54 },
    },
    variant: {
      primary: { backgroundColor: '$blue10' },
      secondary: { 
        backgroundColor: 'transparent', 
        borderWidth: 1, 
        borderColor: '$blue10' 
      },
      danger: { backgroundColor: '$red10' }
    }
  } as const,

  defaultVariants: {
    size: 'medium',
    variant: 'primary',
  },
})


const ButtonText = styled(Text, {
  color: 'white',
  fontWeight: '600',
  fontSize: '$4',

  variants: {
    variant: {
      primary: { color: 'white' },
      secondary: { color: '$blue10' },
      danger: { color: 'white' }
    }
  } as const,
  
  defaultVariants: {
    variant: 'primary',
  }
})

type ButtonProps = GetProps<typeof ButtonFrame> & {
  text: string
}

export const ButtonDuckie = ({ text, variant, ...props }: ButtonProps) => {
  return (
    <ButtonFrame variant={variant} {...props}>
      <ButtonText variant={variant}>{text}</ButtonText>
    </ButtonFrame>
  )
}