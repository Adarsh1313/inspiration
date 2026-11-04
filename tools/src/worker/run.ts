import { rmSync } from "node:fs";
import { STEP_ORDER } from "@hub/capture";
import { describeError, withRetry } from "./retry";
import { makeContext, STEPS, type Deps } from "./steps";
import type { Task } from "./tasks";

const LEASE_MS = 30 * 60 * 1000; // a crashed run's tasks become claimable again after this
const CLAIM_LIMIT = 200;
const MAX_ATTEMPTS = 3;

export type RunSummary = { claimed: number; done: number; failed: number; cards: number };

async function finalizeCard(deps: Deps, cardId: string): Promise<void> {
  const tasks = await deps.tasks.tasksForCard(cardId);
  if (tasks.some((t) => t.status === "queued" || t.status === "running")) return;
  const failed = tasks.filter((t) => t.status === "failed");
  if (failed.length) {
    const reason = failed.map((t) => `${t.step}: ${t.last_error ?? "failed"}`).join("; ").slice(0, 500);
    await deps.tasks.patchCard(cardId, { media_status: "failed", media_error: reason });
  } else {
    await deps.tasks.patchCard(cardId, { media_status: "ready", media_error: null });
  }
}

/** Claims queued tasks and runs them card by card, one step at a time, in dependency order. Exits when idle. */
export async function runPending(deps: Deps): Promise<RunSummary> {
  const claimed = await deps.tasks.claim(CLAIM_LIMIT, LEASE_MS);
  const summary: RunSummary = { claimed: claimed.length, done: 0, failed: 0, cards: 0 };

  const byCard = new Map<string, Task[]>();
  for (const t of claimed) byCard.set(t.card_id, [...(byCard.get(t.card_id) ?? []), t]);

  for (const [cardId, tasks] of byCard) {
    summary.cards++;
    const card = await deps.tasks.getCard(cardId);
    const ctx = makeContext(card, deps);
    tasks.sort((a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step));

    for (const task of tasks) {
      const budget = Math.max(1, MAX_ATTEMPTS - task.attempts);
      const result = await withRetry(() => STEPS[task.step](ctx), { max: budget, sleep: deps.sleep });
      const attempts = task.attempts + result.attempts;
      if (result.ok) {
        await deps.tasks.finish(task.id, { status: "done", attempts, error: null });
        summary.done++;
        deps.log?.(`${card.slug}: ${task.step} done`);
      } else {
        const error = describeError(result.error, result.classification);
        await deps.tasks.finish(task.id, { status: "failed", attempts, error });
        summary.failed++;
        deps.log?.(`${card.slug}: ${task.step} failed (${error})`);
      }
    }
    await finalizeCard(deps, cardId);
    rmSync(ctx.dir, { recursive: true, force: true });
  }
  return summary;
}
