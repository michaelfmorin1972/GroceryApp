import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListEditor } from '@/components/ListEditor';
import { ShareSheet } from '@/components/ShareSheet';
import { useHousehold } from '@/household';
import { colors } from '@/theme';
import { ListMeta } from '@/types';
import { useRemainingCount } from '@/useListStore';

export default function HomeScreen() {
  const h = useHousehold();
  const [editorTarget, setEditorTarget] = useState<'new' | ListMeta | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Our Lists</Text>
        <View style={styles.headerLinks}>
          <Pressable onPress={() => setShareOpen(true)} hitSlop={8}>
            <Text style={styles.link}>{h.memberCount > 1 ? `Shared (${h.memberCount})` : 'Share'}</Text>
          </Pressable>
          {h.lists.length > 1 && (
            <Pressable onPress={() => setReordering((r) => !r)} hitSlop={8}>
              <Text style={styles.link}>{reordering ? 'Done' : 'Reorder'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {h.syncError && (
        <View style={styles.syncError}>
          <Text style={styles.syncErrorText}>Sync problem: {h.syncError}</Text>
        </View>
      )}

      {!h.ready ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.listWrap}>
          {h.lists.map((l, idx) => (
            <ListCard
              key={l.id}
              list={l}
              reordering={reordering}
              isFirst={idx === 0}
              isLast={idx === h.lists.length - 1}
              onOpen={() => router.push({ pathname: '/list/[id]', params: { id: l.id } })}
              onEdit={() => setEditorTarget(l)}
              onMove={(d) => h.moveList(l.id, d)}
            />
          ))}
          <Pressable
            style={({ pressed }) => [styles.newCard, pressed && { opacity: 0.7 }]}
            onPress={() => setEditorTarget('new')}
          >
            <Text style={styles.newText}>+ New list</Text>
          </Pressable>
        </ScrollView>
      )}

      <ListEditor
        key={editorTarget === null ? 'closed' : editorTarget === 'new' ? 'new' : editorTarget.id}
        target={editorTarget}
        existingNames={h.lists.map((l) => l.name)}
        onClose={() => setEditorTarget(null)}
        onCreate={(t) => h.createList(t)}
        onSave={h.updateList}
        onDelete={h.deleteList}
      />
      <ShareSheet
        visible={shareOpen}
        inviteCode={h.inviteCode}
        memberCount={h.memberCount}
        onClose={() => setShareOpen(false)}
        onJoin={h.joinHousehold}
      />
    </SafeAreaView>
  );
}

type CardProps = {
  list: ListMeta;
  reordering: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onMove: (delta: -1 | 1) => void;
};

function ListCard({ list, reordering, isFirst, isLast, onOpen, onEdit, onMove }: CardProps) {
  const remaining = useRemainingCount(list.id);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && !reordering && { opacity: 0.8 }]}
      onPress={reordering ? undefined : onOpen}
      onLongPress={onEdit}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{list.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {list.name}
        </Text>
        <Text style={styles.cardMeta}>
          {remaining === null ? ' ' : remaining === 0 ? 'Nothing needed' : `${remaining} to get`}
        </Text>
      </View>
      {reordering ? (
        <View style={styles.moveBtns}>
          <Pressable disabled={isFirst} onPress={() => onMove(-1)} hitSlop={6} style={styles.moveBtn}>
            <Text style={[styles.moveIcon, isFirst && styles.disabled]}>▲</Text>
          </Pressable>
          <Pressable disabled={isLast} onPress={() => onMove(1)} hitSlop={6} style={styles.moveBtn}>
            <Text style={[styles.moveIcon, isLast && styles.disabled]}>▼</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onEdit} hitSlop={10} style={styles.editBtn}>
          <Text style={styles.editIcon}>⋯</Text>
        </Pressable>
      )}
      {remaining !== null && remaining > 0 && !reordering && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{remaining}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  headerLinks: { flexDirection: 'row', gap: 18 },
  link: { fontSize: 16, color: colors.primary, fontWeight: '600', paddingBottom: 4 },
  syncError: { marginHorizontal: 16, marginTop: 6, backgroundColor: '#FDECEA', borderRadius: 10, padding: 10 },
  syncErrorText: { color: colors.danger, fontSize: 13 },
  listWrap: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 28 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  editBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  editIcon: { fontSize: 22, color: colors.muted, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 52,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  moveBtns: { flexDirection: 'row', gap: 4 },
  moveBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  moveIcon: { fontSize: 16, color: colors.primary },
  disabled: { color: colors.border },
  newCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    padding: 18,
    alignItems: 'center',
  },
  newText: { fontSize: 16, fontWeight: '600', color: colors.primary },
});
