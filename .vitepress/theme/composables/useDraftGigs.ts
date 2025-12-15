import { ref } from "vue";
import type { Gig } from "../../types";

const STORAGE_KEY_DRAFTS = "ooo-draft-gigs";
const STORAGE_KEY_LAST_POLLIE = "ooo-last-pollie-slug";

const isBrowser = typeof window !== "undefined";

export interface DraftGig extends Gig {
  id: string;
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useDraftGigs() {
  const draftGigs = ref<DraftGig[]>([]);
  const editingGigId = ref<string | null>(null);

  function saveDrafts(): void {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(draftGigs.value));
  }

  function loadDrafts(): void {
    if (!isBrowser) return;
    const saved = localStorage.getItem(STORAGE_KEY_DRAFTS);
    if (saved) {
      try {
        draftGigs.value = JSON.parse(saved);
      } catch {
        draftGigs.value = [];
      }
    }
  }

  function addGig(gig: Omit<DraftGig, "id">): void {
    const newGig: DraftGig = {
      ...gig,
      id: generateUUID(),
    };
    draftGigs.value.push(newGig);
    saveDrafts();
  }

  function updateGig(id: string, gig: Omit<DraftGig, "id">): void {
    const index = draftGigs.value.findIndex((g) => g.id === id);
    if (index !== -1) {
      draftGigs.value[index] = { ...gig, id };
      saveDrafts();
    }
  }

  function deleteGig(id: string): void {
    draftGigs.value = draftGigs.value.filter((g) => g.id !== id);
    saveDrafts();
    if (editingGigId.value === id) {
      editingGigId.value = null;
    }
  }

  function clearDrafts(): void {
    draftGigs.value = [];
    saveDrafts();
  }

  function startEditing(id: string): void {
    editingGigId.value = id;
  }

  function cancelEditing(): void {
    editingGigId.value = null;
  }

  function getLastPollie(): string | null {
    if (!isBrowser) return null;
    return localStorage.getItem(STORAGE_KEY_LAST_POLLIE);
  }

  function setLastPollie(slug: string): void {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEY_LAST_POLLIE, slug);
  }

  function generateFileUpdate(content: string): string {
    const existingGigs: Gig[] = JSON.parse(content);
    const newGigs: Gig[] = draftGigs.value.map(({ id: _id, ...gig }) => gig);
    const allGigs = [...existingGigs, ...newGigs];
    return JSON.stringify(allGigs, null, 2) + "\n";
  }

  return {
    draftGigs,
    editingGigId,
    loadDrafts,
    addGig,
    updateGig,
    deleteGig,
    clearDrafts,
    startEditing,
    cancelEditing,
    getLastPollie,
    setLastPollie,
    generateFileUpdate,
  };
}
