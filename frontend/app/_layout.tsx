import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SmartUserProvider } from '../contexts/SmartUserContext';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return <SafeAreaProvider><SmartUserProvider><AuthProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f7f6f2' } }} /></AuthProvider></SmartUserProvider></SafeAreaProvider>;
}
