import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import * as inputFiles from "../media/input-files.js";
import {
  buildMessageWithAttachments,
  type ChatAttachment,
  parseMessageWithAttachments,
} from "./chat-attachments.js";

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/woAAn8B9FD5fHAAAAAASUVORK5CYII=";
const TXT_HELLO = Buffer.from("hello from attachment", "utf8").toString("base64");

async function parseWithWarnings(message: string, attachments: ChatAttachment[]) {
  const logs: string[] = [];
  const parsed = await parseMessageWithAttachments(message, attachments, {
    log: { warn: (warning) => logs.push(warning) },
  });
  return { parsed, logs };
}

describe("buildMessageWithAttachments", () => {
  it("embeds a single image as data URL", () => {
    const msg = buildMessageWithAttachments("see this", [
      {
        type: "image",
        mimeType: "image/png",
        fileName: "dot.png",
        content: PNG_1x1,
      },
    ]);
    expect(msg).toContain("see this");
    expect(msg).toContain(`data:image/png;base64,${PNG_1x1}`);
    expect(msg).toContain("![dot.png]");
  });

  it("rejects non-image mime types", () => {
    const bad: ChatAttachment = {
      type: "file",
      mimeType: "application/pdf",
      fileName: "a.pdf",
      content: "AAA",
    };
    expect(() => buildMessageWithAttachments("x", [bad])).toThrow(/image/);
  });
});

describe("parseMessageWithAttachments", () => {
  it("strips data URL prefix", async () => {
    const parsed = await parseMessageWithAttachments(
      "see this",
      [
        {
          type: "image",
          mimeType: "image/png",
          fileName: "dot.png",
          content: `data:image/png;base64,${PNG_1x1}`,
        },
      ],
      { log: { warn: () => {} } },
    );
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(parsed.images[0]?.data).toBe(PNG_1x1);
  });

  it("sniffs mime when missing", async () => {
    const { parsed, logs } = await parseWithWarnings("see this", [
      {
        type: "image",
        fileName: "dot.png",
        content: PNG_1x1,
      },
    ]);
    expect(parsed.message).toBe("see this");
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(parsed.images[0]?.data).toBe(PNG_1x1);
    expect(logs).toHaveLength(0);
  });

  it("injects supported non-image text payloads instead of dropping them", async () => {
    const { parsed, logs } = await parseWithWarnings("x", [
      {
        type: "file",
        mimeType: "text/plain",
        fileName: "notes.txt",
        content: TXT_HELLO,
      },
    ]);
    expect(parsed.images).toHaveLength(0);
    expect(parsed.message).toContain('name="notes.txt"');
    expect(parsed.message).toContain("hello from attachment");
    expect(logs).toHaveLength(0);
  });

  it("prefers native PDF blocks for document-capable models", async () => {
    const pdfData = Buffer.from("%PDF-1.4 native pdf", "utf8").toString("base64");
    const parsed = await parseMessageWithAttachments(
      "review this pdf",
      [
        {
          type: "file",
          mimeType: "application/pdf",
          fileName: "brief.pdf",
          content: pdfData,
        },
      ],
      { log: { warn: () => {} }, supportsDocuments: true },
    );

    expect(parsed.documents).toEqual([
      {
        type: "document",
        data: pdfData,
        mimeType: "application/pdf",
        fileName: "brief.pdf",
      },
    ]);
    expect(parsed.images).toHaveLength(0);
    expect(parsed.message).toContain("[native document attached: brief.pdf (application/pdf)]");
  });

  it("falls back to extracted PDF context when native document input is unavailable", async () => {
    const extractSpy = vi
      .spyOn(inputFiles, "extractFileContentFromSource")
      .mockResolvedValueOnce({
        filename: "notes.pdf",
        text: "fallback extracted pdf text",
      });
    const parsed = await parseMessageWithAttachments(
      "summarize this",
      [
        {
          type: "file",
          mimeType: "application/pdf",
          fileName: "notes.pdf",
          content: Buffer.from("%PDF-1.4 fallback", "utf8").toString("base64"),
        },
      ],
      { log: { warn: () => {} }, supportsDocuments: false },
    );

    expect(parsed.documents).toHaveLength(0);
    expect(parsed.message).toContain('name="notes.pdf"');
    expect(parsed.message).toContain("fallback extracted pdf text");
    extractSpy.mockRestore();
  });

  it("injects supported text files into the message context", async () => {
    const parsed = await parseMessageWithAttachments(
      "summarize this",
      [
        {
          type: "file",
          mimeType: "text/plain",
          fileName: "notes.txt",
          content: TXT_HELLO,
        },
      ],
      { log: { warn: () => {} } },
    );

    expect(parsed.images).toHaveLength(0);
    expect(parsed.message).toContain("<file");
    expect(parsed.message).toContain('name="notes.txt"');
    expect(parsed.message).toContain("hello from attachment");
  });

  it("keeps unsupported videos as file context placeholders instead of dropping them", async () => {
    const parsed = await parseMessageWithAttachments(
      "review this",
      [
        {
          type: "file",
          mimeType: "video/mp4",
          fileName: "clip.mp4",
          content: Buffer.from("pretend video bytes", "utf8").toString("base64"),
        },
      ],
      { log: { warn: () => {} } },
    );

    expect(parsed.images).toHaveLength(0);
    expect(parsed.message).toContain('name="clip.mp4"');
    expect(parsed.message).toContain("Rich video understanding is not enabled in chat yet.");
  });

  it.runIf(process.platform === "darwin")(
    "marks legacy office files when best-effort extraction yields no readable text",
    async () => {
      const sample = await readFile(
        "/System/Library/PrivateFrameworks/OfficeImport.framework/Versions/A/Resources/BlankDelimited.xls",
      );
      const parsed = await parseMessageWithAttachments(
        "review this legacy file",
        [
          {
            type: "file",
            mimeType: "application/vnd.ms-excel",
            fileName: "legacy.xls",
            content: sample.toString("base64"),
          },
        ],
        { log: { warn: () => {} } },
      );

      expect(parsed.images).toHaveLength(0);
      expect(parsed.message).toContain('name="legacy.xls"');
      expect(parsed.message).toContain("Legacy Office attachment uploaded:");
      expect(parsed.message).toContain(
        "Best-effort extraction ran, but no readable text was recovered.",
      );
    },
  );

  it("keeps text file context for text-only models while dropping image-only inputs", async () => {
    const parsed = await parseMessageWithAttachments(
      "use docs only",
      [
        {
          type: "image",
          mimeType: "image/png",
          fileName: "plot.png",
          content: PNG_1x1,
        },
        {
          type: "file",
          mimeType: "text/plain",
          fileName: "notes.txt",
          content: TXT_HELLO,
        },
      ],
      { log: { warn: () => {} }, supportsImages: false },
    );

    expect(parsed.images).toHaveLength(0);
    expect(parsed.message).toContain("hello from attachment");
    expect(parsed.message).not.toContain("media://");
  });

  it("prefers sniffed mime type and logs mismatch", async () => {
    const { parsed, logs } = await parseWithWarnings("x", [
      {
        type: "image",
        mimeType: "image/jpeg",
        fileName: "dot.png",
        content: PNG_1x1,
      },
    ]);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/mime mismatch/i);
  });

  it("keeps unknown binary payloads as file context placeholders", async () => {
    const unknown = Buffer.from("not an image").toString("base64");
    const { parsed, logs } = await parseWithWarnings("x", [
      { type: "file", fileName: "unknown.bin", content: unknown },
    ]);
    expect(parsed.images).toHaveLength(0);
    expect(parsed.message).toContain('name="unknown.bin"');
    expect(parsed.message).toContain("Binary attachment uploaded:");
    expect(logs).toHaveLength(0);
  });

  it("keeps valid images and injects valid text attachments in the same request", async () => {
    const { parsed, logs } = await parseWithWarnings("x", [
      {
        type: "image",
        mimeType: "image/png",
        fileName: "dot.png",
        content: PNG_1x1,
      },
      {
        type: "file",
        mimeType: "text/plain",
        fileName: "notes.txt",
        content: TXT_HELLO,
      },
    ]);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(parsed.images[0]?.data).toBe(PNG_1x1);
    expect(parsed.message).toContain("hello from attachment");
    expect(logs).toHaveLength(0);
  });
});

describe("shared attachment validation", () => {
  it("rejects invalid base64 content for both builder and parser", async () => {
    const bad: ChatAttachment = {
      type: "image",
      mimeType: "image/png",
      fileName: "dot.png",
      content: "%not-base64%",
    };

    expect(() => buildMessageWithAttachments("x", [bad])).toThrow(/base64/i);
    await expect(
      parseMessageWithAttachments("x", [bad], { log: { warn: () => {} } }),
    ).rejects.toThrow(/base64/i);
  });

  it("rejects images over limit for both builder and parser without decoding base64", async () => {
    const big = "A".repeat(10_000);
    const att: ChatAttachment = {
      type: "image",
      mimeType: "image/png",
      fileName: "big.png",
      content: big,
    };

    const fromSpy = vi.spyOn(Buffer, "from");
    try {
      expect(() => buildMessageWithAttachments("x", [att], { maxBytes: 16 })).toThrow(
        /exceeds size limit/i,
      );
      await expect(
        parseMessageWithAttachments("x", [att], { maxBytes: 16, log: { warn: () => {} } }),
      ).rejects.toThrow(/exceeds size limit/i);
      const base64Calls = fromSpy.mock.calls.filter((args) => (args as unknown[])[1] === "base64");
      expect(base64Calls).toHaveLength(0);
    } finally {
      fromSpy.mockRestore();
    }
  });
});
