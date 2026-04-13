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

  let unverifiedGigs = $derived(gigs.filter((g) => !g.verified_by))

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

  function addVerifiedByToGigs(
    content: string,
    indicesToVerify: number[],
    verifier: string,
    edits: Record<number, Partial<Gig>>,
  ): string {
    const allGigs: Gig[] = JSON.parse(content)
    for (const index of indicesToVerify) {
      if (allGigs[index]) {
        allGigs[index].verified_by = verifier
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
        addVerifiedByToGigs(content, indices, verifier, edits),
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
    <div class="warning-box" role="alert">{drafts.storageError}</div>
  {/if}

  <div class="mode-tabs">
    <button
      type="button"
      class="tab"
      class:active={mode === "add"}
      onclick={() => (mode = "add")}
    >
      Add new gigs
      {#if drafts.gigs.length > 0}
        <span class="tab-badge">{drafts.gigs.length}</span>
      {/if}
    </button>
    <button
      type="button"
      class="tab"
      class:active={mode === "verify"}
      onclick={() => (mode = "verify")}
    >
      Verify existing
      <span class="tab-badge">{unverifiedGigs.length}</span>
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
        <h2>Submit</h2>
        {#if pr.status === "idle"}
          {#if !auth.isAuthenticated}
            <p class="warning-text">Connect to GitHub above to submit your gigs.</p>
          {/if}
          <button
            type="button"
            class="btn-primary btn-large"
            disabled={!canSubmitAdd}
            onclick={submitAddPR}
          >
            Create pull request with {drafts.gigs.length}
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
        <div class="warning-box">Connect to GitHub above to verify gigs.</div>
      {:else if !auth.canVerify}
        <div class="warning-box">
          Your GitHub account (@{auth.username}) is not authorised to verify
          gigs. Contact the project maintainers if you should have access.
        </div>
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
    max-width: 700px;
    margin: 0 auto;
  }

  .mode-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 1rem;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .tab {
    flex: 1;
    padding: 0.75rem 1rem;
    background: var(--color-bg);
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--color-text-2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: background 0.2s, color 0.2s;
  }

  .tab:not(:last-child) {
    border-right: 1px solid var(--color-border);
  }

  .tab:hover {
    background: var(--color-bg-soft);
  }

  .tab.active {
    background: var(--color-brand-soft);
    color: var(--color-brand-1);
    font-weight: 500;
  }

  .tab-badge {
    background: var(--color-bg-soft);
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
  }

  .tab.active .tab-badge {
    background: var(--color-brand-1);
    color: #fff;
  }

  .submit-section,
  .verify-wrapper {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--color-bg-soft);
    border-radius: 8px;
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
  }

  .warning-text {
    color: var(--color-yellow-1);
    font-size: 0.875rem;
    margin: 0.25rem 0 1rem;
  }

  .warning-box {
    background: var(--color-yellow-soft);
    color: var(--color-yellow-1);
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
</style>
