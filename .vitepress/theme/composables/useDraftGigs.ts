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

  function formatGigForTs(gig: DraftGig): string {
    const sourcesStr =
      gig.sources.length === 1
        ? `[${JSON.stringify(gig.sources[0])}]`
        : `[\n      ${gig.sources.map((s) => JSON.stringify(s)).join(",\n      ")},\n    ]`;

    const lines = [
      "  {",
      `    role: ${JSON.stringify(gig.role)},`,
      `    organisation: ${JSON.stringify(gig.organisation)},`,
      `    category: ${JSON.stringify(gig.category)},`,
      `    sources: ${sourcesStr},`,
    ];
    if (gig.verified_by) {
      lines.push(`    verified_by: ${JSON.stringify(gig.verified_by)},`);
    }
    lines.push(`    pollie_slug: ${JSON.stringify(gig.pollie_slug)},`);
    if (gig.start_date) {
      lines.push(`    start_date: ${JSON.stringify(gig.start_date)},`);
    }
    if (gig.end_date) {
      lines.push(`    end_date: ${JSON.stringify(gig.end_date)},`);
    }
    lines.push("  },");
    return lines.join("\n");
  }

  function generateFileUpdate(content: string): string {
    const insertIndex = content.lastIndexOf("];");
    if (insertIndex === -1) {
      throw new Error("Could not find insertion point in gigs.ts");
    }
    const newGigsCode = draftGigs.value.map(formatGigForTs).join("\n");
    return (
      content.slice(0, insertIndex) +
      newGigsCode +
      "\n" +
      content.slice(insertIndex)
    );
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
