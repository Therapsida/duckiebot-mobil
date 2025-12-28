
// components/RobotCard.tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// Tip dosyanı import et (yolunu kendine göre ayarla)

export interface DiscoveredRobotInfo {
  ip: string;            // addr[0]
  name: string;          // packet.name
  type: string;          // packet.type (örn: "duckiebot")
  configuration: string; // packet.configuration (örn: "DB21")
  hardware: string;      // packet.hardware
}

interface DuckiebotCardsProps {
  item: DiscoveredRobotInfo;
  onPress: () => void; // Tıklanınca ne olacağını dışarıdan alacağız
}

export const DuckiebotCards = ({ item, onPress }: DuckiebotCardsProps) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.type}</Text>
        </View>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.label}>IP:</Text>
        <Text style={styles.value}>{item.ip}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Donanım:</Text>
        <Text style={styles.value}>{item.hardware}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12, 
    gap: 12, // Kartlar arası boşluk (veya FlatList gap kullanılabilir)
    // Gölge Efektleri (Shadow) - Kart hissi verir
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android için gölge
    borderWidth: 1,
    borderColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  badge: {
    backgroundColor: '#e0f2f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#00695c',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  label: {
    color: '#666',
    width: 80,
    fontSize: 14,
  },
  value: {
    color: '#333',
    fontWeight: '500',
    fontSize: 14,
  },
});