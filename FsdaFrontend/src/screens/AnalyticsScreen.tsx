import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Analytics & Insights
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        View data insights and visualizations
      </Text>
      <Text variant="bodyMedium" style={styles.comingSoon}>
        Coming Soon! 📊
      </Text>
      <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
        Back
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  comingSoon: {
    color: '#03dac6',
    marginBottom: 32,
  },
  button: {
    minWidth: 200,
  },
});

export default React.memo(AnalyticsScreen);