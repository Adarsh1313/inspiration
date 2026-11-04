import type { CaptureStep } from "@hub/capture";
import pg from "pg";

export type TaskStatus = "queued" | "running" | "done" | "failed";

export type Task = { id: string; card_id: string; step: CaptureStep; status: TaskStatus; attempts: number; locked_at: string | null; last_error: string | null };

export type WorkerCard = {
  id: string;
  slug: string;
  source_url: string | null;
  source_type: string;
  kind: string;
  poster_sm: string | null;
  poster_lg: string | null;
  preview: string | null;
  original: string | null;
};

/** The card fields the worker may change (matches the column grants in migration 0003). */
export type CardPatch = Partial<{
  media_status: "pending" | "ready" | "failed";
  media_error: string | null;
  poster_sm: string;
  poster_lg: string;
  preview: string;
  original: string;
  transcript: string;
  video_description: string;
}>;

/** Everything the worker needs from the queue. Postgres backs it in production, memory in tests. */
export interface TaskStore {
  /** Moves queued tasks (and running ones whose lease expired) to running and returns them. */
  claim(limit: number, leaseMs: number): Promise<Task[]>;
  finish(taskId: string, result: { status: "done" | "failed"; attempts: number; error: string | null }): Promise<void>;
  tasksForCard(cardId: string): Promise<Pick<Task, "step" | "status" | "last_error">[]>;
  getCard(cardId: string): Promise<WorkerCard>;
  patchCard(cardId: string, patch: CardPatch): Promise<void>;
}

const CARD_COLUMNS = "id, slug, source_url, source_type, kind, poster_sm, poster_lg, preview, original";
const PATCHABLE = ["media_status", "media_error", "poster_sm", "poster_lg", "preview", "original", "transcript", "video_description"] as const;

export class PgTaskStore implements TaskStore {
  constructor(private readonly client: pg.Client) {}

  async claim(limit: number, leaseMs: number): Promise<Task[]> {
    const { rows } = await this.client.query<Task>(
      `update public.capture_tasks set status = 'running', locked_at = now()
       where id in (
         select id from public.capture_tasks
         where status = 'queued' or (status = 'running' and locked_at < now() - ($2::int * interval '1 millisecond'))
         order by id limit $1 for update skip locked)
       returning *`,
      [limit, leaseMs],
    );
    return rows;
  }

  async finish(taskId: string, r: { status: "done" | "failed"; attempts: number; error: string | null }): Promise<void> {
    await this.client.query("update public.capture_tasks set status = $2, attempts = $3, last_error = $4, locked_at = null where id = $1", [taskId, r.status, r.attempts, r.error]);
  }

  async tasksForCard(cardId: string) {
    const { rows } = await this.client.query<Pick<Task, "step" | "status" | "last_error">>("select step, status, last_error from public.capture_tasks where card_id = $1", [cardId]);
    return rows;
  }

  async getCard(cardId: string): Promise<WorkerCard> {
    const { rows } = await this.client.query<WorkerCard>(`select ${CARD_COLUMNS} from public.cards where id = $1`, [cardId]);
    if (!rows[0]) throw new Error(`Card ${cardId} not found.`);
    return rows[0];
  }

  async patchCard(cardId: string, patch: CardPatch): Promise<void> {
    const entries = PATCHABLE.filter((k) => k in patch).map((k) => [k, patch[k]] as const);
    if (entries.length === 0) return;
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
    await this.client.query(`update public.cards set ${sets} where id = $1`, [cardId, ...entries.map(([, v]) => v)]);
  }
}

/** In-memory adapter behind the same interface, for tests. */
export class MemoryTaskStore implements TaskStore {
  readonly tasks: Task[] = [];
  readonly cards = new Map<string, WorkerCard & Record<string, unknown>>();

  addCard(card: Partial<WorkerCard> & { id: string; slug: string }, steps: CaptureStep[]): void {
    this.cards.set(card.id, { source_url: null, source_type: "x-post", kind: "animation", poster_sm: null, poster_lg: null, preview: null, original: null, ...card });
    steps.forEach((step, i) => this.tasks.push({ id: `${card.id}-t${i}`, card_id: card.id, step, status: "queued", attempts: 0, locked_at: null, last_error: null }));
  }

  async claim(limit: number): Promise<Task[]> {
    const claimed = this.tasks.filter((t) => t.status === "queued").slice(0, limit);
    claimed.forEach((t) => Object.assign(t, { status: "running", locked_at: new Date().toISOString() }));
    return claimed.map((t) => ({ ...t }));
  }

  async finish(taskId: string, r: { status: "done" | "failed"; attempts: number; error: string | null }): Promise<void> {
    const t = this.tasks.find((x) => x.id === taskId)!;
    Object.assign(t, { status: r.status, attempts: r.attempts, last_error: r.error, locked_at: null });
  }

  async tasksForCard(cardId: string) {
    return this.tasks.filter((t) => t.card_id === cardId).map(({ step, status, last_error }) => ({ step, status, last_error }));
  }

  async getCard(cardId: string): Promise<WorkerCard> {
    return { ...this.cards.get(cardId)! };
  }

  async patchCard(cardId: string, patch: CardPatch): Promise<void> {
    Object.assign(this.cards.get(cardId)!, patch);
  }
}
