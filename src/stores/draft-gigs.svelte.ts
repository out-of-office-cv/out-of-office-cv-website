import type { Gig } from "../types";

const STORAGE_KEY_DRAFTS = "ooo-draft-gigs";
const STORAGE_KEY_LAST_POLLIE = "ooo-last-pollie-slug";

const isBrowser = typeof window !== "undefined";

export interface DraftGig extends Gig {
  id: string;
}

export function createDraftGigs() {
  let gigs = $state<DraftGig[]>([]);
  let editingGigId = $state<string | null>(null);
  let storageError = $state("");

  function saveDrafts(): void {
    if (!isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(gigs));
      storageError = "";
    } catch {
      storageError =
        "Could not save drafts — browser storage is full or disabled.";
    }
  }

  function loadDrafts(): void {
    if (!isBrowser) return;
    const saved = localStorage.getItem(STORAGE_KEY_DRAFTS);
    if (saved) {
      try {
        gigs = JSON.parse(saved);
      } catch {
        gigs = [];
      }
    }
  }

  function addGig(gig: Omit<DraftGig, "id">): void {
    const newGig: DraftGig = {
      ...gig,
      id: crypto.randomUUID(),
    };
    gigs.push(newGig);
    saveDrafts();
  }

  function updateGig(id: string, gig: Omit<DraftGig, "id">): void {
    const index = gigs.findIndex((g) => g.id === id);
    if (index !== -1) {
      gigs[index] = { ...gig, id };
      saveDrafts();
    }
  }

  function deleteGig(id: string): void {
    gigs = gigs.filter((g) => g.id !== id);
    saveDrafts();
    if (editingGigId === id) {
      editingGigId = null;
    }
  }

  function clearDrafts(): void {
    gigs = [];
    saveDrafts();
  }

  function startEditing(id: string): void {
    editingGigId = id;
  }

  function cancelEditing(): void {
    editingGigId = null;
  }

  function getLastPollie(): string | null {
    if (!isBrowser) return null;
    return localStorage.getItem(STORAGE_KEY_LAST_POLLIE);
  }

  function setLastPollie(slug: string): void {
    if (!isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY_LAST_POLLIE, slug);
    } catch {
      // Non-critical: last-pollie hint can be lost without harming drafts.
    }
  }

  function generateFileUpdate(content: string): string {
    const existingGigs: Gig[] = JSON.parse(content);
    const newGigs: Gig[] = gigs.map(({ id: _id, ...gig }) => gig);
    const allGigs = [...existingGigs, ...newGigs];
    return JSON.stringify(allGigs, null, 2) + "\n";
  }

  return {
    get gigs() {
      return gigs;
    },
    get editingGigId() {
      return editingGigId;
    },
    get storageError() {
      return storageError;
    },
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
