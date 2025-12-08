<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { Octokit } from "@octokit/rest";
import { data as polliesList } from "../../../pollies-list.data";
import type { Gig, GigCategory } from "../../types";

const REPO_OWNER = "benswift";
const REPO_NAME = "out-of-office";
const STORAGE_KEY_TOKEN = "ooo-github-token";
const STORAGE_KEY_DRAFTS = "ooo-draft-gigs";
const STORAGE_KEY_LAST_POLLIE = "ooo-last-pollie-slug";

const categories: GigCategory[] = [
    "Natural Resources (Mining, Oil & Gas)",
    "Energy (Renewables & Traditional)",
    "Agriculture, Forestry & Fisheries",
    "Environment, Climate & Sustainability",
    "Health, Medical & Aged Care",
    "Pharmaceutical & Biotechnology",
    "Education, Academia & Research",
    "Government, Public Administration & Civil Service",
    "Diplomacy & International Relations",
    "Politics, Campaigning & Party Operations",
    "Defence & Military and Security",
    "Nonprofit, NGO and Charity",
    "Legal & Judicial",
    "Professional Services & Management Consulting",
    "Financial Services and Banking",
    "Technology (Software, IT & Digital Services)",
    "Telecommunications & Network Infrastructure",
    "Media, Communications & Public Relations",
    "Gambling, Gaming and Racing",
    "Retail, Hospitality & Tourism",
    "Arts, Culture & Sport",
    "Science, Engineering & Technical Professions",
    "Retired",
];

interface DraftGig extends Gig {
    id: string;
}

const githubToken = ref("");
const githubUsername = ref("");
const isValidatingToken = ref(false);
const tokenError = ref("");

const draftGigs = ref<DraftGig[]>([]);
const editingGigId = ref<string | null>(null);

const role = ref("");
const organisation = ref("");
const category = ref<GigCategory | "">("");
const source = ref("");
const verifiedBy = ref("");
const pollieSlug = ref("");
const startDate = ref("");
const endDate = ref("");

const pollieSearch = ref("");
const showPollieResults = ref(false);

const prStatus = ref<"idle" | "creating" | "created" | "merged" | "error">(
    "idle",
);
const prNumber = ref<number | null>(null);
const prUrl = ref("");
const prError = ref("");
let pollInterval: ReturnType<typeof setInterval> | null = null;

const formErrors = ref<Record<string, string>>({});

const filteredPollies = computed(() => {
    const query = pollieSearch.value.toLowerCase().trim();
    if (!query) return polliesList.slice(0, 10);
    return polliesList
        .filter(
            (p) =>
                p.name.toLowerCase().includes(query) || p.slug.includes(query),
        )
        .slice(0, 10);
});

const pollieWarning = computed(() => {
    if (!pollieSlug.value) return "";
    const exists = polliesList.some((p) => p.slug === pollieSlug.value);
    return exists ? "" : "This slug doesn't match any known politician";
});

const isAuthenticated = computed(() => !!githubUsername.value);

const canSubmit = computed(
    () => isAuthenticated.value && draftGigs.value.length > 0,
);

function validateForm(): boolean {
    formErrors.value = {};

    if (!role.value.trim()) formErrors.value.role = "Role is required";
    if (!organisation.value.trim())
        formErrors.value.organisation = "Organisation is required";
    if (!category.value) formErrors.value.category = "Category is required";
    if (!source.value.trim()) {
        formErrors.value.source = "Source URL is required";
    } else {
        try {
            new URL(source.value);
        } catch {
            formErrors.value.source = "Must be a valid URL";
        }
    }
    if (verifiedBy.value.trim()) {
        try {
            new URL(verifiedBy.value);
        } catch {
            formErrors.value.verifiedBy = "Must be a valid URL";
        }
    }
    if (!pollieSlug.value.trim())
        formErrors.value.pollieSlug = "Pollie slug is required";
    if (!startDate.value) {
        formErrors.value.startDate = "Start date is required";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.value)) {
        formErrors.value.startDate = "Must be YYYY-MM-DD format";
    }
    if (endDate.value && !/^\d{4}-\d{2}-\d{2}$/.test(endDate.value)) {
        formErrors.value.endDate = "Must be YYYY-MM-DD format";
    }

    return Object.keys(formErrors.value).length === 0;
}

function addOrUpdateGig() {
    if (!validateForm()) return;

    const gig: DraftGig = {
        id: editingGigId.value || crypto.randomUUID(),
        role: role.value.trim(),
        organisation: organisation.value.trim(),
        category: category.value as GigCategory,
        source: source.value.trim(),
        pollie_slug: pollieSlug.value.trim(),
        start_date: startDate.value,
    };

    if (verifiedBy.value.trim()) gig.verified_by = verifiedBy.value.trim();
    if (endDate.value) gig.end_date = endDate.value;

    if (editingGigId.value) {
        const index = draftGigs.value.findIndex(
            (g) => g.id === editingGigId.value,
        );
        if (index !== -1) draftGigs.value[index] = gig;
        editingGigId.value = null;
    } else {
        draftGigs.value.push(gig);
    }

    localStorage.setItem(STORAGE_KEY_LAST_POLLIE, pollieSlug.value);
    saveDrafts();
    clearForm();
}

function editGig(gig: DraftGig) {
    editingGigId.value = gig.id;
    role.value = gig.role;
    organisation.value = gig.organisation;
    category.value = gig.category;
    source.value = gig.source;
    verifiedBy.value = gig.verified_by || "";
    pollieSlug.value = gig.pollie_slug;
    pollieSearch.value =
        polliesList.find((p) => p.slug === gig.pollie_slug)?.name ||
        gig.pollie_slug;
    startDate.value = gig.start_date;
    endDate.value = gig.end_date || "";
}

function deleteGig(id: string) {
    draftGigs.value = draftGigs.value.filter((g) => g.id !== id);
    saveDrafts();
    if (editingGigId.value === id) {
        editingGigId.value = null;
        clearForm();
    }
}

function clearForm() {
    role.value = "";
    organisation.value = "";
    category.value = "";
    source.value = "";
    verifiedBy.value = "";
    startDate.value = "";
    endDate.value = "";
    formErrors.value = {};
}

function cancelEdit() {
    editingGigId.value = null;
    clearForm();
}

function saveDrafts() {
    localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(draftGigs.value));
}

function loadDrafts() {
    const saved = localStorage.getItem(STORAGE_KEY_DRAFTS);
    if (saved) {
        try {
            draftGigs.value = JSON.parse(saved);
        } catch {
            draftGigs.value = [];
        }
    }
}

function selectPollie(slug: string, name: string) {
    pollieSlug.value = slug;
    pollieSearch.value = name;
    showPollieResults.value = false;
}

function onPollieInputFocus() {
    showPollieResults.value = true;
}

function onPollieInputBlur() {
    setTimeout(() => {
        showPollieResults.value = false;
    }, 200);
}

async function validateToken(token: string): Promise<string | null> {
    if (!token) return null;
    isValidatingToken.value = true;
    tokenError.value = "";
    try {
        const octokit = new Octokit({ auth: token });
        const { data } = await octokit.users.getAuthenticated();
        return data.login;
    } catch {
        tokenError.value = "Invalid token or token expired";
        return null;
    } finally {
        isValidatingToken.value = false;
    }
}

async function saveToken() {
    const username = await validateToken(githubToken.value);
    if (username) {
        localStorage.setItem(STORAGE_KEY_TOKEN, githubToken.value);
        githubUsername.value = username;
    }
}

function disconnectGitHub() {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    githubToken.value = "";
    githubUsername.value = "";
}

function formatGigForTs(gig: DraftGig): string {
    const lines = [
        "  {",
        `    role: ${JSON.stringify(gig.role)},`,
        `    organisation: ${JSON.stringify(gig.organisation)},`,
        `    category: ${JSON.stringify(gig.category)},`,
        `    source: ${JSON.stringify(gig.source)},`,
    ];
    if (gig.verified_by) {
        lines.push(`    verified_by: ${JSON.stringify(gig.verified_by)},`);
    }
    lines.push(`    pollie_slug: ${JSON.stringify(gig.pollie_slug)},`);
    lines.push(`    start_date: ${JSON.stringify(gig.start_date)},`);
    if (gig.end_date) {
        lines.push(`    end_date: ${JSON.stringify(gig.end_date)},`);
    }
    lines.push("  },");
    return lines.join("\n");
}

async function submitPR() {
    if (!canSubmit.value) return;

    prStatus.value = "creating";
    prError.value = "";

    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!token) {
        prError.value = "No GitHub token found";
        prStatus.value = "error";
        return;
    }

    const octokit = new Octokit({ auth: token });

    try {
        const { data: mainRef } = await octokit.git.getRef({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            ref: "heads/main",
        });
        const mainSha = mainRef.object.sha;

        const { data: fileData } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: "data/gigs.ts",
            ref: "main",
        });

        if (!("content" in fileData)) {
            throw new Error("Could not read gigs.ts");
        }

        const currentContent = atob(fileData.content);
        const insertIndex = currentContent.lastIndexOf("];");
        if (insertIndex === -1) {
            throw new Error("Could not find insertion point in gigs.ts");
        }

        const newGigsCode = draftGigs.value.map(formatGigForTs).join("\n");
        const newContent =
            currentContent.slice(0, insertIndex) +
            newGigsCode +
            "\n" +
            currentContent.slice(insertIndex);

        const branchName = `gig-contribution-${Date.now()}`;
        await octokit.git.createRef({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            ref: `refs/heads/${branchName}`,
            sha: mainSha,
        });

        await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: "data/gigs.ts",
            message: `Add ${draftGigs.value.length} gig(s)`,
            content: btoa(newContent),
            branch: branchName,
            sha: fileData.sha,
        });

        const pollieNames = [
            ...new Set(draftGigs.value.map((g) => g.pollie_slug)),
        ];
        const prTitle = `Add ${draftGigs.value.length} gig(s) for ${pollieNames.join(", ")}`;
        const prBody = draftGigs.value
            .map(
                (g) =>
                    `- ${g.role} at ${g.organisation} (${g.pollie_slug})\n  Source: ${g.source}`,
            )
            .join("\n");

        const { data: pr } = await octokit.pulls.create({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            title: prTitle,
            body: prBody,
            head: branchName,
            base: "main",
        });

        prNumber.value = pr.number;
        prUrl.value = pr.html_url;
        prStatus.value = "created";

        startPollingPRStatus(pr.number);
    } catch (err) {
        prError.value =
            err instanceof Error ? err.message : "Failed to create PR";
        prStatus.value = "error";
    }
}

function startPollingPRStatus(prNum: number) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        const token = localStorage.getItem(STORAGE_KEY_TOKEN);
        if (!token) return;

        const octokit = new Octokit({ auth: token });
        try {
            const { data: pr } = await octokit.pulls.get({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                pull_number: prNum,
            });

            if (pr.merged) {
                prStatus.value = "merged";
                draftGigs.value = [];
                saveDrafts();
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
            } else if (pr.state === "closed") {
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
            }
        } catch {
            // Keep polling on error
        }
    }, 5000);
}

function resetPRStatus() {
    prStatus.value = "idle";
    prNumber.value = null;
    prUrl.value = "";
    prError.value = "";
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

onMounted(async () => {
    loadDrafts();

    const lastPollie = localStorage.getItem(STORAGE_KEY_LAST_POLLIE);
    if (lastPollie) {
        pollieSlug.value = lastPollie;
        const pollie = polliesList.find((p) => p.slug === lastPollie);
        if (pollie) pollieSearch.value = pollie.name;
    }

    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (savedToken) {
        githubToken.value = savedToken;
        const username = await validateToken(savedToken);
        if (username) {
            githubUsername.value = username;
        } else {
            localStorage.removeItem(STORAGE_KEY_TOKEN);
            githubToken.value = "";
        }
    }
});

watch(pollieSearch, (val) => {
    if (!val) pollieSlug.value = "";
});
</script>

<template>
    <div class="gig-entry-form">
        <section class="auth-section">
            <h2>GitHub connection</h2>
            <div v-if="isAuthenticated" class="auth-status connected">
                <span class="status-indicator"></span>
                Connected as <strong>@{{ githubUsername }}</strong>
                <button
                    type="button"
                    class="btn-link"
                    @click="disconnectGitHub"
                >
                    Disconnect
                </button>
            </div>
            <div v-else class="auth-setup">
                <p>
                    To submit gigs, you need a GitHub Personal Access Token
                    (PAT). This is a one-time setup that takes about a minute.
                </p>
                <h3>How to create a token</h3>
                <ol class="setup-steps">
                    <li>
                        <a
                            href="https://github.com/settings/tokens/new?scopes=repo&description=Out%20of%20Office%20CV"
                            target="_blank"
                            rel="noopener"
                        >
                            Open GitHub's token creation page →
                        </a>
                        (you may need to log in)
                    </li>
                    <li>
                        The form should be pre-filled. If not, add a note like
                        "Out of Office CV" and tick the
                        <code>repo</code> checkbox under scopes.
                    </li>
                    <li>
                        Scroll down and click <strong>Generate token</strong>
                    </li>
                    <li>
                        Copy the token (starts with <code>ghp_</code>) and paste
                        it below
                    </li>
                </ol>
                <p class="hint">
                    Your token is stored only in this browser's localStorage and
                    sent directly to GitHub.
                </p>
                <div class="token-input-row">
                    <input
                        v-model="githubToken"
                        type="password"
                        placeholder="Paste your token here"
                        class="token-input"
                        :disabled="isValidatingToken"
                    />
                    <button
                        type="button"
                        class="btn-primary"
                        :disabled="!githubToken || isValidatingToken"
                        @click="saveToken"
                    >
                        {{ isValidatingToken ? "Validating..." : "Connect" }}
                    </button>
                </div>
                <p v-if="tokenError" class="error-text">{{ tokenError }}</p>
            </div>
        </section>

        <section class="form-section">
            <h2>{{ editingGigId ? "Edit gig" : "Add a new gig" }}</h2>
            <form @submit.prevent="addOrUpdateGig">
                <div class="form-row">
                    <div class="form-group">
                        <label for="pollie-search">Politician</label>
                        <div class="autocomplete-wrapper">
                            <input
                                id="pollie-search"
                                v-model="pollieSearch"
                                type="text"
                                placeholder="Search by name..."
                                autocomplete="off"
                                @focus="onPollieInputFocus"
                                @blur="onPollieInputBlur"
                            />
                            <ul
                                v-if="
                                    showPollieResults &&
                                    filteredPollies.length > 0
                                "
                                class="autocomplete-results"
                            >
                                <li
                                    v-for="pollie of filteredPollies"
                                    :key="pollie.slug"
                                    @mousedown="
                                        selectPollie(pollie.slug, pollie.name)
                                    "
                                >
                                    {{ pollie.name }}
                                </li>
                            </ul>
                        </div>
                        <input type="hidden" v-model="pollieSlug" />
                        <p v-if="pollieWarning" class="warning-text">
                            {{ pollieWarning }}
                        </p>
                        <p v-if="formErrors.pollieSlug" class="error-text">
                            {{ formErrors.pollieSlug }}
                        </p>
                    </div>
                </div>

                <div class="form-row two-col">
                    <div class="form-group">
                        <label for="role"
                            >Role <span class="required">*</span></label
                        >
                        <input
                            id="role"
                            v-model="role"
                            type="text"
                            placeholder="e.g. Non-Executive Director"
                        />
                        <p v-if="formErrors.role" class="error-text">
                            {{ formErrors.role }}
                        </p>
                    </div>
                    <div class="form-group">
                        <label for="organisation"
                            >Organisation <span class="required">*</span></label
                        >
                        <input
                            id="organisation"
                            v-model="organisation"
                            type="text"
                            placeholder="e.g. Acme Corp"
                        />
                        <p v-if="formErrors.organisation" class="error-text">
                            {{ formErrors.organisation }}
                        </p>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="category"
                            >Category <span class="required">*</span></label
                        >
                        <select id="category" v-model="category">
                            <option value="">Select a category...</option>
                            <option
                                v-for="cat of categories"
                                :key="cat"
                                :value="cat"
                            >
                                {{ cat }}
                            </option>
                        </select>
                        <p v-if="formErrors.category" class="error-text">
                            {{ formErrors.category }}
                        </p>
                    </div>
                </div>

                <div class="form-row two-col">
                    <div class="form-group">
                        <label for="start-date"
                            >Start date <span class="required">*</span></label
                        >
                        <input
                            id="start-date"
                            v-model="startDate"
                            type="date"
                        />
                        <p v-if="formErrors.startDate" class="error-text">
                            {{ formErrors.startDate }}
                        </p>
                    </div>
                    <div class="form-group">
                        <label for="end-date">End date</label>
                        <input id="end-date" v-model="endDate" type="date" />
                        <p v-if="formErrors.endDate" class="error-text">
                            {{ formErrors.endDate }}
                        </p>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="source"
                            >Source URL <span class="required">*</span></label
                        >
                        <input
                            id="source"
                            v-model="source"
                            type="url"
                            placeholder="https://..."
                        />
                        <p v-if="formErrors.source" class="error-text">
                            {{ formErrors.source }}
                        </p>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="verified-by">Verified by URL</label>
                        <input
                            id="verified-by"
                            v-model="verifiedBy"
                            type="url"
                            placeholder="https://..."
                        />
                        <p v-if="formErrors.verifiedBy" class="error-text">
                            {{ formErrors.verifiedBy }}
                        </p>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn-primary">
                        {{ editingGigId ? "Update gig" : "Add to draft" }}
                    </button>
                    <button
                        v-if="editingGigId"
                        type="button"
                        class="btn-secondary"
                        @click="cancelEdit"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </section>

        <section v-if="draftGigs.length > 0" class="drafts-section">
            <h2>Draft gigs ({{ draftGigs.length }})</h2>
            <ul class="draft-list">
                <li v-for="gig of draftGigs" :key="gig.id" class="draft-item">
                    <div class="draft-content">
                        <strong>{{ gig.role }}</strong> at
                        {{ gig.organisation }}
                        <span class="draft-meta"
                            >{{ gig.pollie_slug }} · {{ gig.category }}</span
                        >
                    </div>
                    <div class="draft-actions">
                        <button
                            type="button"
                            class="btn-icon"
                            title="Edit"
                            @click="editGig(gig)"
                        >
                            ✎
                        </button>
                        <button
                            type="button"
                            class="btn-icon btn-danger"
                            title="Delete"
                            @click="deleteGig(gig.id)"
                        >
                            ×
                        </button>
                    </div>
                </li>
            </ul>
        </section>

        <section v-if="draftGigs.length > 0" class="submit-section">
            <h2>Submit</h2>
            <div v-if="prStatus === 'idle'">
                <p v-if="!isAuthenticated" class="warning-text">
                    Connect to GitHub above to submit your gigs.
                </p>
                <button
                    type="button"
                    class="btn-primary btn-large"
                    :disabled="!canSubmit"
                    @click="submitPR"
                >
                    Create pull request with {{ draftGigs.length }} gig(s)
                </button>
            </div>
            <div v-else-if="prStatus === 'creating'" class="pr-status">
                <span class="spinner"></span> Creating pull request...
            </div>
            <div v-else-if="prStatus === 'created'" class="pr-status">
                <p>
                    <a :href="prUrl" target="_blank" rel="noopener"
                        >PR #{{ prNumber }}</a
                    >
                    created! Waiting for merge...
                </p>
                <span class="spinner"></span>
            </div>
            <div v-else-if="prStatus === 'merged'" class="pr-status success">
                <p>
                    <a :href="prUrl" target="_blank" rel="noopener"
                        >PR #{{ prNumber }}</a
                    >
                    merged!
                </p>
                <button
                    type="button"
                    class="btn-secondary"
                    @click="resetPRStatus"
                >
                    Add more gigs
                </button>
            </div>
            <div v-else-if="prStatus === 'error'" class="pr-status error">
                <p class="error-text">{{ prError }}</p>
                <button
                    type="button"
                    class="btn-secondary"
                    @click="resetPRStatus"
                >
                    Try again
                </button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.gig-entry-form {
    max-width: 700px;
    margin: 0 auto;
}

section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--vp-c-bg-soft);
    border-radius: 8px;
}

h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
}

h3 {
    margin: 1rem 0 0.5rem;
    font-size: 1rem;
}

.setup-steps {
    margin: 0.5rem 0 1rem;
    padding-left: 1.25rem;
}

.setup-steps li {
    margin-bottom: 0.5rem;
    line-height: 1.5;
}

.hint {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
    margin-top: 1rem;
}

.auth-status.connected {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vp-c-green-1);
}

.btn-link {
    background: none;
    border: none;
    color: var(--vp-c-brand-1);
    cursor: pointer;
    padding: 0;
    margin-left: 1rem;
}

.btn-link:hover {
    text-decoration: underline;
}

.token-input-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.token-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
}

.form-row {
    margin-bottom: 1rem;
}

.form-row.two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

@media (max-width: 600px) {
    .form-row.two-col {
        grid-template-columns: 1fr;
    }
}

.form-group {
    display: flex;
    flex-direction: column;
}

.form-group label {
    font-weight: 500;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
}

.required {
    color: var(--vp-c-red-1);
}

.form-group input,
.form-group select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
}

.autocomplete-wrapper {
    position: relative;
}

.autocomplete-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--vp-c-bg);
    border: 1px solid var(--vp-c-border);
    border-top: none;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
}

.autocomplete-results li {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
}

.autocomplete-results li:hover {
    background: var(--vp-c-bg-soft);
}

.error-text {
    color: var(--vp-c-red-1);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
}

.warning-text {
    color: var(--vp-c-yellow-1);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
}

.form-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
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

.btn-secondary {
    padding: 0.5rem 1rem;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
}

.btn-secondary:hover {
    background: var(--vp-c-bg-soft);
}

.draft-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.draft-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.75rem;
    background: var(--vp-c-bg);
    border-radius: 4px;
    margin-bottom: 0.5rem;
}

.draft-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.draft-meta {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
}

.draft-actions {
    display: flex;
    gap: 0.25rem;
}

.btn-icon {
    width: 28px;
    height: 28px;
    padding: 0;
    background: none;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    color: var(--vp-c-text-2);
}

.btn-icon:hover {
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
}

.btn-icon.btn-danger:hover {
    color: var(--vp-c-red-1);
    border-color: var(--vp-c-red-1);
}

.pr-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.pr-status.success {
    color: var(--vp-c-green-1);
}

.pr-status.error {
    flex-direction: column;
    align-items: flex-start;
}

.spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--vp-c-border);
    border-top-color: var(--vp-c-brand-1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

code {
    background: var(--vp-c-bg);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.9em;
}
</style>
