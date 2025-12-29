import { Button, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { DuckiebotCards } from '../components/DuckiebotCards';
import { useDiscoveredDuckiebotInfo } from '../context/DuckiebotContext';

export default function HomeScreen() {
  const { data, refreshData, isLoading} = useDiscoveredDuckiebotInfo();
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      {data?.length > 0 && <Text style={styles.pageTitle}>Found Duckiebots</Text>}

      <FlatList
        style={styles.flatlist}
        data={data}
        keyExtractor={(item) => item.ip}
        contentContainerStyle={styles.listContent}
        
    
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isLoading ? 'Searching...' : 'No duckiebots found.'}
            </Text>
            <View style={styles.searchButton}>
              <Button disabled={isLoading} onPress={refreshData} title="Search Duckiebots" />
            </View>
          </View>
        }

    
        renderItem={({ item }) => (
          <DuckiebotCards 
            item={item} 
            onPress={() => {
              router.push({ pathname: '/details/[id]', params: { id: item.name } });
            }} 
          />
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', 
  },
  pageTitle: {
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    margin: 50,
    marginBottom: 20,
  },
  listContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 10,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  flatlist: {
    flex: 1,
  },
  searchButton: {
    marginTop: 16,
  },
})