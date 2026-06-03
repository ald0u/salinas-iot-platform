export interface CursorPayload {
  PK: string;
  SK: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

export function decodeCursor(cursor?: string): CursorPayload | undefined {
  if (!cursor) {
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as CursorPayload;
  } catch {
    return undefined;
  }
}
