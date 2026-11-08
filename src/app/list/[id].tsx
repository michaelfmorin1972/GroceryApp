import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddItemBar } from '@/components/AddItemBar';
import { ItemEditor } from '@/components/ItemEditor';
import { ItemRow } from '@/components/ItemRow';
import { SectionManager } from '@/components/SectionManager';
import { useHousehold } from '@/household';
import { colors } from '@/theme';
import { Item } from '@/types';
import { useListStore } from '@/useListStore';

const byCheckedThenName = (a: Item, b: Item) =>
  Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name);

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, syncError } = useHousehold();
  const store = useListStore(id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  // If the list was deleted (here or on another phone), go back home.
  useEffect(() => {
    if (ready && !store.meta) router.back();
  }, [ready, store.meta]);

  const metaSections = store.meta?.sections;
  const sections = useMemo(() => metaSections ?? [], [metaSections]);
  const label = store.meta?.sectionLabel ?? 'Section';
  const noSection = `No ${label.toLowerCase()}`;

  const sortedItems = useMemo(() => [...store.items].sort(byCheckedThenName), [store.items]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const s of sections) groups.set(s, []);
    for (const item of store.items) {
      const key = item.section && groups.has(item.section) ? item.section : noSection;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()]
      .filter(([, data]) => data.length > 0)
      .map(([title, data]) => ({
        title,
        data: data.sort(byCheckedThenName),
        remaining: data.filter((i) => !i.checked).length,
      }));
  }, [store.items, sections, noSection]);

  if (!store.meta) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const editingItem = store.items.find((i) => i.id === editingId) ?? null;
  const remaining = store.items.filter((i) => !i.checked).length;
  const checkedCount = store.items.length - remaining;
  const isGrouped = store.viewMode === 'sections';

  const renderRow = ({ item }: { item: Item }) => (
    <ItemRow
      item={item}
      sectionText={isGrouped ? undefined : item.section && sections.includes(item.section) ? item.section : noSection}
      onToggle={() => store.toggleItem(item.id)}
      onEdit={() => setEditingId(item.id)}
    />
  );

  const empty = store.loaded ? (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{store.meta.icon}</Text>
      <Text style={styles.emptyTitle}>Nothing on this list</Text>
      <Text style={styles.emptyText}>Start typing above to add something.</Text>
    </View>
  ) : (
    <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.link}>‹ Lists</Text>
          </Pressable>
          <Pressable onPress={() => setSectionsOpen(true)} hitSlop={8}>
            <Text style={styles.link}>{label}s</Text>
          </Pressable>
        </View>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {store.meta.icon} {store.meta.name}
          </Text>
          <Text style={styles.subtitle}>
            {remaining} to get{checkedCount > 0 ? ` · ${checkedCount} done` : ''}
          </Text>
        </View>

        {syncError && (
          <View style={styles.syncError}>
            <Text style={styles.syncErrorText}>Sync problem: {syncError}</Text>
          </View>
        )}

        <View style={styles.segment}>
          {(['list', 'sections'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => store.setViewMode(mode)}
              style={[styles.segBtn, store.viewMode === mode && styles.segBtnOn]}
            >
              <Text style={[styles.segText, store.viewMode === mode && styles.segTextOn]}>
                {mode === 'list' ? 'List' : `By ${label.toLowerCase()}`}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.addWrap}>
          <AddItemBar
            items={store.items}
            known={store.known}
            onAdd={store.addItem}
            onToggle={store.toggleItem}
            onNotice={setNotice}
          />
        </View>

        {notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        {isGrouped ? (
          <SectionList
            sections={grouped}
            keyExtractor={(i) => i.id}
            renderItem={renderRow}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.remaining} left</Text>
              </View>
            )}
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={empty}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <FlatList
            data={sortedItems}
            keyExtractor={(i) => i.id}
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={empty}
            contentContainerStyle={styles.listContent}
          />
        )}

        {checkedCount > 0 && (
          <Pressable style={styles.clearBtn} onPress={store.clearChecked}>
            <Text style={styles.clearText}>
              Clear {checkedCount} checked item{checkedCount === 1 ? '' : 's'}
            </Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>

      <ItemEditor
        key={editingId ?? 'none'}
        item={editingItem}
        sections={sections}
        sectionLabel={label}
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          const err = editingItem && store.updateItem(editingItem.id, patch);
          if (err) setNotice(err);
        }}
        onDelete={() => editingItem && store.removeItem(editingItem.id)}
        onAddSection={store.addSection}
      />
      <SectionManager
        visible={sectionsOpen}
        label={label}
        sections={sections}
        onClose={() => setSectionsOpen(false)}
        onAdd={store.addSection}
        onMove={store.moveSection}
        onRename={store.renameSection}
        onDelete={store.deleteSection}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  header: { paddingHorizontal: 16, paddingTop: 6 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  link: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  syncError: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#FDECEA', borderRadius: 10, padding: 10 },
  syncErrorText: { color: colors.danger, fontSize: 13 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: 3,
  },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnOn: { backgroundColor: colors.card },
  segText: { fontSize: 15, color: colors.muted, fontWeight: '500' },
  segTextOn: { color: colors.text, fontWeight: '700' },
  addWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, zIndex: 10 },
  notice: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.warnSoft, borderRadius: 10, padding: 10 },
  noticeText: { color: colors.warn, fontSize: 14, fontWeight: '500' },
  listContent: { paddingBottom: 80 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 13, color: colors.muted },
  empty: { alignItems: 'center', paddingTop: 50 },
  emptyIcon: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, marginTop: 4 },
  clearBtn: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: colors.text,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  clearText: { color: '#fff', fontWeight: '600' },
});
