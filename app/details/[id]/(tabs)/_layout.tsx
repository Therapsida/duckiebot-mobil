// app/details/[id]/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function DrawerLayout() {
  const navigation = useNavigation();

  const toggleMenu = () => navigation.dispatch(DrawerActions.toggleDrawer());

  return (
    <Tabs
      screenOptions={{
        headerShown: false, 
        tabBarActiveTintColor: '#ffffff', 
        tabBarInactiveTintColor: '#b3b3b3', 
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0, 
          borderTopWidth: 0, 
          height: 60, 
          backgroundColor: 'transparent',
        },

        tabBarBackground: () => (
          <BlurView 
            tint="dark" 
            intensity={80} 
            style={StyleSheet.absoluteFill} 
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'home' : 'home-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="lanefollowing"
        options={{
          title: 'Lane Following',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'navigate' : 'navigate-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="drive"
        options={{
          title: 'Drive',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'car' : 'car-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
