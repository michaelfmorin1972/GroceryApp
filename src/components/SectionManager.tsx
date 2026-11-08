import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  label: string;
  sections: string[];
  onClose: () => void;
  onAdd: (name: string) => void;
  onMove: (section: string, delta: -1 | 1) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (section: string) => void;
};

/** Add, rename, delete and reorder a list's sections (e.g. to match a store's walking order). */
export function SectionManager({ visible, label, sections, onClose, onAdd, onMove, onRename, onDelete }: Props) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const commitRename = () => {
    if (editing) onRename(editing, editText);
    setEditing(null);
  };
  const add = () => {
    onAdd(newName);
    setNewName('');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{label}s</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Tap a name to rename it. Use the arrows to match the order you walk through the store — grouped view
          follows this order.
        </Text>

        <ScrollView keyboardShouldPersistTaps="handled">
          {sections.map((a, idx) => (
            <View key={a} style={styles.row}>
              {editing === a ? (
                <TextInput
                  value={editText}
                  onChangeText={setEditText}
                  autoFocus
                  onSubmitEditing={commitRename}
                  onBlur={commitRename}
                  style={[styles.input, { flex: 1 }]}
                />
              ) : (
                <Pressable style={{ flex: 1 }} onPress={() => { setEditing(a); setEditText(a); }}>
                  <Text style={styles.name}>{a}</Text>
                </Pressable>
              )}
              <Pressable disabled={idx === 0} onPress={() => onMove(a, -1)} style={styles.iconBtn} hitSlop={6}>
                <Text style={[styles.icon, idx === 0 && styles.disabled]}>▲</Text>
              </Pressable>
              <Pressable
                disabled={idx === sections.length - 1}
                onPress={() => onMove(a, 1)}
                style={styles.iconBtn}
                hitSlop={6}
              >
                <Text style={[styles.icon, idx === sections.length - 1 && styles.disabled]}>▼</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(a)} style={styles.iconBtn} hitSlop={6}>
                <Text style={[styles.icon, { color: colors.danger }]}>✕</Text>
              </Pressable>
            </View>
          ))}

          <View style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={`Add ${label.toLowerCase()}`}
              placeholderTextColor={colors.muted}
              style={[styles.input, { flex: 1 }]}
              onSubmitEditing={add}
            />
            <Pressable style={styles.addBtn} onPress={add}>
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  done: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  hint: { color: colors.muted, marginTop: 6, marginBottom: 14, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 6, gap: 4,
  },
  name: { fontSize: 16, color: colors.text, paddingVertical: 6 },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  icon: { fontSize: 16, color: colors.primary },
  disabled: { color: colors.border },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, color: colors.text,
  },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 40 },
  addBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addText: { color: '#fff', fontWeight: '600' },
});
