import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  DocumentReference,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { auth, db } from './firebase';
import { ListMeta, ListTemplate, TEMPLATES, cleanText } from './types';

/*
 * Firestore layout:
 *   households/{hid}                          { code, members[uid], createdAt, migratedV2 }
 *   households/{hid}/lists/{listId}           { name, icon, sectionLabel, sections[], order, createdAt }
 *   households/{hid}/lists/{listId}/items/{key}  { name, section, qty, checked, createdAt }
 *   households/{hid}/lists/{listId}/known/{key}  { name, section, lastUsed }
 *   invites/{code}                            { householdId }
 *
 * v1 (single grocery list) stored items at households/{hid}/items and aisles on the
 * household doc; those are copied into lists/groceries once, and left in place.
 */

const HOUSEHOLD_KEY = 'grocery-app/household'; // unchanged from v1 so phones keep their household
const LISTS_CACHE_KEY = 'ourlists/cache/lists';

const DEFAULT_LIST_IDS = ['groceries', 'hardware', 'clothing', 'bulk'];

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

const newListId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function listFields(t: ListTemplate, order: number) {
  return {
    name: t.name,
    icon: t.icon,
    sectionLabel: t.sectionLabel,
    sections: t.sections,
    order,
    createdAt: Date.now(),
  };
}

async function createHousehold(uid: string) {
  let code = randomCode();
  for (let i = 0; i < 5 && (await getDoc(doc(db, 'invites', code))).exists(); i++) code = randomCode();
  const hRef = doc(collection(db, 'households'));
  const b = writeBatch(db);
  b.set(hRef, { code, members: [uid], createdAt: Date.now(), migratedV2: true });
  b.set(doc(db, 'invites', code), { householdId: hRef.id });
  await b.commit();

  const b2 = writeBatch(db);
  TEMPLATES.forEach((t, i) => b2.set(doc(hRef, 'lists', DEFAULT_LIST_IDS[i]), listFields(t, i)));
  await b2.commit();
  return hRef.id;
}

/** Moves a v1 household (one grocery list) to the multi-list layout. Safe to run twice. */
async function migrateV1(hRef: DocumentReference, aisles: string[] | undefined) {
  const [items, known] = await Promise.all([getDocs(collection(hRef, 'items')), getDocs(collection(hRef, 'known'))]);
  const b = writeBatch(db);
  TEMPLATES.forEach((t, i) => {
    const tpl = i === 0 && aisles?.length ? { ...t, sections: aisles } : t;
    b.set(doc(hRef, 'lists', DEFAULT_LIST_IDS[i]), listFields(tpl, i));
  });
  const groceries = doc(hRef, 'lists', 'groceries');
  items.docs.slice(0, 250).forEach((d) => {
    const { aisle, ...rest } = d.data();
    b.set(doc(groceries, 'items', d.id), { ...rest, section: aisle ?? null });
  });
  known.docs.slice(0, 240).forEach((d) => {
    const { aisle, ...rest } = d.data();
    b.set(doc(groceries, 'known', d.id), { ...rest, section: aisle ?? null });
  });
  b.update(hRef, { migratedV2: true });
  await b.commit();
}

type HouseholdContext = {
  ready: boolean;
  hid: string | null;
  lists: ListMeta[];
  inviteCode: string | null;
  memberCount: number;
  syncError: string | null;
  /** Fire-and-forget Firestore write; errors show in the sync banner. */
  run: (fn: () => Promise<unknown>) => void;
  listRef: (listId: string) => DocumentReference;
  createList: (t: ListTemplate) => string | null;
  updateList: (listId: string, patch: Partial<Omit<ListMeta, 'id'>>) => void;
  deleteList: (listId: string) => Promise<void>;
  moveList: (listId: string, delta: -1 | 1) => void;
  joinHousehold: (code: string) => Promise<string | null>;
};

const Ctx = createContext<HouseholdContext | null>(null);

export function useHousehold() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHousehold must be used inside <HouseholdProvider>');
  return ctx;
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [hid, setHid] = useState<string | null>(null);
  const [lists, setLists] = useState<ListMeta[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(1);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [hasLists, setHasLists] = useState(false);

  const listsRef = useRef(lists);
  useLayoutEffect(() => {
    listsRef.current = lists;
  }, [lists]);
  const migrating = useRef(false);

  const fail = useCallback((e: unknown) => setSyncError(e instanceof Error ? e.message : String(e)), []);

  const run = useCallback(
    (fn: () => Promise<unknown>) => {
      try {
        fn().catch(fail);
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  // Last-synced lists for instant / offline start.
  useEffect(() => {
    (async () => {
      try {
        const [[, cache], [, stored]] = await AsyncStorage.multiGet([LISTS_CACHE_KEY, HOUSEHOLD_KEY]);
        if (cache && stored) {
          const parsed = JSON.parse(cache);
          if (parsed.hid === stored) {
            setLists(parsed.lists ?? []);
            setInviteCode(parsed.inviteCode ?? null);
            setMemberCount(parsed.memberCount ?? 1);
            setHasLists((parsed.lists ?? []).length > 0);
          }
        }
      } catch {
        // ignore corrupt cache
      } finally {
        setCacheChecked(true);
      }
    })();
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (user) setUid(user.uid);
        else signInAnonymously(auth).catch(fail);
      }),
    [fail],
  );

  useEffect(() => {
    if (!uid || hid) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(HOUSEHOLD_KEY);
        const id = stored ?? (await createHousehold(uid));
        if (!stored) await AsyncStorage.setItem(HOUSEHOLD_KEY, id);
        if (!cancelled) setHid(id);
      } catch (e) {
        fail(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, hid, fail]);

  useEffect(() => {
    if (!uid || !hid) return;
    const hRef = doc(db, 'households', hid);
    const onErr = async (e: { code?: string; message: string }) => {
      if (e.code === 'permission-denied') {
        // No longer a member (e.g. app data reset) — start a fresh household.
        await AsyncStorage.removeItem(HOUSEHOLD_KEY);
        setHid(null);
      } else fail(e);
    };
    const unsubs = [
      onSnapshot(
        hRef,
        (snap) => {
          const d = snap.data();
          if (!d) return;
          setSyncError(null);
          setInviteCode(d.code ?? null);
          setMemberCount(Array.isArray(d.members) ? d.members.length : 1);
          if (!d.migratedV2 && !migrating.current) {
            migrating.current = true;
            migrateV1(hRef, d.aisles)
              .catch(fail)
              .finally(() => (migrating.current = false));
          }
        },
        onErr,
      ),
      onSnapshot(
        collection(hRef, 'lists'),
        (snap) => {
          const next = snap.docs
            .map((d) => ({ ...(d.data() as Omit<ListMeta, 'id'>), id: d.id }))
            .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
          setLists(next);
          setHasLists(true);
        },
        fail, // never reset the household over a lists error (e.g. outdated security rules)
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, hid, fail]);

  useEffect(() => {
    if (!hid || !hasLists) return;
    AsyncStorage.setItem(LISTS_CACHE_KEY, JSON.stringify({ hid, lists, inviteCode, memberCount })).catch(() => {});
  }, [hid, lists, inviteCode, memberCount, hasLists]);

  const listRef = useCallback(
    (listId: string) => {
      if (!hid) throw new Error('Still connecting — try again in a moment.');
      return doc(db, 'households', hid, 'lists', listId);
    },
    [hid],
  );

  const createList = useCallback(
    (t: ListTemplate): string | null => {
      const name = cleanText(t.name);
      if (!name || !hid) return null;
      const id = newListId();
      const order = Math.max(-1, ...listsRef.current.map((l) => l.order)) + 1;
      run(async () => {
        const b = writeBatch(db);
        b.set(listRef(id), listFields({ ...t, name }, order));
        await b.commit();
      });
      return id;
    },
    [hid, listRef, run],
  );

  const updateList = useCallback(
    (listId: string, patch: Partial<Omit<ListMeta, 'id'>>) => run(() => updateDoc(listRef(listId), patch)),
    [listRef, run],
  );

  const deleteList = useCallback(
    async (listId: string) => {
      const ref = listRef(listId);
      // Firestore doesn't delete sub-collections automatically.
      const [items, known] = await Promise.all([getDocs(collection(ref, 'items')), getDocs(collection(ref, 'known'))]);
      const docs = [...items.docs, ...known.docs];
      for (let i = 0; i < docs.length; i += 450) {
        const b = writeBatch(db);
        docs.slice(i, i + 450).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
      const b = writeBatch(db);
      b.delete(ref);
      await b.commit();
    },
    [listRef],
  );

  const moveList = useCallback(
    (listId: string, delta: -1 | 1) => {
      const ordered = [...listsRef.current];
      const idx = ordered.findIndex((l) => l.id === listId);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= ordered.length) return;
      [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
      run(async () => {
        const b = writeBatch(db);
        ordered.forEach((l, i) => l.order !== i && b.update(listRef(l.id), { order: i }));
        await b.commit();
      });
    },
    [listRef, run],
  );

  const joinHousehold = useCallback(
    async (rawCode: string): Promise<string | null> => {
      const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!uid) return 'Still connecting — try again in a moment.';
      if (code.length !== 6) return 'Invite codes are 6 letters/numbers.';
      if (code === inviteCode) return "That's the code for the lists you're already on.";
      try {
        const invite = await getDoc(doc(db, 'invites', code));
        const target = invite.data()?.householdId as string | undefined;
        if (!target) return 'No lists found with that code.';
        await updateDoc(doc(db, 'households', target), { members: arrayUnion(uid) });
        await AsyncStorage.setItem(HOUSEHOLD_KEY, target);
        await AsyncStorage.removeItem(LISTS_CACHE_KEY);
        setLists([]);
        setHasLists(false);
        setHid(target);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [uid, inviteCode],
  );

  const value = useMemo<HouseholdContext>(
    () => ({
      ready: cacheChecked && (hasLists || !!syncError),
      hid,
      lists,
      inviteCode,
      memberCount,
      syncError,
      run,
      listRef,
      createList,
      updateList,
      deleteList,
      moveList,
      joinHousehold,
    }),
    [cacheChecked, hasLists, syncError, hid, lists, inviteCode, memberCount, run, listRef, createList, updateList, deleteList, moveList, joinHousehold],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
