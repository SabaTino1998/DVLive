import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Action, Gate, Page, s } from '../components/UI';
export default function NotFound() { return <Gate><Page><View style={{ gap: 25, paddingVertical: 60 }}><Text style={s.heading}>This room does not exist.</Text><Action onPress={() => router.replace('/')}>Back to the house ↗</Action></View></Page></Gate>; }
