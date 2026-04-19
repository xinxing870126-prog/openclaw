import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReplyPayload } from "../../auto-reply/types.js";
import { maxBytesForKind, type MediaKind } from "../../media/constants.js";
import { detectMime, kindFromMime } from "../../media/mime.js";
import { splitMediaFromOutput } from "../../media/parse.js";
import { resolveSendableOutboundReplyParts } from "../../plugin-sdk/reply-payload.js";
import { normalizeLowercaseStringOrEmpty } from "../../shared/string-coerce.js";

const MAX_WEBCHAT_EMBED_BYTES = 15 * 1024 * 1024;
const FILE_TOKEN_RE = /^\s*FILE:\s*(.+?)\s*$/i;

type WebchatContentBlock = Record<string, unknown>;

export type WebchatEmbeddedReply = {
  blocks: WebchatContentBlock[];
  cleanedTexts: string[];
};

type LocalMediaDescriptor = {
  kind: MediaKind;
  mimeType: string;
  fileName: string;
  base64Data: string;
  sizeBytes: number;
};

function resolveLocalMediaPathForEmbedding(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (/^data:/i.test(trimmed) || /^https?:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return null;
  }
  if (trimmed.startsWith("file:")) {
    try {
      const resolved = fileURLToPath(trimmed);
      return path.isAbsolute(resolved) ? resolved : null;
    } catch {
      return null;
    }
  }
  return path.isAbsolute(trimmed) ? trimmed : null;
}

function resolveRemoteMediaUrlForEmbedding(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return /^https?:\/\//i.test(trimmed) || /^blob:/i.test(trimmed) ? trimmed : null;
}

function webchatEmbedLimitForKind(kind: MediaKind): number {
  return Math.min(maxBytesForKind(kind), MAX_WEBCHAT_EMBED_BYTES);
}

function buildBase64ContentBlock(params: LocalMediaDescriptor): WebchatContentBlock {
  const source = {
    type: "base64",
    media_type: params.mimeType,
    data: params.base64Data,
  };
  switch (params.kind) {
    case "image":
      return {
        type: "image",
        fileName: params.fileName,
        mimeType: params.mimeType,
        source,
      };
    case "audio":
      return {
        type: "audio",
        fileName: params.fileName,
        mimeType: params.mimeType,
        source,
      };
    case "video":
      return {
        type: "video",
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        source,
      };
    case "document":
    default:
      return {
        type: "file",
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        source,
      };
  }
}

function buildRemoteContentBlock(params: {
  kind: MediaKind;
  mimeType: string;
  url: string;
  fileName: string;
}): WebchatContentBlock {
  switch (params.kind) {
    case "image":
      return {
        type: "image",
        url: params.url,
        fileName: params.fileName,
        mimeType: params.mimeType,
      };
    case "audio":
      return {
        type: "audio",
        url: params.url,
        fileName: params.fileName,
        mimeType: params.mimeType,
      };
    case "video":
      return {
        type: "video",
        url: params.url,
        fileName: params.fileName,
        mimeType: params.mimeType,
      };
    case "document":
    default:
      return {
        type: "file",
        url: params.url,
        fileName: params.fileName,
        mimeType: params.mimeType,
      };
  }
}

function stripEmbeddedFileLines(text: string): { cleanedText: string; fileUrls: string[] } {
  const fileUrls: string[] = [];
  const keptLines: string[] = [];
  for (const line of text.split("\n")) {
    const match = FILE_TOKEN_RE.exec(line.trim());
    if (!match) {
      keptLines.push(line);
      continue;
    }
    const candidate = match[1]?.trim();
    if (candidate) {
      fileUrls.push(candidate);
    }
  }
  return {
    cleanedText: keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    fileUrls,
  };
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

function fileNameFromCandidate(candidate: string): string {
  try {
    if (/^https?:\/\//i.test(candidate) || /^blob:/i.test(candidate)) {
      const parsed = new URL(candidate);
      const base = path.basename(parsed.pathname);
      return base || "attachment";
    }
  } catch {
    /* noop */
  }
  return path.basename(candidate) || "attachment";
}

async function buildLocalMediaBlock(filePath: string): Promise<WebchatContentBlock | null> {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return null;
    }
    const fileName = path.basename(filePath) || "attachment";
    const pathMimeType = (await detectMime({ filePath })) ?? "application/octet-stream";
    const pathKind = kindFromMime(pathMimeType);
    if (pathKind && stat.size > webchatEmbedLimitForKind(pathKind)) {
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    const mimeType = (await detectMime({ buffer, filePath })) ?? pathMimeType;
    const kind = kindFromMime(mimeType) ?? pathKind;
    if (!kind) {
      return null;
    }
    if (stat.size > webchatEmbedLimitForKind(kind)) {
      return null;
    }
    return buildBase64ContentBlock({
      kind,
      mimeType,
      fileName,
      base64Data: buffer.toString("base64"),
      sizeBytes: stat.size,
    });
  } catch {
    return null;
  }
}

async function buildRemoteMediaBlock(rawUrl: string): Promise<WebchatContentBlock | null> {
  const url = resolveRemoteMediaUrlForEmbedding(rawUrl);
  if (!url) {
    return null;
  }
  const mimeType = (await detectMime({ filePath: url })) ?? "application/octet-stream";
  const kind = kindFromMime(mimeType);
  if (!kind) {
    return null;
  }
  return buildRemoteContentBlock({
    kind,
    mimeType,
    url,
    fileName: fileNameFromCandidate(url),
  });
}

async function buildMediaBlock(raw: string): Promise<WebchatContentBlock | null> {
  const localPath = resolveLocalMediaPathForEmbedding(raw);
  if (localPath) {
    return await buildLocalMediaBlock(localPath);
  }
  return await buildRemoteMediaBlock(raw);
}

function extractPayloadMedia(payload: ReplyPayload): { cleanedText: string; mediaUrls: string[] } {
  const parts = resolveSendableOutboundReplyParts(payload);
  const split = splitMediaFromOutput(parts.text);
  const stripped = stripEmbeddedFileLines(split.text);
  return {
    cleanedText: stripped.cleanedText,
    mediaUrls: dedupeStrings([
      ...parts.mediaUrls,
      ...(split.mediaUrls ?? []),
      ...stripped.fileUrls,
    ]),
  };
}

export async function buildWebchatMediaContentBlocksFromReplyPayloads(
  payloads: ReplyPayload[],
): Promise<WebchatEmbeddedReply> {
  const seen = new Set<string>();
  const blocks: WebchatContentBlock[] = [];
  const cleanedTexts: string[] = [];

  for (const payload of payloads) {
    const extracted = extractPayloadMedia(payload);
    cleanedTexts.push(extracted.cleanedText);
    for (const raw of extracted.mediaUrls) {
      const localPath = resolveLocalMediaPathForEmbedding(raw);
      const remoteUrl = localPath ? null : resolveRemoteMediaUrlForEmbedding(raw);
      const key = normalizeLowercaseStringOrEmpty(localPath ?? remoteUrl ?? raw);
      if (!key || seen.has(key)) {
        continue;
      }
      const block = await buildMediaBlock(raw);
      if (!block) {
        continue;
      }
      seen.add(key);
      blocks.push(block);
    }
  }

  return { blocks, cleanedTexts };
}
