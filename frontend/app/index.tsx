import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { dvlive } from '../lib/dvlive';
import { registerSignupVoter } from '../lib/voterFlow';
import type { Show, Voter } from '../src/types';
import { Action, colors, errorMessage, Eyebrow, Gate, Loading, Notice, Page, formatVotes, Portrait, s, Status, statusLabel } from '../components/UI';

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
  const columns = width >= 1150 ? 4 : width >= 800 ? 3 : width >= 500 ? 2 : 1;
  const cardWidth = columns === 4 ? '23.5%' : columns === 3 ? '32%' : columns === 2 ? '48%' : '100%';
  return <Page>
    <View style={h.titleRow}>
      <View style={{ flex: 1 }}><Text accessibilityRole="header" style={s.heading}>{show?.name || 'DVLive'}</Text><Text style={s.muted}>Current round and choices</Text></View>
      <Action secondary onPress={retry} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</Action>
    </View>
    <View style={[h.summary, { flexDirection: wide ? 'row' : 'column' }]}>
      <View accessibilityLabel="Available votes" style={h.balance}>
        <Text style={h.balanceTitle}>Available votes</Text>
        <Text style={h.voteCount}>{busy && !voter ? '…' : voter ? formatVotes(voter.remainingPoints) : '—'}</Text>
        <View style={h.breakdown}>
          {[
            ['Standard votes', voter?.balance.standardPoint],
            ['Additional votes', voter?.balance.additionalPoint],
            ['Purchased votes', voter?.balance.purchasedPoint],
          ].map(([label, value]) => <View key={String(label)} style={h.balanceItem}>
            <Text style={h.balanceLabel}>{label}</Text>
            <Text style={h.balanceValue}>{typeof value === 'number' ? formatVotes(value) : '—'}</Text>
          </View>)}
        </View>
      </View>
      <View style={[h.roundCard, { width: wide ? 310 : '100%' }]}>
        <Eyebrow>CURRENT ROUND</Eyebrow>
        <Text style={h.roundTitle}>{show?.round ? `Round ${show.round.currentRound}` : busy ? 'Loading…' : 'No active round'}</Text>
        {!!show?.round?.name && <Text style={s.muted}>{show.round.name}</Text>}
        <Text style={s.muted}>{choices.length} {choices.length === 1 ? 'choice' : 'choices'}</Text>
      </View>
    </View>
    {error && <Notice retry={retry}>{error}</Notice>}
    <View style={h.sectionHeading}><Text accessibilityRole="header" style={h.sectionTitle}>Choices</Text><Text style={s.muted}>{filtered.length} of {choices.length}</Text></View>
    <View style={[h.toolbar, { flexDirection: wide ? 'row' : 'column' }]}>
      <View style={h.filters}>
        {[
          ['ALL', 'All'], ['PRESENT', 'Present'], ['EVICTED', 'Evicted'],
        ].map(([value, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === filter }} key={value} onPress={() => setFilter(value)} style={[h.filter, value === filter && h.filterActive]}>
          <Text style={[h.filterText, value === filter && { color: colors.blue }]}>{label} ({choices.filter(choice => value === 'ALL' || choice.status === value).length})</Text>
        </Pressable>)}
      </View>
      <TextInput accessibilityLabel="Search choices" placeholder="Search choices" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={[h.search, { width: wide ? 240 : '100%' }]} />
    </View>
    {showError ? <Notice retry={retry}>{showError}</Notice> : busy && !show ? <Loading label="Loading choices…" /> : filtered.length ? <View style={h.grid}>
      {filtered.map(choice => <Pressable accessibilityRole="link" accessibilityLabel={`${choice.firstname} ${choice.lastname}, ${statusLabel(choice.status)}`} key={choice.uuid} onPress={() => router.push({ pathname: '/choices/[uuid]', params: { uuid: choice.uuid } })} style={({ pressed }) => [h.card, { width: cardWidth, opacity: pressed ? .7 : 1 }]}>
        <Portrait choice={choice} />
        <View style={h.caption}>
          <Status value={choice.status} />
          <Text style={h.name}>{choice.firstname} {choice.lastname}</Text>
          <Text style={h.detailsLink}>View choice →</Text>
        </View>
      </Pressable>)}
    </View> : <View style={h.empty}>
      <Text style={h.emptyTitle}>{search || filter !== 'ALL' ? 'No matching choices.' : show?.round ? 'No choices in this round.' : 'No round available.'}</Text>
      <Text style={s.muted}>{search || filter !== 'ALL' ? 'Try another name or change the filter.' : 'Refresh to check for updates.'}</Text>
      {(search || filter !== 'ALL') && <Action secondary onPress={() => { setSearch(''); setFilter('ALL'); }}>Show all choices</Action>}
    </View>}
  </Page>;
}
const h = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 },
  summary: { gap: 20 },
  balance: { flex: 1, backgroundColor: colors.blue, borderRadius: 10, padding: 26 },
  balanceTitle: { color: '#e6edff', fontSize: 15, fontWeight: '600' },
  voteCount: { color: '#fff', fontSize: 64, fontWeight: '700', letterSpacing: -2, marginTop: 10, marginBottom: 22 },
  breakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, borderTopWidth: 1, borderTopColor: '#ffffff44', paddingTop: 18 },
  balanceItem: { minWidth: 90, gap: 7 }, balanceLabel: { color: '#e6edff', fontSize: 11 }, balanceValue: { color: '#fff', fontSize: 19, fontWeight: '600' },
  roundCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 26, gap: 12, justifyContent: 'center' }, roundTitle: { color: colors.ink, fontSize: 25, fontWeight: '600' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 34, marginBottom: 18 }, sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '600' },
  toolbar: { justifyContent: 'space-between', gap: 16, marginBottom: 22 },
  filters: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', alignItems: 'center' }, filter: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 6 }, filterActive: { backgroundColor: '#e9efff' }, filterText: { color: colors.muted, fontSize: 12 },
  search: { minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: '#fff', fontSize: 13, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: '2%', rowGap: 20 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 8, overflow: 'hidden' },
  caption: { padding: 16, gap: 8 }, name: { color: colors.ink, fontSize: 18, lineHeight: 25, fontWeight: '600' }, detailsLink: { color: colors.blue, fontSize: 12, marginTop: 6 },
  empty: { padding: 40, alignItems: 'center', gap: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', textAlign: 'center' },
});
