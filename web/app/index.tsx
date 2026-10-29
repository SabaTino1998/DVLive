import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { dvlive } from '../lib/dvlive';
import { registerSignupVoter } from '../lib/voterFlow';
import type { Show, Voter } from '../src/types';
import { Action, colors, errorMessage, Eyebrow, Gate, Loading, Notice, Page, points, Portrait, s, Status } from '../components/UI';

export default function Home() { return <Gate><HomeContent /></Gate>; }
function HomeContent() {
  const auth = useAuth(); const { width } = useWindowDimensions(); const wide = width >= 850;
  const [show, setShow] = useState<Show | null>(null); const [voter, setVoter] = useState<Voter | null>(null);
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [showError, setShowError] = useState('');
  const [attempt, setAttempt] = useState(0); const [search, setSearch] = useState(''); const [filter, setFilter] = useState('ALL');
  const token = auth.session?.userToken;
  useEffect(() => {
    if (!token) return;
    let current = true;
    async function load() {
      setBusy(true); setError(''); setShowError('');
      try {
        if (auth.session!.needsRegistration) {
          await registerSignupVoter(token!, () => dvlive.createVoter(auth.session!.email));
          if (!current) return;
          await auth.voterRegistered();
        }
        const [balance, program] = await Promise.allSettled([dvlive.voter(), dvlive.show()]);
        if (!current) return;
        if (balance.status === 'fulfilled') setVoter(balance.value); else setError(errorMessage(balance.reason));
        if (program.status === 'fulfilled') setShow(program.value); else setShowError(errorMessage(program.reason));
      } catch (error) { if (current) setError(`Account created. Voter registration is incomplete: ${errorMessage(error)}`); }
      finally { if (current) setBusy(false); }
    }
    void load();
    return () => { current = false; };
  }, [token, attempt]);
  const retry = () => setAttempt(value => value + 1);
  const choices = show?.round?.choices ?? [];
  const filtered = choices.filter(choice => (filter === 'ALL' || choice.status === filter) && `${choice.firstname} ${choice.lastname}`.toLocaleLowerCase('en').includes(search.toLocaleLowerCase('en')));
  const columns = width >= 1150 ? 4 : width >= 800 ? 3 : 2;
  const cardWidth = columns === 4 ? '23.5%' : columns === 3 ? '32%' : '48%';
  return <Page><Eyebrow>YOUR LIVE EXPERIENCE</Eyebrow><View style={[h.welcomeGrid, { flexDirection: wide ? 'row' : 'column' }]}><View style={h.welcome}><Eyebrow>● {show?.name || 'INSIDE THE HOUSE'}</Eyebrow><Text accessibilityRole="header" style={[s.heading, { marginTop: 20, marginBottom: 16, fontSize: wide ? 45 : 35 }]}>The house is open.{"\n"}<Text style={{ color: '#717968' }}>You’re one of us.</Text></Text><Text style={s.muted}>Every housemate has a story.{"\n"}Meet the housemates and follow their journey.</Text><View style={h.round}><Text style={h.roundTag}>{show?.round ? `ROUND ${show.round.currentRound.toString().padStart(2, '0')}` : 'THE HOUSE'}</Text><Text style={h.roundName}>{show?.round?.name || 'Every story, all in one place.'}</Text></View></View><View accessibilityLabel="Points balance" style={[h.balance, { width: wide ? 310 : '100%' }]}><Eyebrow light>YOUR BALANCE                                      ✦</Eyebrow><Text style={h.points}>{busy && !voter ? '…' : voter ? points(voter.remainingPoints) : '—'}<Text style={h.pointsLabel}>  points</Text></Text><Text style={h.balanceDescription}>Your points, always at your fingertips.</Text><View style={h.breakdown}>{[['Standard', voter?.balance.standardPoint], ['Extra', voter?.balance.additionalPoint], ['Purchased', voter?.balance.purchasedPoint]].map(([label, value]) => <View key={String(label)} style={{ flex: 1, gap: 7 }}><Text style={h.balanceDescription}>{label}</Text><Text style={h.balanceValue}>{typeof value === 'number' ? points(value) : '—'}</Text></View>)}</View><Pressable accessibilityRole="button" disabled={busy} onPress={retry}><Text style={h.refresh}>{busy ? 'Updating…' : 'Refresh balance  ↻'}</Text></Pressable></View></View>{error && <Notice retry={retry}>{error}</Notice>}<View style={h.sectionHeading}><View><Eyebrow>FACES, PERSONALITIES, STORIES</Eyebrow><Text accessibilityRole="header" style={h.sectionTitle}>The housemates <Text style={{ fontSize: 15, color: colors.muted }}> {choices.length.toString().padStart(2, '0')}</Text></Text></View>{wide && <Text style={s.muted}>See who’s inside.{"\n"}And who left their mark.</Text>}</View><View style={[h.toolbar, { flexDirection: wide ? 'row' : 'column' }]}><View style={h.filters}>{[['ALL', 'All'], ['PRESENT', 'In the house'], ['EVICTED', 'Evicted']].map(([value, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === filter }} key={value} onPress={() => setFilter(value)} style={[h.filter, value === filter && { backgroundColor: colors.ink }]}><Text style={[h.filterText, value === filter && { color: '#fff' }]}>{label}  {choices.filter(choice => value === 'ALL' || choice.status === value).length}</Text></Pressable>)}</View><TextInput accessibilityLabel="Search housemates" placeholder="⌕  Search housemates" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={[h.search, { width: wide ? 230 : '100%' }]} /></View>{showError ? <Notice retry={retry}>{showError}</Notice> : busy && !show ? <Loading label="Loading the housemates…" /> : filtered.length ? <View style={h.grid}>{filtered.map(choice => <Pressable accessibilityRole="link" accessibilityLabel={`${choice.firstname} ${choice.lastname}, ${choice.status === 'PRESENT' ? 'IN THE HOUSE' : 'EVICTED'}`} key={choice.uuid} onPress={() => router.push({ pathname: '/choices/[uuid]', params: { uuid: choice.uuid } })} style={({ pressed }) => [h.card, { width: cardWidth, opacity: pressed ? .7 : 1 }]}><Portrait choice={choice} /><View style={h.caption}><Status value={choice.status} /><Text style={h.name}>{choice.firstname}{"\n"}<Text style={{ fontWeight: '400' }}>{choice.lastname}</Text></Text><Text style={h.discover}>Discover their story                       ↗</Text></View></Pressable>)}</View> : <View style={h.empty}><Text style={h.emptyTitle}>{search || filter !== 'ALL' ? 'No housemates found.' : show?.round ? 'The housemates will be here soon.' : 'No round available right now.'}</Text><Text style={s.muted}>{search || filter !== 'ALL' ? 'Try another name or change the filter.' : 'Check back for the next stories.'}</Text>{(search || filter !== 'ALL') && <Action secondary onPress={() => { setSearch(''); setFilter('ALL'); }}>Show all</Action>}</View>}</Page>;
}
const h = StyleSheet.create({
  welcomeGrid: { gap: 20, marginTop: 22 }, welcome: { flex: 1, backgroundColor: colors.pale, padding: 30, borderRadius: 12, minHeight: 315 }, round: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 30, flexWrap: 'wrap' }, roundTag: { backgroundColor: '#e0e3d4', padding: 8, fontSize: 8, letterSpacing: 1, color: '#444d3e', fontWeight: '700', borderRadius: 4 }, roundName: { fontSize: 10, color: colors.muted },
  balance: { backgroundColor: colors.blue, borderRadius: 12, padding: 27 }, points: { fontSize: 64, letterSpacing: -3, color: '#fff', fontWeight: '600', marginTop: 16 }, pointsLabel: { fontSize: 14, letterSpacing: 0, color: '#d3dcff' }, balanceDescription: { fontSize: 10, color: '#c1cdff', lineHeight: 18 }, breakdown: { flexDirection: 'row', gap: 15, borderTopWidth: 1, borderTopColor: '#ffffff33', paddingTop: 17, marginTop: 24 }, balanceValue: { color: '#fff', fontSize: 17 }, refresh: { fontSize: 10, color: '#d3dcff', marginTop: 23 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 50 }, sectionTitle: { fontSize: 33, fontWeight: '700', letterSpacing: -1.4, color: colors.ink, marginTop: 10 }, toolbar: { justifyContent: 'space-between', gap: 16, marginTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 25 }, filters: { flexDirection: 'row', gap: 7 }, filter: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 30 }, filterText: { color: colors.muted, fontSize: 11 }, search: { minHeight: 37, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 6, fontSize: 12, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: '2%', rowGap: 22 }, card: { backgroundColor: '#fcfcf8', borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' }, caption: { padding: 17 }, name: { color: colors.ink, fontSize: 25, lineHeight: 31, letterSpacing: -.6, fontWeight: '700', marginTop: 9, marginBottom: 17 }, discover: { color: colors.muted, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 13, fontSize: 9 }, empty: { paddingVertical: 65, alignItems: 'center', gap: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }, emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: '600', textAlign: 'center' },
});
