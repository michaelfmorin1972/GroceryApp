import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteDoc, doc, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { db } from './firebase';
import { useHousehold } from './household';
import { Item, KnownItem, ViewMode, cleanText, docId } from './types';

const cacheKey = (listId: string) => `ourlists/cache/list/${listId}`;
const viewKey = (listId: string) => `ourlists/view/${listId}`;

export type AddResult =
  | { kind: 'added'; item: Item }
  | { kind: 'exists'; item: Item; wasChecked: boolean };

/** Live items for one list, plus all the edits you can make to it. */
export function useListStore(listId: string) {
  const { hid, lists, run, listRef, updateList } = useHousehold();
  const meta = lists.find((l) => l.id === listId) ?? null;

  const [items, setItems] = useState<Item[]>([]);
  const [known, setKnown] = useState<Record<string, KnownItem>>({});
  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>('list');

  const ref = useRef({ items, known, sections: meta?.sections ?? [] });
  useLayoutEffect(() => {
    ref.current = { items, known, sections: meta?.sections ?? [] };
  }, [items, known, meta?.sections]);

  // Cached copy + view preference.
  useEffect(() => {
    (async () => {
      try {
        const [[, cache], [, view]] = await AsyncStorage.multiGet([cacheKey(listId), viewKey(listId)]);
        if (view === 'list' || view === 'sections') setViewModeState(view);
        if (cache) {
          const parsed = JSON.parse(cache);
          if (parsed.hid === hid) {
            setItems(parsed.items ?? []);
            setKnown(parsed.known ?? {});
            setLoaded(true);
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [listId, hid]);

  useEffect(() => {
    if (!hid) return;
    const lRef = doc(db, 'households', hid, 'lists', listId);
    const unsubs = [
      onSnapshot(
        collection(lRef, 'items'),
        (snap) => {
          setItems(snap.docs.map((d) => ({ ...(d.data() as Omit<Item, 'id'>), id: d.id })));
          setLoaded(true);
        },
        (e) => run(() => Promise.reject(e)),
      ),
      onSnapshot(
        collection(lRef, 'known'),
        (snap) => {
          const k: Record<string, KnownItem> = {};
          snap.docs.forEach((d) => (k[d.id] = d.data() as KnownItem));
          setKnown(k);
        },
        (e) => run(() => Promise.reject(e)),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [hid, listId, run]);

  useEffect(() => {
    if (!loaded || !hid) return;
    AsyncStorage.setItem(cacheKey(listId), JSON.stringify({ hid, items, known })).catch(() => {});
  }, [loaded, hid, listId, items, known]);

  const itemDoc = useCallback((id: string) => doc(listRef(listId), 'items', id), [listRef, listId]);
  const knownDoc = useCallback((id: string) => doc(listRef(listId), 'known', id), [listRef, listId]);

  const addItem = useCallback(
    (rawName: string): AddResult | null => {
      const name = cleanText(rawName);
      if (!name) return null;
      const id = docId(name);
      const existing = ref.current.items.find((i) => i.id === id);
      if (existing) {
        if (existing.checked) run(() => updateDoc(itemDoc(id), { checked: false }));
        return { kind: 'exists', item: existing, wasChecked: existing.checked };
      }
      const remembered = ref.current.known[id];
      const section =
        remembered?.section && ref.current.sections.includes(remembered.section) ? remembered.section : null;
      const item: Item = { id, name: remembered?.name ?? name, section, qty: 1, checked: false, createdAt: Date.now() };
      const { id: _id, ...fields } = item;
      run(async () => {
        const b = writeBatch(db);
        b.set(itemDoc(id), fields);
        b.set(knownDoc(id), { name: item.name, section: item.section, lastUsed: Date.now() });
        await b.commit();
      });
      return { kind: 'added', item };
    },
    [itemDoc, knownDoc, run],
  );

  /** Returns an error message if rejected (e.g. renamed onto an existing item). */
  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<Item, 'id'>>): string | null => {
      const current = ref.current.items.find((i) => i.id === id);
      if (!current) return null;
      const next = { ...current, ...patch, name: cleanText(patch.name ?? current.name) || current.name };
      const newId = docId(next.name);
      if (newId !== id && ref.current.items.some((i) => i.id === newId)) {
        return `"${next.name}" is already on this list.`;
      }
      const { id: _id, ...fields } = next;
      run(async () => {
        const b = writeBatch(db);
        if (newId !== id) b.delete(itemDoc(id));
        b.set(itemDoc(newId), fields);
        b.set(knownDoc(newId), { name: next.name, section: next.section, lastUsed: Date.now() });
        await b.commit();
      });
      return null;
    },
    [itemDoc, knownDoc, run],
  );

  const toggleItem = useCallback(
    (id: string) => {
      const it = ref.current.items.find((i) => i.id === id);
      if (it) run(() => updateDoc(itemDoc(id), { checked: !it.checked }));
    },
    [itemDoc, run],
  );

  const removeItem = useCallback((id: string) => run(() => deleteDoc(itemDoc(id))), [itemDoc, run]);

  const clearChecked = useCallback(() => {
    run(async () => {
      const b = writeBatch(db);
      ref.current.items.filter((i) => i.checked).forEach((i) => b.delete(itemDoc(i.id)));
      await b.commit();
    });
  }, [itemDoc, run]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      AsyncStorage.setItem(viewKey(listId), mode).catch(() => {});
    },
    [listId],
  );

  const saveSections = useCallback((sections: string[]) => updateList(listId, { sections }), [listId, updateList]);

  const addSection = useCallback(
    (raw: string): string | null => {
      const name = cleanText(raw);
      if (!name) return null;
      const existing = ref.current.sections.find((a) => a.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      saveSections([...ref.current.sections, name]);
      return name;
    },
    [saveSections],
  );

  const moveSection = useCallback(
    (section: string, delta: -1 | 1) => {
      const s = [...ref.current.sections];
      const idx = s.indexOf(section);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= s.length) return;
      [s[idx], s[target]] = [s[target], s[idx]];
      saveSections(s);
    },
    [saveSections],
  );

  /** Renames `from` to `to` (or removes it when `to` is null) on the list, its items, and memory. */
  const reassignSection = useCallback(
    (from: string, to: string | null) => {
      const { sections, items: its, known: kn } = ref.current;
      run(async () => {
        const b = writeBatch(db);
        b.update(listRef(listId), {
          sections: to === null ? sections.filter((a) => a !== from) : sections.map((a) => (a === from ? to : a)),
        });
        its.filter((i) => i.section === from).forEach((i) => b.update(itemDoc(i.id), { section: to }));
        Object.entries(kn)
          .filter(([, k]) => k.section === from)
          .forEach(([key]) => b.update(knownDoc(key), { section: to }));
        await b.commit();
      });
    },
    [itemDoc, knownDoc, listId, listRef, run],
  );

  const renameSection = useCallback(
    (from: string, rawTo: string) => {
      const to = cleanText(rawTo);
      if (!to || to === from) return;
      if (ref.current.sections.some((a) => a !== from && a.toLowerCase() === to.toLowerCase())) return;
      reassignSection(from, to);
    },
    [reassignSection],
  );

  const deleteSection = useCallback((s: string) => reassignSection(s, null), [reassignSection]);

  return {
    meta,
    items,
    known,
    loaded,
    viewMode,
    setViewMode,
    addItem,
    updateItem,
    toggleItem,
    removeItem,
    clearChecked,
    addSection,
    moveSection,
    renameSection,
    deleteSection,
  };
}

/** Lightweight live count of unchecked items, for the home screen. */
export function useRemainingCount(listId: string) {
  const { hid } = useHousehold();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!hid) return;
    return onSnapshot(
      collection(db, 'households', hid, 'lists', listId, 'items'),
      (snap) => setCount(snap.docs.filter((d) => !d.data().checked).length),
      () => {},
    );
  }, [hid, listId]);
  return count;
}
