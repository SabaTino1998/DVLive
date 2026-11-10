import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Action, colors, errorMessage, Gate, Logo, Notice, s } from './UI';

export function AuthScreen({ signup = false }: { signup?: boolean }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (auth.busy) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) { setError('Enter a valid email address and password.'); return; }
    if (signup && password !== confirm) { setError('The passwords do not match.'); return; }
    try {
      await (signup ? auth.signUp(email, password) : auth.signIn(email, password));
      router.replace('/');
    } catch (error) { setError(errorMessage(error)); }
  }

  return <Gate authenticated={false}>
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={a.layout}>
          <View style={a.container}>
            <Logo />
            <View style={a.form}>
              <Text accessibilityRole="header" style={s.heading}>{signup ? 'Create your account' : 'Sign in to DVLive'}</Text>
              <Text style={s.muted}>{signup ? 'Sign up to view rounds, explore choices and check your votes.' : 'View the current round, explore choices and check your votes.'}</Text>
              <View style={a.fields}>
                <Text style={a.label}>Email</Text>
                <TextInput accessibilityLabel="Email" autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="Your email address" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} editable={!auth.busy} style={a.input} />
                <Text style={a.label}>Password</Text>
                <View style={a.password}>
                  <TextInput accessibilityLabel="Password" autoComplete={signup ? 'new-password' : 'current-password'} secureTextEntry={!visible} autoCapitalize="none" value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor={colors.muted} editable={!auth.busy} style={[a.input, { flex: 1, marginBottom: 0, paddingRight: 80 }]} onSubmitEditing={signup ? undefined : submit} />
                  <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(value => !value)} style={a.showPassword}><Text style={a.link}>{visible ? 'Hide' : 'Show'}</Text></Pressable>
                </View>
                {signup && <>
                  <Text style={a.label}>Confirm password</Text>
                  <TextInput accessibilityLabel="Confirm password" autoComplete="new-password" secureTextEntry={!visible} autoCapitalize="none" placeholder="Re-enter your password" placeholderTextColor={colors.muted} value={confirm} onChangeText={setConfirm} editable={!auth.busy} style={a.input} onSubmitEditing={submit} />
                </>}
                {error && <Notice>{error}</Notice>}
                <Action onPress={() => void submit()} disabled={auth.busy}>{auth.busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</Action>
              </View>
              <View style={a.switch}>
                <Text style={s.muted}>{signup ? 'Already have an account?' : 'Need an account?'}</Text>
                <Pressable accessibilityRole="link" disabled={auth.busy} onPress={() => router.replace(signup ? '/login' : '/signup')}><Text style={a.link}>{signup ? 'Sign in' : 'Sign up'}</Text></Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Gate>;
}
const a = StyleSheet.create({
  layout: { flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  container: { width: '100%', maxWidth: 440, gap: 28 },
  form: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 26, gap: 14 },
  fields: { marginTop: 10 }, label: { fontSize: 12, fontWeight: '600', color: colors.ink, marginBottom: 9 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 6, minHeight: 48, paddingHorizontal: 12, fontSize: 13, color: colors.ink, marginBottom: 20 },
  password: { flexDirection: 'row', position: 'relative', marginBottom: 20 }, showPassword: { position: 'absolute', right: 13, top: 15 },
  switch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 6 },
  link: { color: colors.blue, fontSize: 13, fontWeight: '600' },
});
