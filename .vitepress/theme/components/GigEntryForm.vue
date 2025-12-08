<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { Octokit } from "@octokit/rest";
import { data as polliesList } from "../../../pollies-list.data";
import { data as gigsList } from "../../../gigs-list.data";
import type { Gig, GigCategory } from "../../types";

const REPO_OWNER = "out-of-office-cv";
const REPO_NAME = "out-of-office-cv-website";
const STORAGE_KEY_TOKEN = "ooo-github-token";
const STORAGE_KEY_DRAFTS = "ooo-draft-gigs";
const STORAGE_KEY_LAST_POLLIE = "ooo-last-pollie-slug";

const VERIFIER_MAP: Record<string, string> = {
    "out-of-office-cv": "khoi",
    benswift: "ben",
};

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

type Mode = "add" | "verify";
const mode = ref<Mode>("add");

const githubToken = ref("");
const githubUsername = ref("");
const isValidatingToken = ref(false);
const tokenError = ref("");

const draftGigs = ref<DraftGig[]>([]);
const editingGigId = ref<string | null>(null);

const role = ref("");
const organisation = ref("");
const category = ref<GigCategory | "">("");
const sources = ref<string[]>([""]);
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

const verifySearch = ref("");
const selectedVerifyIndices = ref<Set<number>>(new Set());
const expandedVerifyIndex = ref<number | null>(null);

const verifierId = computed(() => VERIFIER_MAP[githubUsername.value] || null);

const canVerify = computed(() => verifierId.value !== null);

const unverifiedGigs = computed(() =>
    gigsList.filter((gig) => !gig.verified_by),
);

const filteredUnverifiedGigs = computed(() => {
    const query = verifySearch.value.toLowerCase().trim();
    if (!query) return unverifiedGigs.value;
    return unverifiedGigs.value.filter(
        (gig) =>
            gig.role.toLowerCase().includes(query) ||
            gig.organisation.toLowerCase().includes(query) ||
            gig.pollie_slug.toLowerCase().includes(query) ||
            gig.category.toLowerCase().includes(query),
    );
});

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

const canSubmitAdd = computed(
    () => isAuthenticated.value && draftGigs.value.length > 0,
);

const canSubmitVerify = computed(
    () =>
        isAuthenticated.value &&
        canVerify.value &&
        selectedVerifyIndices.value.size > 0,
);

function getPollieNameBySlug(slug: string): string {
    const pollie = polliesList.find((p) => p.slug === slug);
    return pollie?.name || slug;
}

function getHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

function toggleVerifySelection(index: number) {
    if (selectedVerifyIndices.value.has(index)) {
        selectedVerifyIndices.value.delete(index);
    } else {
        selectedVerifyIndices.value.add(index);
    }
    selectedVerifyIndices.value = new Set(selectedVerifyIndices.value);
}

function selectAllVisible() {
    for (const gig of filteredUnverifiedGigs.value) {
        selectedVerifyIndices.value.add(gig.index);
    }
    selectedVerifyIndices.value = new Set(selectedVerifyIndices.value);
}

function clearVerifySelection() {
    selectedVerifyIndices.value = new Set();
}

function toggleExpandGig(index: number) {
    expandedVerifyIndex.value =
        expandedVerifyIndex.value === index ? null : index;
}

function validateForm(): boolean {
    formErrors.value = {};

    if (!role.value.trim()) formErrors.value.role = "Role is required";
    if (!organisation.value.trim())
        formErrors.value.organisation = "Organisation is required";
    if (!category.value) formErrors.value.category = "Category is required";
    const validSources = sources.value.filter((s) => s.trim());
    if (validSources.length === 0) {
        formErrors.value.sources = "At least one source URL is required";
    } else {
        for (const s of validSources) {
            try {
                new URL(s);
            } catch {
                formErrors.value.sources = "All sources must be valid URLs";
                break;
            }
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
    if (startDate.value && !/^\d{4}-\d{2}-\d{2}$/.test(startDate.value)) {
        formErrors.value.startDate = "Must be YYYY-MM-DD format";
    }
    if (endDate.value && !/^\d{4}-\d{2}-\d{2}$/.test(endDate.value)) {
        formErrors.value.endDate = "Must be YYYY-MM-DD format";
    }

    return Object.keys(formErrors.value).length === 0;
}

function addOrUpdateGig() {
    if (!validateForm()) return;

    const validSources = sources.value
        .filter((s) => s.trim())
        .map((s) => s.trim());

    const gig: DraftGig = {
        id: editingGigId.value || generateUUID(),
        role: role.value.trim(),
        organisation: organisation.value.trim(),
        category: category.value as GigCategory,
        sources: validSources,
        pollie_slug: pollieSlug.value.trim(),
    };

    if (startDate.value) gig.start_date = startDate.value;
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
    sources.value = gig.sources.length > 0 ? [...gig.sources] : [""];
    verifiedBy.value = gig.verified_by || "";
    pollieSlug.value = gig.pollie_slug;
    pollieSearch.value =
        polliesList.find((p) => p.slug === gig.pollie_slug)?.name ||
        gig.pollie_slug;
    startDate.value = gig.start_date || "";
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
    sources.value = [""];
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

function addVerifiedByToGig(
    content: string,
    gigIndex: number,
    verifier: string,
): string {
    const lines = content.split("\n");
    let currentGigIndex = -1;
    let braceDepth = 0;
    let inGigsArray = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes("export const gigs")) {
            inGigsArray = true;
            continue;
        }

        if (!inGigsArray) continue;

        if (line.trim() === "{") {
            if (braceDepth === 0) {
                currentGigIndex++;
            }
            braceDepth++;
        }

        if (line.trim().startsWith("}")) {
            braceDepth--;
        }

        if (currentGigIndex === gigIndex && braceDepth === 1) {
            if (
                (line.includes("sources:") &&
                    !content.includes(`verified_by:`)) ||
                (line.includes("sources:") &&
                    lines
                        .slice(0, i + 1)
                        .filter((l) => l.includes("verified_by:")).length <=
                        currentGigIndex)
            ) {
                const indent = line.match(/^(\s*)/)?.[1] || "    ";
                const verifiedByLine = `${indent}verified_by: ${JSON.stringify(verifier)},`;
                lines.splice(i + 1, 0, verifiedByLine);
                return lines.join("\n");
            }
        }
    }

    return content;
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

async function submitPR() {
    if (!canSubmitAdd.value) return;

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

async function submitVerifyPR() {
    if (!canSubmitVerify.value || !verifierId.value) return;

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

        let currentContent = atob(fileData.content);

        const gigsToVerify = gigsList.filter((g) =>
            selectedVerifyIndices.value.has(g.index),
        );

        for (const gig of gigsToVerify) {
            currentContent = addVerifiedByToGigByMatching(
                currentContent,
                gig,
                verifierId.value,
            );
        }

        const branchName = `gig-verification-${Date.now()}`;
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
            message: `Verify ${gigsToVerify.length} gig(s)`,
            content: btoa(currentContent),
            branch: branchName,
            sha: fileData.sha,
        });

        const pollieNames = [
            ...new Set(gigsToVerify.map((g) => g.pollie_slug)),
        ];
        const prTitle = `Verify ${gigsToVerify.length} gig(s) for ${pollieNames.slice(0, 3).join(", ")}${pollieNames.length > 3 ? ` and ${pollieNames.length - 3} more` : ""}`;
        const prBody =
            `Verified by: ${verifierId.value}\n\n` +
            gigsToVerify
                .map(
                    (g) =>
                        `- ${g.role} at ${g.organisation} (${g.pollie_slug})`,
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

        startPollingPRStatus(pr.number, true);
    } catch (err) {
        prError.value =
            err instanceof Error ? err.message : "Failed to create PR";
        prStatus.value = "error";
    }
}

function startPollingPRStatus(prNum: number, isVerify = false) {
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
                if (isVerify) {
                    selectedVerifyIndices.value = new Set();
                } else {
                    draftGigs.value = [];
                    saveDrafts();
                }
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
                <span v-if="verifierId" class="verifier-badge"
                    >Verifier: {{ verifierId }}</span
                >
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
                <h3>How to create a classic token</h3>
                <ol class="setup-steps">
                    <li>
                        <a
                            href="https://github.com/settings/tokens/new?scopes=public_repo&description=Out%20of%20Office%20CV"
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
                        <code>public_repo</code> checkbox under scopes (this is
                        the minimum permission needed).
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
                                            selectPollie(
                                                pollie.slug,
                                                pollie.name,
                                            )
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
                                >Organisation
                                <span class="required">*</span></label
                            >
                            <input
                                id="organisation"
                                v-model="organisation"
                                type="text"
                                placeholder="e.g. Acme Corp"
                            />
                            <p
                                v-if="formErrors.organisation"
                                class="error-text"
                            >
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
                            <label for="start-date">Start date</label>
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
                            <input
                                id="end-date"
                                v-model="endDate"
                                type="date"
                            />
                            <p v-if="formErrors.endDate" class="error-text">
                                {{ formErrors.endDate }}
                            </p>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label
                                >Source URLs
                                <span class="required">*</span></label
                            >
                            <div class="sources-list">
                                <div
                                    v-for="(_, index) in sources"
                                    :key="index"
                                    class="source-row"
                                >
                                    <input
                                        v-model="sources[index]"
                                        type="url"
                                        placeholder="https://..."
                                    />
                                    <button
                                        v-if="sources.length > 1"
                                        type="button"
                                        class="btn-icon btn-danger"
                                        title="Remove source"
                                        @click="sources.splice(index, 1)"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            <button
                                type="button"
                                class="btn-secondary btn-small"
                                @click="sources.push('')"
                            >
                                + Add another source
                            </button>
                            <p v-if="formErrors.sources" class="error-text">
                                {{ formErrors.sources }}
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
                    <li
                        v-for="gig of draftGigs"
                        :key="gig.id"
                        class="draft-item"
                    >
                        <div class="draft-content">
                            <strong>{{ gig.role }}</strong> at
                            {{ gig.organisation }}
                            <span class="draft-meta"
                                >{{ gig.pollie_slug }} ·
                                {{ gig.category }}</span
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
                        :disabled="!canSubmitAdd"
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
                <div
                    v-else-if="prStatus === 'merged'"
                    class="pr-status success"
                >
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
        </template>

        <template v-else-if="mode === 'verify'">
            <section class="verify-section">
                <h2>Verify existing gigs</h2>

                <div v-if="!isAuthenticated" class="warning-box">
                    Connect to GitHub above to verify gigs.
                </div>
                <div v-else-if="!canVerify" class="warning-box">
                    Your GitHub account (@{{ githubUsername }}) is not
                    authorised to verify gigs. Contact the project maintainers
                    if you should have access.
                </div>

                <div v-else>
                    <p class="verify-intro">
                        Select gigs you've verified are accurate, then submit a
                        PR to mark them as verified by
                        <strong>{{ verifierId }}</strong
                        >.
                    </p>

                    <div class="verify-controls">
                        <input
                            v-model="verifySearch"
                            type="text"
                            placeholder="Filter by role, organisation, politician..."
                            class="verify-search"
                        />
                        <div class="verify-bulk-actions">
                            <button
                                type="button"
                                class="btn-secondary btn-small"
                                @click="selectAllVisible"
                            >
                                Select all visible
                            </button>
                            <button
                                type="button"
                                class="btn-secondary btn-small"
                                @click="clearVerifySelection"
                                :disabled="selectedVerifyIndices.size === 0"
                            >
                                Clear selection
                            </button>
                        </div>
                    </div>

                    <div
                        v-if="filteredUnverifiedGigs.length === 0"
                        class="empty-state"
                    >
                        <p v-if="verifySearch">
                            No unverified gigs match your search.
                        </p>
                        <p v-else>All gigs have been verified!</p>
                    </div>

                    <ul v-else class="verify-list">
                        <li
                            v-for="gig of filteredUnverifiedGigs"
                            :key="gig.index"
                            :class="[
                                'verify-item',
                                {
                                    selected: selectedVerifyIndices.has(
                                        gig.index,
                                    ),
                                    expanded: expandedVerifyIndex === gig.index,
                                },
                            ]"
                        >
                            <div class="verify-item-header">
                                <label class="verify-checkbox-label">
                                    <input
                                        type="checkbox"
                                        :checked="
                                            selectedVerifyIndices.has(gig.index)
                                        "
                                        @change="
                                            toggleVerifySelection(gig.index)
                                        "
                                    />
                                    <span class="verify-item-summary">
                                        <strong>{{ gig.role }}</strong> at
                                        {{ gig.organisation }}
                                        <span class="verify-item-pollie">{{
                                            getPollieNameBySlug(gig.pollie_slug)
                                        }}</span>
                                    </span>
                                </label>
                                <button
                                    type="button"
                                    class="btn-icon btn-expand"
                                    :title="
                                        expandedVerifyIndex === gig.index
                                            ? 'Collapse'
                                            : 'Expand'
                                    "
                                    @click="toggleExpandGig(gig.index)"
                                >
                                    {{
                                        expandedVerifyIndex === gig.index
                                            ? "▲"
                                            : "▼"
                                    }}
                                </button>
                            </div>
                            <div
                                v-if="expandedVerifyIndex === gig.index"
                                class="verify-item-details"
                            >
                                <dl>
                                    <dt>Category</dt>
                                    <dd>{{ gig.category }}</dd>
                                    <dt>Dates</dt>
                                    <dd>
                                        {{
                                            gig.start_date
                                                ? gig.start_date
                                                : "unknown"
                                        }}
                                        {{
                                            gig.end_date
                                                ? `– ${gig.end_date}`
                                                : "– present"
                                        }}
                                    </dd>
                                    <dt>
                                        {{
                                            gig.sources.length === 1
                                                ? "Source"
                                                : "Sources"
                                        }}
                                    </dt>
                                    <dd>
                                        <template
                                            v-for="(src, i) in gig.sources"
                                            :key="i"
                                        >
                                            <a
                                                :href="src"
                                                target="_blank"
                                                rel="noopener"
                                                >{{ getHostname(src) }}</a
                                            ><span
                                                v-if="
                                                    i < gig.sources.length - 1
                                                "
                                                >,
                                            </span>
                                        </template>
                                    </dd>
                                </dl>
                            </div>
                        </li>
                    </ul>

                    <div
                        v-if="selectedVerifyIndices.size > 0"
                        class="verify-submit-section"
                    >
                        <div v-if="prStatus === 'idle'">
                            <button
                                type="button"
                                class="btn-primary btn-large"
                                @click="submitVerifyPR"
                            >
                                Verify {{ selectedVerifyIndices.size }} gig(s)
                                as {{ verifierId }}
                            </button>
                        </div>
                        <div
                            v-else-if="prStatus === 'creating'"
                            class="pr-status"
                        >
                            <span class="spinner"></span> Creating pull
                            request...
                        </div>
                        <div
                            v-else-if="prStatus === 'created'"
                            class="pr-status"
                        >
                            <p>
                                <a :href="prUrl" target="_blank" rel="noopener"
                                    >PR #{{ prNumber }}</a
                                >
                                created! Waiting for merge...
                            </p>
                            <span class="spinner"></span>
                        </div>
                        <div
                            v-else-if="prStatus === 'merged'"
                            class="pr-status success"
                        >
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
                                Verify more gigs
                            </button>
                        </div>
                        <div
                            v-else-if="prStatus === 'error'"
                            class="pr-status error"
                        >
                            <p class="error-text">{{ prError }}</p>
                            <button
                                type="button"
                                class="btn-secondary"
                                @click="resetPRStatus"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </template>
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
    flex-wrap: wrap;
}

.status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vp-c-green-1);
}

.verifier-badge {
    background: var(--vp-c-brand-soft);
    color: var(--vp-c-brand-1);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    margin-left: 0.5rem;
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

.sources-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.source-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.source-row input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 1rem;
}

.source-row input:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
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

.warning-box {
    background: var(--vp-c-yellow-soft);
    color: var(--vp-c-yellow-1);
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
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

.btn-secondary:hover:not(:disabled) {
    background: var(--vp-c-bg-soft);
}

.btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-secondary.btn-small {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
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

.btn-icon.btn-expand {
    font-size: 0.75rem;
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

.verify-section {
    margin-top: 0;
}

.verify-intro {
    margin-bottom: 1rem;
    color: var(--vp-c-text-2);
}

.verify-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.verify-search {
    flex: 1;
    min-width: 200px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 1rem;
}

.verify-search:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
}

.verify-bulk-actions {
    display: flex;
    gap: 0.5rem;
}

.empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--vp-c-text-2);
}

.verify-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 400px;
    overflow-y: auto;
}

.verify-item {
    background: var(--vp-c-bg);
    border-radius: 4px;
    margin-bottom: 0.5rem;
    border: 2px solid transparent;
    transition: border-color 0.2s;
}

.verify-item.selected {
    border-color: var(--vp-c-brand-1);
}

.verify-item-header {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    gap: 0.5rem;
}

.verify-checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
    cursor: pointer;
}

.verify-checkbox-label input[type="checkbox"] {
    margin-top: 0.25rem;
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.verify-item-summary {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.verify-item-pollie {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
}

.verify-item-details {
    padding: 0 0.75rem 0.75rem 2.75rem;
    border-top: 1px solid var(--vp-c-border);
    margin-top: 0.5rem;
    padding-top: 0.75rem;
}

.verify-item-details dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 1rem;
    font-size: 0.875rem;
}

.verify-item-details dt {
    color: var(--vp-c-text-2);
}

.verify-item-details dd {
    margin: 0;
}

.verify-item-details a {
    color: var(--vp-c-brand-1);
    word-break: break-all;
}

.verify-submit-section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--vp-c-border);
}
</style>
