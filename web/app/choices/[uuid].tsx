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
  return <Page back>{error ? <Notice retry={() => setAttempt(value => value + 1)}>{error}</Notice> : !choice ? <Loading label="Loading their story…" /> : <View style={[d.grid, { flexDirection: wide ? 'row' : 'column' }]}><View style={{ width: wide ? '46%' : '100%', borderRadius: 12, overflow: 'hidden' }}><Portrait choice={choice} large /></View><View style={d.copy}><Eyebrow>THE HOUSEMATES</Eyebrow><View style={{ marginTop: 28 }}><Status value={choice.status} /></View><Text accessibilityRole="header" style={[d.title, { fontSize: wide ? 62 : 48 }]}>{choice.firstname}{"\n"}<Text style={{ color: '#77816b', fontWeight: '400' }}>{choice.lastname}</Text></Text><View style={d.rule} /><Eyebrow>THEIR STORY</Eyebrow><Text style={d.bio}>{choice.bio || 'Their story is still unfolding. Check back to get to know them better.'}</Text>{choice.eliminatedRound && <View style={d.round}><Text style={s.muted}>Left the house</Text><Text>Round {choice.eliminatedRound.round}</Text></View>}{choice.reintroducedRound && <View style={d.round}><Text style={s.muted}>Returned to the house</Text><Text>Round {choice.reintroducedRound.round}</Text></View>}<Action secondary onPress={() => router.replace('/')}>Meet the other housemates  ↗</Action></View></View>}</Page>;
}
const d = StyleSheet.create({ grid: { gap: 45, alignItems: 'flex-start' }, copy: { flex: 1, paddingTop: 10, width: '100%' }, title: { color: colors.ink, fontWeight: '700', letterSpacing: -2, marginTop: 16 }, rule: { height: 1, backgroundColor: colors.line, marginVertical: 28 }, bio: { fontSize: 15, color: '#6b7461', lineHeight: 29, marginTop: 15, marginBottom: 35 }, round: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 18 } });
