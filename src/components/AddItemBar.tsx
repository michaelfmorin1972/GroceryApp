import { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import { Item, KnownItem, itemKey } from '../types';
import { AddResult } from '../useListStore';

type Props = {
  items: Item[];
  known: Record<string, KnownItem>;
  onAdd: (name: string) => AddResult | null;
  onToggle: (id: string) => void;
  onNotice: (msg: string) => void;
};

type Suggestion =
  | { type: 'onList'; item: Item }
  | { type: 'known'; known: KnownItem }
  | { type: 'new'; name: string };

const MAX_SUGGESTIONS = 6;

export function AddItemBar({ items, known, onAdd, onToggle, onNotice }: Props) {
  const [text, setText] = useState('');
  const query = text.trim().toLowerCase();

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!query) return [];
    const key = itemKey(query);
    const score = (name: string) => {
      const n = name.toLowerCase();
      if (itemKey(n) === key) return 0;
      if (n.startsWith(query)) return 1;
      if (n.split(' ').some((w) => w.startsWith(query))) return 2;
      return n.includes(query) ? 3 : 99;
    };

    const onList = items
      .map((item) => ({ item, s: score(item.name) }))
      .filter((x) => x.s < 99)
      .sort((a, b) => a.s - b.s)
      .map((x): Suggestion => ({ type: 'onList', item: x.item }));

    const listKeys = new Set(items.map((i) => itemKey(i.name)));
    const past = Object.entries(known)
      .filter(([k]) => !listKeys.has(k))
      .map(([, k]) => ({ k, s: score(k.name) }))
      .filter((x) => x.s < 99)
      .sort((a, b) => a.s - b.s || b.k.lastUsed - a.k.lastUsed)
      .map((x): Suggestion => ({ type: 'known', known: x.k }));

    const exact = listKeys.has(key) || past.some((p) => p.type === 'known' && itemKey(p.known.name) === key);
    const result = [...onList, ...past].slice(0, MAX_SUGGESTIONS);
    if (!exact) result.push({ type: 'new', name: text.trim() });
    return result;
  }, [query, items, known, text]);

  const report = (res: AddResult | null) => {
    if (!res) return;
    if (res.kind === 'exists') {
      onNotice(
        res.wasChecked
          ? `"${res.item.name}" was already on your list — moved it back to unchecked.`
          : `"${res.item.name}" is already on your list.`,
      );
    }
    setText('');
  };

  const pick = (s: Suggestion) => {
    if (s.type === 'onList') {
      if (s.item.checked) onToggle(s.item.id);
      onNotice(
        s.item.checked
          ? `"${s.item.name}" was already on your list — moved it back to unchecked.`
          : `"${s.item.name}" is already on your list.`,
      );
      setText('');
    } else {
      report(onAdd(s.type === 'known' ? s.known.name : s.name));
    }
  };

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add an item…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => report(onAdd(text))}
          autoCapitalize="sentences"
          autoCorrect
        />
        <Pressable
          style={({ pressed }) => [styles.addBtn, (!query || pressed) && { opacity: 0.6 }]}
          disabled={!query}
          onPress={() => report(onAdd(text))}
        >
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((s) => {
            const key = s.type === 'onList' ? s.item.id : s.type === 'known' ? `k-${s.known.name}` : 'new';
            return (
              <Pressable
                key={key}
                onPress={() => pick(s)}
                style={({ pressed }) => [styles.sugg, pressed && { backgroundColor: colors.bg }]}
              >
                {s.type === 'onList' && (
                  <>
                    <Text style={styles.suggName}>{s.item.name}</Text>
                    <Text style={[styles.badge, s.item.checked ? styles.badgeChecked : styles.badgeOnList]}>
                      {s.item.checked ? 'checked off · tap to re-add' : 'already on list'}
                    </Text>
                  </>
                )}
                {s.type === 'known' && (
                  <>
                    <Text style={styles.suggName}>{s.known.name}</Text>
                    <Text style={styles.suggMeta}>{s.known.section ?? 'previous item'}</Text>
                  </>
                )}
                {s.type === 'new' && (
                  <Text style={[styles.suggName, { color: colors.primary }]}>+ Add “{s.name}”</Text>
                )}
              </Pressable>
            );
          })}
          <Pressable onPress={() => { setText(''); Keyboard.dismiss(); }} style={styles.dismiss}>
            <Text style={styles.suggMeta}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  dropdown: {
    marginTop: 6,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sugg: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  suggName: { fontSize: 16, color: colors.text, flexShrink: 1 },
  suggMeta: { fontSize: 13, color: colors.muted },
  badge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  badgeOnList: { backgroundColor: colors.warnSoft, color: colors.warn },
  badgeChecked: { backgroundColor: colors.primarySoft, color: colors.primary },
  dismiss: { alignItems: 'center', paddingVertical: 8 },
});
