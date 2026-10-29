import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useSmartUser } from '../contexts/SmartUserContext';
import type { Choice } from '../src/types';

export const colors = { paper: '#f7f6f2', ink: '#20221f', muted: '#767d70', line: '#dedfd6', blue: '#2949e8', pale: '#eeeee4', green: '#4b694a', orange: '#aa6244' };
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Connection failed. Please try again.';
export const points = (value: number) => new Intl.NumberFormat('en-US').format(value);
export const statusLabel = (value: string) => value === 'PRESENT' ? 'IN THE HOUSE' : value === 'EVICTED' ? 'EVICTED' : value;
export function Logo({ light = false }: { light?: boolean }) { return <Text style={[s.logo, light && { color: '#fff' }]}>dv<Text style={{ color: light ? '#bfd3ad' : colors.blue }}>live</Text><Text style={{ color: '#f57c42' }}>·</Text></Text>; }
export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) { return <Text style={[s.eyebrow, light && { color: '#c5d3be' }]}>{children}</Text>; }
export function Action({ children, onPress, disabled, secondary = false }: { children: ReactNode; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && { opacity: .65 }]}><Text style={[s.buttonText, secondary && { color: colors.ink }]}>{children}</Text></Pressable>;
}
export function Notice({ children, retry }: { children: ReactNode; retry?: () => void }) { return <View accessibilityRole="alert" style={s.notice}><Text style={s.noticeText}>{children}</Text>{retry && <Pressable accessibilityRole="button" onPress={retry}><Text style={s.retry}>Try again ↻</Text></Pressable>}</View>; }
export function Loading({ label = 'Loading…' }: { label?: string }) { return <View style={s.loading}><ActivityIndicator color={colors.blue} /><Text style={s.muted}>{label}</Text></View>; }
export function Status({ value }: { value: string }) { return <Text style={[s.status, { color: value === 'PRESENT' ? colors.green : colors.orange }]}>●  {statusLabel(value)}</Text>; }
export function Portrait({ choice, large = false }: { choice: Choice; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const uri = large ? choice.desktopPicture || choice.mobilePicture : choice.mobilePicture || choice.desktopPicture;
  const backgrounds = ['#dce0d5', '#eadacb', '#d5dce8', '#ddd9e5', '#e0e2be'];
  const tone = [...choice.uuid].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  return <View style={[s.portrait, { backgroundColor: backgrounds[tone] }, large && { aspectRatio: 1 }]}>{uri && !failed ? <Image source={{ uri }} accessibilityLabel={`${choice.firstname} ${choice.lastname}`} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} /> : <><View style={s.silhouette} /><Text style={s.initials}>{choice.firstname.charAt(0)}{choice.lastname.charAt(0)}</Text></>}</View>;
}
export function Gate({ children, authenticated = true }: { children: ReactNode; authenticated?: boolean }) {
  const smart = useSmartUser(); const auth = useAuth();
  if (!smart.ready || auth.restoring) return <SafeAreaView style={s.screen}><Loading label="Opening the house…" /></SafeAreaView>;
  if (smart.error) return <SafeAreaView style={s.screen}><View style={s.setupError}><Logo /><Notice retry={() => void smart.refresh()}>{smart.error}</Notice></View></SafeAreaView>;
  if (authenticated && !auth.session) return <Redirect href="/login" />;
  if (!authenticated && auth.session) return <Redirect href="/" />;
  return <>{children}</>;
}
export function Page({ children, back = false }: { children: ReactNode; back?: boolean }) {
  const auth = useAuth(); const [error, setError] = useState('');
  const { width } = useWindowDimensions(); const compact = width < 700;
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.pageScroll} keyboardShouldPersistTaps="handled"><View style={[s.header, compact && { paddingHorizontal: 22, gap: 20 }]}><Pressable accessibilityRole="link" accessibilityLabel="DVLive house" onPress={() => router.replace('/')}><Logo /></Pressable><Pressable accessibilityRole="link" onPress={() => router.replace('/')}><Text style={s.nav}>⌂  The house</Text></Pressable><View style={s.userArea}>{!compact && <Text style={s.eyebrow}>● LIVE EXPERIENCE</Text>}<View style={s.avatar}><Text style={s.avatarText}>{(auth.session?.email || 'U').charAt(0).toUpperCase()}</Text></View><Pressable accessibilityRole="button" disabled={auth.busy} onPress={() => { setError(''); void auth.signOut().catch(error => setError(errorMessage(error))); }}><Text style={s.nav}>{auth.busy ? 'Signing out…' : 'Sign out ↗'}</Text></Pressable></View></View><View style={[s.content, compact && { paddingHorizontal: 22 }]}>{error && <Notice>{error}</Notice>}{back && <Pressable accessibilityRole="link" onPress={() => router.replace('/')} style={s.back}><Text style={s.muted}>← All housemates</Text></Pressable>}{children}</View><View style={s.footer}><Logo /><Text style={s.footerText}>The people. The stories. The house.</Text><Text style={s.footerText}>DVLive © {new Date().getFullYear()}</Text></View></ScrollView></SafeAreaView>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, pageScroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 40, paddingTop: 32, paddingBottom: 70, flex: 1 },
  header: { minHeight: 92, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center', gap: 65, borderBottomWidth: 1, borderBottomColor: colors.line },
  logo: { fontSize: 36, fontWeight: '800', letterSpacing: -2, color: colors.ink },
  nav: { fontSize: 12, color: colors.ink, fontWeight: '600' }, userArea: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 17 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e1e8d7', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '700', color: colors.green },
  eyebrow: { fontSize: 9, letterSpacing: 1.8, fontWeight: '700', color: colors.muted, lineHeight: 17 },
  heading: { fontSize: 42, lineHeight: 49, fontWeight: '700', letterSpacing: -1.8, color: colors.ink }, muted: { color: colors.muted, fontSize: 13, lineHeight: 22 },
  button: { backgroundColor: colors.blue, minHeight: 51, paddingHorizontal: 22, paddingVertical: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line }, buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  notice: { backgroundColor: '#fff0e8', borderWidth: 1, borderColor: '#ebc7b5', padding: 15, borderRadius: 8, gap: 10, marginVertical: 12 }, noticeText: { color: '#8e3c23', fontSize: 13, lineHeight: 21 }, retry: { color: '#8e3c23', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  loading: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 18 }, setupError: { padding: 30, maxWidth: 600, width: '100%', alignSelf: 'center', marginVertical: 'auto' },
  status: { fontSize: 8, letterSpacing: .7, fontWeight: '700', lineHeight: 18 },
  portrait: { width: '100%', aspectRatio: 4 / 4.5, overflow: 'hidden', position: 'relative' }, silhouette: { position: 'absolute', width: '85%', height: '60%', backgroundColor: '#ffffff44', borderTopLeftRadius: 150, borderTopRightRadius: 150, bottom: '-10%', alignSelf: 'center' }, initials: { position: 'absolute', left: 18, bottom: 14, fontSize: 62, fontWeight: '600', letterSpacing: -4, color: '#ffffffbb' },
  back: { marginBottom: 27, alignSelf: 'flex-start' }, footer: { marginHorizontal: 30, paddingVertical: 23, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', gap: 25, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }, footerText: { fontSize: 9, color: colors.muted },
});
