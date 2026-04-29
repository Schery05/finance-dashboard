import { inflateSync } from "node:zlib";

function decodePdfString(value: string) {
  return value
    .replace(/\\\)/g, ")")
    .replace(/\\\(/g, "(")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ");
}

function extractStringsFromStream(stream: string) {
  const textParts: string[] = [];
  const textBlocks = stream.match(/BT[\s\S]*?ET/g) ?? [stream];

  for (const block of textBlocks) {
    const stringMatches = block.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g);
    for (const match of stringMatches) {
      textParts.push(decodePdfString(match[0].replace(/\)\s*Tj$/, "").slice(1)));
    }

    const arrayMatches = block.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
    for (const match of arrayMatches) {
      const values = match[1].match(/\((?:\\.|[^\\)])*\)/g) ?? [];
      textParts.push(values.map((value) => decodePdfString(value.slice(1, -1))).join(""));
    }
  }

  return textParts.join("\n");
}

function buildToUnicodeMap(streams: string[]) {
  const cmap = new Map<string, string>();
  const text = streams.join("\n");

  for (const block of text.matchAll(/beginbfchar\s*([\s\S]*?)\s*endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      cmap.set(
        pair[1].toUpperCase().padStart(4, "0"),
        String.fromCodePoint(Number.parseInt(pair[2], 16))
      );
    }
  }

  for (const block of text.matchAll(/beginbfrange\s*([\s\S]*?)\s*endbfrange/g)) {
    for (const range of block[1].matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g
    )) {
      const start = Number.parseInt(range[1], 16);
      const end = Number.parseInt(range[2], 16);
      const destination = Number.parseInt(range[3], 16);

      for (let code = start; code <= end; code += 1) {
        cmap.set(
          code.toString(16).toUpperCase().padStart(4, "0"),
          String.fromCodePoint(destination + code - start)
        );
      }
    }
  }

  return cmap;
}

function decodeHexWithCMap(hex: string, cmap: Map<string, string>) {
  if (cmap.size === 0) return "";

  let text = "";
  for (let index = 0; index < hex.length; index += 4) {
    const key = hex.slice(index, index + 4).toUpperCase().padStart(4, "0");
    text += cmap.get(key) ?? "";
  }

  return text;
}

function extractHexStringsFromStream(stream: string, cmap: Map<string, string>) {
  const textParts: string[] = [];
  const textBlocks = stream.match(/BT[\s\S]*?ET/g) ?? [stream];

  for (const block of textBlocks) {
    const parts: string[] = [];

    for (const match of block.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const text = decodeHexWithCMap(match[1], cmap);
      if (text) parts.push(text);
    }

    for (const match of block.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
      const values = match[1].match(/<([0-9A-Fa-f]+)>/g) ?? [];
      const text = values
        .map((value) => decodeHexWithCMap(value.slice(1, -1), cmap))
        .join("");
      if (text) parts.push(text);
    }

    if (parts.length) textParts.push(parts.join(""));
  }

  return textParts.join("\n");
}

export function extractTextFromPdf(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];
  const streams: string[] = [];
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;

  for (const match of raw.matchAll(streamRegex)) {
    const dictionary = match[1];
    const rawStream = Buffer.from(match[2], "latin1");
    let streamText = "";

    try {
      const stream = /\/FlateDecode/.test(dictionary)
        ? inflateSync(rawStream)
        : rawStream;
      streamText = stream.toString("latin1");
    } catch {
      continue;
    }

    streams.push(streamText);
  }

  const cmap = buildToUnicodeMap(streams);

  for (const streamText of streams) {
    const text = [
      extractStringsFromStream(streamText),
      extractHexStringsFromStream(streamText, cmap),
    ]
      .filter(Boolean)
      .join("\n");

    if (text.trim()) chunks.push(text);
  }

  return chunks.join("\n").replace(/\u0000/g, "").trim();
}

export function extractJpegImagesFromPdf(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const images: Buffer[] = [];
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;

  for (const match of raw.matchAll(streamRegex)) {
    const dictionary = match[1];
    if (!/\/DCTDecode/.test(dictionary) || !/\/Subtype\s*\/Image/.test(dictionary)) {
      continue;
    }

    images.push(Buffer.from(match[2], "latin1"));
  }

  return images;
}
