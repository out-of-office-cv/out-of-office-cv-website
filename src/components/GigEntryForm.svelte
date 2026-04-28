<script lang="ts">
  import type { Gig, GigCategory } from "../types"
  import { GIG_CATEGORIES } from "../types"
  import GitHubAuthSection from "./GitHubAuthSection.svelte"
  import GigForm from "./GigForm.svelte"
  import DraftGigList from "./DraftGigList.svelte"
  import VerifyGigList from "./VerifyGigList.svelte"
  import PrStatusIndicator from "./PrStatusIndicator.svelte"
  import { createDraftGigs, type DraftGig } from "../stores/draft-gigs.svelte"
  import { createGitHubAuth } from "../stores/github-auth.svelte"
  import { createPullRequest, type PrStatus } from "../stores/pull-request.svelte"

  interface PollieOption {
    slug: string
    name: string
  }

  interface GigWithIndex extends Gig {
    index: number
  }

  interface Props {
    pollies: PollieOption[]
    gigs: GigWithIndex[]
  }

  let { pollies, gigs }: Props = $props()

  let mode = $state<"add" | "verify">("add")

  const auth = createGitHubAuth()
  const drafts = createDraftGigs()
  const pr = createPullRequest(() => auth.getStoredToken())

  let unverifiedGigs = $derived(
    gigs.filter((g) => g.verification?.decision !== "verified"),
  )

  let canSubmitAdd = $derived(auth.isAuthenticated && drafts.gigs.length > 0)

  let editingGig = $derived(
    drafts.editingGigId
      ? drafts.gigs.find((g) => g.id === drafts.editingGigId) || null
      : null,
  )

  function handleGigSubmit(gig: Omit<DraftGig, "id">) {
    if (drafts.editingGigId) {
      drafts.updateGig(drafts.editingGigId, gig)
      drafts.cancelEditing()
    } else {
      drafts.addGig(gig)
    }
    drafts.setLastPollie(gig.pollie_slug)
  }

  function handleGigEdit(gig: DraftGig) {
    drafts.startEditing(gig.id)
  }

  function handleGigDelete(id: string) {
    drafts.deleteGig(id)
  }

  async function submitAddPR() {
    if (!canSubmitAdd) return

    await pr.createPR({
      branchPrefix: "gig-contribution",
      title: `Add ${drafts.gigs.length} ${drafts.gigs.length === 1 ? "gig" : "gigs"}`,
      body: drafts.gigs
        .map(
          (g) =>
            `- ${g.role} at ${g.organisation} (${g.pollie_slug})\n  Sources: ${g.sources.join(", ")}`,
        )
        .join("\n"),
      updateFile: (content: string) => drafts.generateFileUpdate(content),
      onMerged: () => drafts.clearDrafts(),
    })
  }

  function applyVerificationToGigs(
    content: string,
    indicesToVerify: number[],
    verifier: string,
    edits: Record<number, Partial<Gig>>,
  ): string {
    const allGigs: Gig[] = JSON.parse(content)
    for (const index of indicesToVerify) {
      if (allGigs[index]) {
        allGigs[index].verification = { decision: "verified", by: verifier }
        if (edits[index]) {
          Object.assign(allGigs[index], edits[index])
        }
      }
    }
    return JSON.stringify(allGigs, null, 2) + "\n"
  }

  let verifyListRef: { clearSelection: () => void } | undefined = $state()

  async function handleVerifySubmit(
    indices: number[],
    verifier: string,
    edits: Record<number, Partial<Gig>>,
  ) {
    const gigsToVerify = gigs.filter((g) => indices.includes(g.index))
    const editedIndices = Object.keys(edits)
      .map(Number)
      .filter((i) => indices.includes(i))
    const pollieNames = [...new Set(gigsToVerify.map((g) => g.pollie_slug))]

    await pr.createPR({
      branchPrefix: "gig-verification",
      title: `Verify ${gigsToVerify.length} ${gigsToVerify.length === 1 ? "gig" : "gigs"} for ${pollieNames.slice(0, 3).join(", ")}${pollieNames.length > 3 ? ` and ${pollieNames.length - 3} more` : ""}`,
      body:
        `Verified by: ${verifier}\n\n` +
        gigsToVerify
          .map(
            (g) =>
              `- ${g.role} at ${g.organisation} (${g.pollie_slug})${editedIndices.includes(g.index) ? " (edited)" : ""}`,
          )
          .join("\n"),
      updateFile: (content: string) =>
        applyVerificationToGigs(content, indices, verifier, edits),
      onMerged: () => verifyListRef?.clearSelection(),
    })
  }

  $effect(() => {
    drafts.loadDrafts()
    auth.initAuth()
  })
</script>

<div class="gig-entry-form">
  <GitHubAuthSection {auth} />

  {#if drafts.storageError}
    <div class="notice notice-warn" role="alert">{drafts.storageError}</div>
  {/if}

  <div class="mode-tabs" role="tablist">
    <button
      type="button"
      role="tab"
      aria-selected={mode === "add"}
      class="tab"
      class:active={mode === "add"}
      onclick={() => (mode = "add")}
    >
      Add new gigs
      {#if drafts.gigs.length > 0}
        <span class="tab-count">{drafts.gigs.length}</span>
      {/if}
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={mode === "verify"}
      class="tab"
      class:active={mode === "verify"}
      onclick={() => (mode = "verify")}
    >
      Verify existing
      <span class="tab-count">{unverifiedGigs.length}</span>
    </button>
  </div>

  {#if mode === "add"}
    <GigForm
      {editingGig}
      lastPollieSlug={drafts.getLastPollie()}
      {pollies}
      onsubmit={handleGigSubmit}
      oncancel={() => drafts.cancelEditing()}
    />

    <DraftGigList
      drafts={drafts.gigs}
      onedit={handleGigEdit}
      ondelete={handleGigDelete}
    />

    {#if drafts.gigs.length > 0}
      <section class="submit-section">
        <h2>Submit your drafts</h2>
        {#if pr.status === "idle"}
          {#if !auth.isAuthenticated}
            <p class="notice-text">Connect to GitHub above to submit your gigs.</p>
          {/if}
          <button
            type="button"
            class="btn-primary btn-large"
            disabled={!canSubmitAdd}
            onclick={submitAddPR}
          >
            Open pull request with {drafts.gigs.length}
            {drafts.gigs.length === 1 ? "gig" : "gigs"}
          </button>
        {:else}
          <PrStatusIndicator
            status={pr.status}
            prNumber={pr.number}
            prUrl={pr.url}
            prError={pr.error}
            actionLabel="Add more gigs"
            onreset={() => pr.resetStatus()}
          />
        {/if}
      </section>
    {/if}
  {:else if mode === "verify"}
    <section class="verify-wrapper">
      <h2>Verify existing gigs</h2>

      {#if !auth.isAuthenticated}
        <p class="notice notice-warn">Connect to GitHub above to verify gigs.</p>
      {:else if !auth.canVerify}
        <p class="notice notice-warn">
          Your GitHub account (@{auth.username}) is not authorised to verify
          gigs. Contact the project maintainers if you should have access.
        </p>
      {:else}
        <VerifyGigList
          bind:this={verifyListRef}
          verifierId={auth.verifierId!}
          unverifiedGigs={unverifiedGigs}
          {pollies}
          onsubmit={handleVerifySubmit}
        >
          {#snippet submitSlot({ count, onSubmit })}
            {#if pr.status === "idle"}
              <button type="button" class="btn-primary btn-large" onclick={onSubmit}>
                Verify {count} {count === 1 ? "gig" : "gigs"} as {auth.verifierId}
              </button>
            {:else}
              <PrStatusIndicator
                status={pr.status}
                prNumber={pr.number}
                prUrl={pr.url}
                prError={pr.error}
                actionLabel="Verify more gigs"
                onreset={() => pr.resetStatus()}
              />
            {/if}
          {/snippet}
        </VerifyGigList>
      {/if}
    </section>
  {/if}
</div>

<style>
  .gig-entry-form {
    max-width: 46rem;
  }

  /* Tabs: text-based, bottom-border active state — no pills, no cards */
  .mode-tabs {
    display: flex;
    gap: var(--space-xl);
    margin: var(--space-xl) 0 var(--space-lg);
    border-bottom: 1px solid var(--color-rule);
  }

  .tab {
    background: transparent;
    border: none;
    padding: var(--space-sm) 0;
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-3);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    transition:
      color var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }

  .tab:hover {
    color: var(--color-ink);
  }

  .tab.active {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }

  .tab-count {
    font-family: var(--font-serif-stack);
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: var(--color-ink-3);
    font-variant-numeric: lining-nums tabular-nums;
  }

  .tab.active .tab-count {
    color: var(--color-accent);
  }

  /* Sections — typographic, not boxed */
  .submit-section,
  .verify-wrapper {
    margin-top: var(--space-2xl);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-rule);
  }

  h2 {
    margin: 0 0 var(--space-md);
  }

  .notice {
    font-family: var(--font-serif-stack);
    padding: var(--space-sm) var(--space-md);
    margin-bottom: var(--space-md);
    font-size: var(--text-small);
    border-radius: var(--radius-sm);
    max-width: var(--measure-reading);
  }

  .notice-warn {
    background: var(--color-warn-soft);
    color: oklch(32% 0.08 75);
    border: 1px solid oklch(82% 0.08 75);
  }

  .notice-text {
    font-family: var(--font-serif-stack);
    font-style: italic;
    color: var(--color-ink-2);
    margin-bottom: var(--space-sm);
  }
</style>
