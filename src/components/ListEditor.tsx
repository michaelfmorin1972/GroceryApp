import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import { BLANK_TEMPLATE, ICON_CHOICES, ListMeta, ListTemplate, TEMPLATES } from '../types';

type Props = {
  /** `null` = closed, `'new'` = create a list, otherwise edit that list. */
  target: 'new' | ListMeta | null;
  existingNames: string[];
  onClose: () => void;
  onCreate: (t: ListTemplate) => void;
  onSave: (listId: string, patch: Partial<ListMeta>) => void;
  onDelete: (listId: string) => Promise<void>;
};

const LABELS = ['Aisle', 'Department', 'Category', 'Section', 'Room', 'Store'];

/** Parent remounts per target (via `key`), so initial state is enough. */
export function ListEditor({ target, existingNames, onClose, onCreate, onSave, onDelete }: Props) {
  const editing = target && target !== 'new' ? target : null;
  const [base, setBase] = useState<ListTemplate>(editing ?? BLANK_TEMPLATE);
  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? BLANK_TEMPLATE.icon);
  const [label, setLabel] = useState(editing?.sectionLabel ?? BLANK_TEMPLATE.sectionLabel);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const nameClash = !!name.trim() && taken.has(name.trim().toLowerCase()) && name.trim() !== editing?.name;

  const pickTemplate = (t: ListTemplate) => {
    setBase(t);
    setName(t.name);
    setIcon(t.icon);
    setLabel(t.sectionLabel);
  };

  const submit = () => {
    if (!name.trim() || nameClash) return;
    if (editing) onSave(editing.id, { name: name.trim(), icon, sectionLabel: label });
    else onCreate({ ...base, name, icon, sectionLabel: label });
    onClose();
  };

  return (
    <Modal visible={!!target} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{editing ? 'Edit list' : 'New list'}</Text>
          <Pressable onPress={submit} hitSlop={10} disabled={!name.trim() || nameClash}>
            <Text style={[styles.done, (!name.trim() || nameClash) && { opacity: 0.4 }]}>
              {editing ? 'Save' : 'Create'}
            </Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {!editing && (
            <>
              <Text style={styles.label}>Start from</Text>
              <View style={styles.chips}>
                {[...TEMPLATES, BLANK_TEMPLATE].map((t) => {
                  const on = base === t;
                  return (
                    <Pressable key={t.name || 'blank'} onPress={() => pickTemplate(t)} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {t.icon} {t.name || 'Blank'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {base.sections.length > 0 && (
                <Text style={styles.hint} numberOfLines={2}>
                  Includes: {base.sections.join(', ')}
                </Text>
              )}
            </>
          )}

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Pharmacy, Camping trip, Gifts"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus={!editing}
          />
          {nameClash && <Text style={styles.error}>You already have a list with that name.</Text>}

          <Text style={styles.label}>Icon</Text>
          <View style={styles.chips}>
            {ICON_CHOICES.map((i) => (
              <Pressable key={i} onPress={() => setIcon(i)} style={[styles.iconChip, icon === i && styles.chipOn]}>
                <Text style={styles.iconText}>{i}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Group items by</Text>
          <View style={styles.chips}>
            {LABELS.map((l) => (
              <Pressable key={l} onPress={() => setLabel(l)} style={[styles.chip, label === l && styles.chipOn]}>
                <Text style={[styles.chipText, label === l && styles.chipTextOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          {editing && (
            <View style={styles.deleteBox}>
              {!confirmDelete ? (
                <Pressable onPress={() => setConfirmDelete(true)}>
                  <Text style={styles.deleteText}>Delete this list…</Text>
                </Pressable>
              ) : (
                <>
                  <Text style={styles.deleteWarn}>
                    Delete “{editing.name}” and everything on it for everyone sharing it? This can’t be undone.
                  </Text>
                  <View style={styles.deleteRow}>
                    <Pressable onPress={() => setConfirmDelete(false)} style={styles.keepBtn}>
                      <Text style={styles.keepText}>Keep</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      disabled={deleting}
                      onPress={async () => {
                        setDeleting(true);
                        try {
                          await onDelete(editing.id);
                          onClose();
                        } finally {
                          setDeleting(false);
                        }
                      }}
                    >
                      {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  cancel: { fontSize: 17, color: colors.muted },
  done: { fontSize: 17, color: colors.primary, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 18, marginBottom: 8, textTransform: 'uppercase' },
  hint: { color: colors.muted, fontSize: 13, marginTop: 8 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 17, color: colors.text,
  },
  error: { color: colors.danger, marginTop: 6, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 15 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  iconChip: {
    width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  iconText: { fontSize: 22 },
  deleteBox: { marginTop: 36, marginBottom: 40 },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  deleteWarn: { color: colors.text, fontSize: 15, marginBottom: 12 },
  deleteRow: { flexDirection: 'row', gap: 12 },
  keepBtn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, backgroundColor: colors.card },
  keepText: { color: colors.text, fontWeight: '600' },
  deleteBtn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, backgroundColor: colors.danger, minWidth: 90, alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontWeight: '700' },
});
