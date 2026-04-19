import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWebchatMediaContentBlocksFromReplyPayloads } from "./chat-webchat-media.js";

describe("buildWebchatMediaContentBlocksFromReplyPayloads", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    tmpDir = undefined;
  });

  it("embeds a local audio file as a base64 chat block", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-webchat-media-"));
    const audioPath = path.join(tmpDir, "clip.mp3");
    fs.writeFileSync(audioPath, Buffer.from([0xff, 0xfb, 0x90, 0x00]));

    const result = await buildWebchatMediaContentBlocksFromReplyPayloads([{ mediaUrl: audioPath }]);

    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0] as {
      type?: string;
      source?: { type?: string; media_type?: string; data?: string };
    };
    expect(block.type).toBe("audio");
    expect(block.source?.type).toBe("base64");
    expect(block.source?.media_type).toBe("audio/mpeg");
    expect(Buffer.from(block.source?.data ?? "", "base64")).toEqual(
      Buffer.from([0xff, 0xfb, 0x90, 0x00]),
    );
  });

  it("embeds a local video file as a video block", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-webchat-media-"));
    const videoPath = path.join(tmpDir, "clip.mp4");
    fs.writeFileSync(videoPath, Buffer.from([0x00, 0x00, 0x00, 0x18]));

    const result = await buildWebchatMediaContentBlocksFromReplyPayloads([{ mediaUrl: videoPath }]);

    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0] as {
      type?: string;
      fileName?: string;
      mimeType?: string;
      source?: { type?: string; media_type?: string };
    };
    expect(block.type).toBe("video");
    expect(block.fileName).toBe("clip.mp4");
    expect(block.mimeType).toBe("video/mp4");
    expect(block.source?.type).toBe("base64");
  });

  it("embeds a local document as a downloadable file block", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-webchat-media-"));
    const filePath = path.join(tmpDir, "report.pdf");
    fs.writeFileSync(filePath, Buffer.from("%PDF-1.4"));

    const result = await buildWebchatMediaContentBlocksFromReplyPayloads([{ mediaUrl: filePath }]);

    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0] as {
      type?: string;
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
    };
    expect(block.type).toBe("file");
    expect(block.fileName).toBe("report.pdf");
    expect(block.mimeType).toBe("application/pdf");
    expect(block.sizeBytes).toBeGreaterThan(0);
  });

  it("strips FILE lines from reply text while preserving the file block", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-webchat-media-"));
    const filePath = path.join(tmpDir, "result.txt");
    fs.writeFileSync(filePath, "hello");

    const result = await buildWebchatMediaContentBlocksFromReplyPayloads([
      { text: `Done.\nFILE:${filePath}` },
    ]);

    expect(result.cleanedTexts).toEqual(["Done."]);
    expect(result.blocks).toHaveLength(1);
    expect((result.blocks[0] as { type?: string }).type).toBe("file");
  });

  it("passes through remote image urls as image blocks", async () => {
    const result = await buildWebchatMediaContentBlocksFromReplyPayloads([
      { mediaUrl: "https://example.com/report.png" },
    ]);

    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0] as { type?: string; url?: string };
    expect(block.type).toBe("image");
    expect(block.url).toBe("https://example.com/report.png");
  });

  it("dedupes repeated paths", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-webchat-media-"));
    const audioPath = path.join(tmpDir, "clip.mp3");
    fs.writeFileSync(audioPath, Buffer.from([0x00]));

    const result = await buildWebchatMediaContentBlocksFromReplyPayloads([
      { mediaUrl: audioPath },
      { mediaUrl: pathToFileURL(audioPath).href },
    ]);
    expect(result.blocks).toHaveLength(1);
  });

  it("does not read file contents when stat reports size over the cap", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-webchat-media-"));
    const filePath = path.join(tmpDir, "huge.pdf");
    fs.writeFileSync(filePath, Buffer.from([0x02]));

    const origStat = fs.statSync.bind(fs);
    const statSpy = vi.spyOn(fs, "statSync").mockImplementation((p: fs.PathLike) => {
      if (String(p) === filePath) {
        return { isFile: () => true, size: 16 * 1024 * 1024 } as fs.Stats;
      }
      return origStat(p);
    });
    const readSpy = vi.spyOn(fs, "readFileSync");

    const result = await buildWebchatMediaContentBlocksFromReplyPayloads([{ mediaUrl: filePath }]);

    expect(result.blocks).toHaveLength(0);
    expect(readSpy).not.toHaveBeenCalled();

    statSpy.mockRestore();
    readSpy.mockRestore();
  });
});
