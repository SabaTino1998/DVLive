import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Action, colors, errorMessage, Eyebrow, Gate, Loading, Notice, Page, Portrait, s, Status } from '../../components/UI';
import { dvlive } from '../../lib/dvlive';
import type { ChoiceDetail } from '../../src/types';

export default function ChoicePage() { return <Gate><Detail /></Gate>; }
function Detail() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>(); const wide = useWindowDimensions().width >= 850;
  const [choice, setChoice] = useState<ChoiceDetail | null>(null); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true; setChoice(null); setError('');
    dvlive.choice(uuid).then(value => { if (current) setChoice(value); }).catch(error => { if (current) setError(errorMessage(error)); });
    return () => { current = false; };
  }, [uuid, attempt]);
  return <Page back>
    {error ? <Notice retry={() => setAttempt(value => value + 1)}>{error}</Notice> : !choice ? <Loading label="Loading choice…" /> : <View style={[d.grid, { flexDirection: wide ? 'row' : 'column' }]}>
      <View style={{ width: wide ? '36%' : '100%', borderRadius: 8, overflow: 'hidden' }}><Portrait choice={choice} large /></View>
      <View style={d.copy}>
        <Eyebrow>CHOICE</Eyebrow>
        <Text accessibilityRole="header" style={s.heading}>{choice.firstname} {choice.lastname}</Text>
        <View style={d.statusRow}><Text style={s.muted}>Status</Text><Status value={choice.status} /></View>
        <View style={d.description}>
          <Text style={d.label}>Description</Text>
          <Text style={d.bio}>{choice.bio || 'No description available for this choice.'}</Text>
        </View>
        {choice.eliminatedRound && <View style={d.round}><Text style={s.muted}>Evicted in</Text><Text style={d.value}>Round {choice.eliminatedRound.round}</Text></View>}
        {choice.reintroducedRound && <View style={d.round}><Text style={s.muted}>Reintroduced in</Text><Text style={d.value}>Round {choice.reintroducedRound.round}</Text></View>}
        <Action secondary onPress={() => router.replace('/')}>Back to choices</Action>
      </View>
    </View>}
  </Page>;
}
const d = StyleSheet.create({
  grid: { gap: 30, alignItems: 'flex-start' }, copy: { flex: 1, width: '100%', gap: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 18 },
  description: { gap: 10, marginBottom: 8 }, label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  bio: { color: colors.muted, fontSize: 14, lineHeight: 25 },
  round: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: colors.line }, value: { color: colors.ink, fontSize: 13 },
});
