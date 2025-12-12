<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { data as gigsList } from "../../../gigs-list.data";
import type { Gig } from "../../types";
import { useGitHubAuth } from "../composables/useGitHubAuth";
import { usePullRequest } from "../composables/usePullRequest";
import { useDraftGigs } from "../composables/useDraftGigs";
import type { DraftGig } from "../composables/useDraftGigs";
import GitHubAuthSection from "./GitHubAuthSection.vue";
import GigForm from "./GigForm.vue";
import DraftGigList from "./DraftGigList.vue";
import VerifyGigList from "./VerifyGigList.vue";
import PrStatusIndicator from "./PrStatusIndicator.vue";

type Mode = "add" | "verify";
const mode = ref<Mode>("add");

const {
    githubUsername,
    isAuthenticated,
    verifierId,
    canVerify,
    initAuth,
    getStoredToken,
} = useGitHubAuth();

const {
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
} = useDraftGigs();

const { prStatus, prNumber, prUrl, prError, createPR, resetPRStatus } =
    usePullRequest(getStoredToken);

const verifyListRef = ref<InstanceType<typeof VerifyGigList> | null>(null);

const unverifiedGigs = computed(() =>
    gigsList.filter((gig) => !gig.verified_by),
);

const canSubmitAdd = computed(
    () => isAuthenticated.value && draftGigs.value.length > 0,
);

const editingGig = computed(() =>
    editingGigId.value
        ? draftGigs.value.find((g) => g.id === editingGigId.value) || null
        : null,
);

function handleGigSubmit(gig: Omit<DraftGig, "id">) {
    if (editingGigId.value) {
        updateGig(editingGigId.value, gig);
        cancelEditing();
    } else {
        addGig(gig);
    }
    setLastPollie(gig.pollie_slug);
}

function handleGigEdit(gig: DraftGig) {
    startEditing(gig.id);
}

function handleGigDelete(id: string) {
    deleteGig(id);
}

async function submitAddPR() {
    if (!canSubmitAdd.value) return;

    await createPR({
        branchPrefix: "gig-contribution",
        title: `Add ${draftGigs.value.length} gig(s)`,
        body: draftGigs.value
            .map(
                (g) =>
                    `- ${g.role} at ${g.organisation} (${g.pollie_slug})\n  Sources: ${g.sources.join(", ")}`,
            )
            .join("\n"),
        updateFile: generateFileUpdate,
        onMerged: () => clearDrafts(),
    });
}

function addVerifiedByToGigByMatching(
    content: string,
    gig: Gig,
    verifier: string,
): string {
    const roleStr = JSON.stringify(gig.role);
    const orgStr = JSON.stringify(gig.organisation);
    const pollieStr = JSON.stringify(gig.pollie_slug);

    const lines = content.split("\n");
    let inTargetGig = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (
            line.includes(`role: ${roleStr}`) ||
            line.includes(`role:${roleStr}`)
        ) {
            let checkStart = Math.max(0, i - 2);
            let checkEnd = Math.min(lines.length - 1, i + 15);
            let slice = lines.slice(checkStart, checkEnd + 1).join("\n");

            if (
                slice.includes(`organisation: ${orgStr}`) &&
                slice.includes(`pollie_slug: ${pollieStr}`)
            ) {
                inTargetGig = true;
                braceDepth = 1;
            }
        }

        if (inTargetGig) {
            if (line.includes("{")) braceDepth++;
            if (line.includes("}")) braceDepth--;

            if (line.includes("sources:")) {
                let insertIndex = i + 1;
                while (
                    insertIndex < lines.length &&
                    !lines[insertIndex].includes("],")
                ) {
                    insertIndex++;
                }
                if (insertIndex < lines.length) {
                    const indent =
                        lines[insertIndex].match(/^(\s*)/)?.[1] || "    ";
                    const verifiedByLine = `${indent}verified_by: ${JSON.stringify(verifier)},`;
                    lines.splice(insertIndex + 1, 0, verifiedByLine);
                    return lines.join("\n");
                }
            }

            if (braceDepth === 0) {
                inTargetGig = false;
            }
        }
    }

    return content;
}

async function handleVerifySubmit(indices: number[], verifier: string) {
    const gigsToVerify = gigsList.filter((g) => indices.includes(g.index));
    const pollieNames = [...new Set(gigsToVerify.map((g) => g.pollie_slug))];

    await createPR({
        branchPrefix: "gig-verification",
        title: `Verify ${gigsToVerify.length} gig(s) for ${pollieNames.slice(0, 3).join(", ")}${pollieNames.length > 3 ? ` and ${pollieNames.length - 3} more` : ""}`,
        body:
            `Verified by: ${verifier}\n\n` +
            gigsToVerify
                .map(
                    (g) =>
                        `- ${g.role} at ${g.organisation} (${g.pollie_slug})`,
                )
                .join("\n"),
        updateFile: (content) => {
            let result = content;
            for (const gig of gigsToVerify) {
                result = addVerifiedByToGigByMatching(result, gig, verifier);
            }
            return result;
        },
        onMerged: () => verifyListRef.value?.clearSelection(),
    });
}

onMounted(async () => {
    loadDrafts();
    await initAuth();
});
</script>

<template>
    <div class="gig-entry-form">
        <GitHubAuthSection />

        <div class="mode-tabs">
            <button
                type="button"
                :class="['tab', { active: mode === 'add' }]"
                @click="mode = 'add'"
            >
                Add new gigs
                <span v-if="draftGigs.length > 0" class="tab-badge">{{
                    draftGigs.length
                }}</span>
            </button>
            <button
                type="button"
                :class="['tab', { active: mode === 'verify' }]"
                @click="mode = 'verify'"
            >
                Verify existing
                <span class="tab-badge">{{ unverifiedGigs.length }}</span>
            </button>
        </div>

        <template v-if="mode === 'add'">
            <GigForm
                :editing-gig="editingGig"
                :last-pollie-slug="getLastPollie()"
                @submit="handleGigSubmit"
                @cancel="cancelEditing"
            />

            <DraftGigList
                :drafts="draftGigs"
                @edit="handleGigEdit"
                @delete="handleGigDelete"
            />

            <section v-if="draftGigs.length > 0" class="submit-section">
                <h2>Submit</h2>
                <div v-if="prStatus === 'idle'">
                    <p v-if="!isAuthenticated" class="warning-text">
                        Connect to GitHub above to submit your gigs.
                    </p>
                    <button
                        type="button"
                        class="btn-primary btn-large"
                        :disabled="!canSubmitAdd"
                        @click="submitAddPR"
                    >
                        Create pull request with {{ draftGigs.length }} gig(s)
                    </button>
                </div>
                <PrStatusIndicator
                    v-else
                    :status="prStatus"
                    :pr-number="prNumber"
                    :pr-url="prUrl"
                    :pr-error="prError"
                    action-label="Add more gigs"
                    @reset="resetPRStatus"
                />
            </section>
        </template>

        <template v-else-if="mode === 'verify'">
            <section class="verify-wrapper">
                <h2>Verify existing gigs</h2>

                <div v-if="!isAuthenticated" class="warning-box">
                    Connect to GitHub above to verify gigs.
                </div>
                <div v-else-if="!canVerify" class="warning-box">
                    Your GitHub account (@{{ githubUsername }}) is not
                    authorised to verify gigs. Contact the project maintainers
                    if you should have access.
                </div>

                <template v-else>
                    <VerifyGigList
                        ref="verifyListRef"
                        :verifier-id="verifierId!"
                        @submit="handleVerifySubmit"
                    >
                        <template #submit="{ count, onSubmit }">
                            <div v-if="prStatus === 'idle'">
                                <button
                                    type="button"
                                    class="btn-primary btn-large"
                                    @click="onSubmit"
                                >
                                    Verify {{ count }} gig(s) as
                                    {{ verifierId }}
                                </button>
                            </div>
                            <PrStatusIndicator
                                v-else
                                :status="prStatus"
                                :pr-number="prNumber"
                                :pr-url="prUrl"
                                :pr-error="prError"
                                action-label="Verify more gigs"
                                @reset="resetPRStatus"
                            />
                        </template>
                    </VerifyGigList>
                </template>
            </section>
        </template>
    </div>
</template>

<style scoped>
.gig-entry-form {
    max-width: 700px;
    margin: 0 auto;
}

.mode-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 1rem;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--vp-c-border);
}

.tab {
    flex: 1;
    padding: 0.75rem 1rem;
    background: var(--vp-c-bg);
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--vp-c-text-2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition:
        background 0.2s,
        color 0.2s;
}

.tab:not(:last-child) {
    border-right: 1px solid var(--vp-c-border);
}

.tab:hover {
    background: var(--vp-c-bg-soft);
}

.tab.active {
    background: var(--vp-c-brand-soft);
    color: var(--vp-c-brand-1);
    font-weight: 500;
}

.tab-badge {
    background: var(--vp-c-bg-soft);
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
}

.tab.active .tab-badge {
    background: var(--vp-c-brand-1);
    color: var(--vp-c-white);
}

.submit-section,
.verify-wrapper {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--vp-c-bg-soft);
    border-radius: 8px;
}

h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
}

.warning-text {
    color: var(--vp-c-yellow-1);
    font-size: 0.875rem;
    margin: 0.25rem 0 1rem;
}

.warning-box {
    background: var(--vp-c-yellow-soft);
    color: var(--vp-c-yellow-1);
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
}

.btn-primary {
    padding: 0.5rem 1rem;
    background: var(--vp-c-brand-1);
    color: var(--vp-c-white);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
}

.btn-primary:hover:not(:disabled) {
    background: var(--vp-c-brand-2);
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary.btn-large {
    padding: 0.75rem 1.5rem;
    font-size: 1.1rem;
}
</style>
