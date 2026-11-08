import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { Item } from '../types';

type Props = {
  item: Item;
  /** Shown under the name in flat-list view; omitted when grouped by section. */
  sectionText?: string;
  onToggle: () => void;
  onEdit: () => void;
};

export function ItemRow({ item, sectionText, onToggle, onEdit }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onToggle} hitSlop={10} style={[styles.box, item.checked && styles.boxOn]}>
        {item.checked && <Text style={styles.tick}>✓</Text>}
      </Pressable>
      <Pressable onPress={onEdit} style={styles.body}>
        <Text style={[styles.name, item.checked && styles.nameChecked]} numberOfLines={2}>
          {item.name}
          {item.qty > 1 && <Text style={styles.qty}>  ×{item.qty}</Text>}
        </Text>
        {sectionText !== undefined && <Text style={styles.section}>{sectionText}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 14,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary },
  tick: { color: '#fff', fontWeight: '800', fontSize: 15 },
  body: { flex: 1 },
  name: { fontSize: 17, color: colors.text },
  nameChecked: { color: colors.muted, textDecorationLine: 'line-through' },
  qty: { color: colors.muted, fontSize: 15 },
  section: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
