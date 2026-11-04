import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyMedia, mirrorFiles, type MediaCard } from "./mirror-media";
import { MemoryMediaStore } from "./worker/media-store";

const card = (over: Partial<MediaCard> = {}): MediaCard => ({ slug: "loader", status: "active", poster_sm: null, preview: null, original: null, ...over });

describe("mirrorFiles", () => {
  it("maps poster, hover clip and original into the card folder", () => {
    expect(mirrorFiles(card({ poster_sm: "poster/a.jpg", preview: "preview/b.mp4", original: "original/c.mp4" })).map((f) => f.path)).toEqual([
      "refs/loader/poster.jpg",
      "refs/loader/preview.mp4",
      "refs/loader/clip.mp4",
    ]);
  });

  it("keeps an image original as original.<ext> and a gif as clip.gif", () => {
    expect(mirrorFiles(card({ original: "original/c.png" }))[0].path).toBe("refs/loader/original.png");
    expect(mirrorFiles(card({ original: "original/c.gif" }))[0].path).toBe("refs/loader/clip.gif");
  });
});

describe("copyMedia", () => {
  it("copies media for active cards only, and leaves existing files alone", async () => {
    const media = new MemoryMediaStore();
    const poster = await media.put("poster", new Uint8Array([1, 2, 3]), "jpg", "image/jpeg");
    const out = mkdtempSync(join(tmpdir(), "hub-mirror-"));

    const cards = [card({ poster_sm: poster }), card({ slug: "draft-one", status: "draft", poster_sm: poster })];
    expect(await copyMedia(cards, out, media)).toBe(1);
    expect([...readFileSync(join(out, "refs/loader/poster.jpg"))]).toEqual([1, 2, 3]);
    expect(existsSync(join(out, "refs/draft-one/poster.jpg"))).toBe(false);

    writeFileSync(join(out, "refs/loader/poster.jpg"), "keep");
    expect(await copyMedia(cards, out, media)).toBe(0);
    expect(readFileSync(join(out, "refs/loader/poster.jpg"), "utf8")).toBe("keep");
  });
});
