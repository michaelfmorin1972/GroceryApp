import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  inviteCode: string | null;
  memberCount: number;
  onClose: () => void;
  onJoin: (code: string) => Promise<string | null>;
};

export function ShareSheet({ visible, inviteCode, memberCount, onClose, onJoin }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    const err = await onJoin(code);
    setBusy(false);
    if (err) setError(err);
    else {
      setCode('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Share list</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Your invite code</Text>
        <View style={styles.codeCard}>
          {inviteCode ? (
            <Text style={styles.code} selectable>
              {inviteCode}
            </Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
          <Text style={styles.meta}>
            {memberCount} {memberCount === 1 ? 'phone' : 'phones'} on this list
          </Text>
          {inviteCode && (
            <Pressable
              style={styles.shareBtn}
              onPress={() =>
                Share.share({ message: `Join my grocery list! Open the app, tap Share, and enter code ${inviteCode}` })
              }
            >
              <Text style={styles.shareText}>Send code…</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.label, { marginTop: 28 }]}>Join someone else’s list</Text>
        <Text style={styles.hint}>
          This phone will switch to their list. Your current list stays saved for anyone else on it.
        </Text>
        <View style={styles.joinRow}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            style={styles.input}
            onSubmitEditing={join}
          />
          <Pressable style={[styles.joinBtn, (busy || !code) && { opacity: 0.6 }]} disabled={busy || !code} onPress={join}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.shareText}>Join</Text>}
          </Pressable>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  done: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', marginBottom: 8 },
  codeCard: { backgroundColor: colors.card, borderRadius: 14, padding: 20, alignItems: 'center', gap: 8 },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 6, color: colors.text },
  meta: { color: colors.muted, fontSize: 14 },
  shareBtn: { marginTop: 6, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  shareText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  hint: { color: colors.muted, fontSize: 14, marginBottom: 10 },
  joinRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 20, letterSpacing: 4, color: colors.text,
  },
  joinBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  error: { color: colors.danger, marginTop: 10, fontSize: 14 },
});
