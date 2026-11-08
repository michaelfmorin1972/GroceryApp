import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import { Item } from '../types';

type Props = {
  item: Item | null;
  sections: string[];
  sectionLabel: string;
  onClose: () => void;
  onSave: (patch: Partial<Item>) => void;
  onDelete: () => void;
  onAddSection: (name: string) => string | null;
};

/** Parent remounts this per item (via `key`), so initial state is enough. */
export function ItemEditor({ item, sections, sectionLabel, onClose, onSave, onDelete, onAddSection }: Props) {
  const [name, setName] = useState(item?.name ?? '');
  const [qty, setQty] = useState(item?.qty ?? 1);
  const [section, setSection] = useState<string | null>(item?.section ?? null);
  const [newSection, setNewSection] = useState('');

  const save = () => {
    onSave({ name: name.trim() || item?.name, qty, section });
    onClose();
  };

  const createSection = () => {
    const created = onAddSection(newSection);
    if (created) {
      setSection(created);
      setNewSection('');
    }
  };

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Item</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />

          <Text style={styles.label}>Quantity</Text>
          <View style={styles.qtyRow}>
            <Pressable style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qtyVal}>{qty}</Text>
            <Pressable style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>{sectionLabel}</Text>
          <View style={styles.chips}>
            {[null, ...sections].map((s) => (
              <Pressable
                key={s ?? '__none'}
                onPress={() => setSection(s)}
                style={[styles.chip, section === s && styles.chipOn]}
              >
                <Text style={[styles.chipText, section === s && styles.chipTextOn]}>{s ?? 'None'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.newRow}>
            <TextInput
              value={newSection}
              onChangeText={setNewSection}
              placeholder={`New ${sectionLabel.toLowerCase()}`}
              placeholderTextColor={colors.muted}
              style={[styles.input, { flex: 1 }]}
              onSubmitEditing={createSection}
            />
            <Pressable style={styles.smallBtn} onPress={createSection}>
              <Text style={styles.smallBtnText}>Add</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={() => { onDelete(); onClose(); }} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
          <Pressable onPress={save} style={styles.saveBtn}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 22, color: colors.text },
  qtyVal: { fontSize: 18, fontWeight: '600', color: colors.text, minWidth: 24, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  newRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  smallBtn: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  smallBtnText: { color: colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  deleteBtn: { paddingVertical: 12, paddingHorizontal: 18 },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
