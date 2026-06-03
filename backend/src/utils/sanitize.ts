type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

function sanitizeKey(key: string): string {
  return key.replace(/[$.]/g, "_");
}

function sanitizeValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v as JsonValue));
  }

  if (value && typeof value === "object") {
    const output: { [key: string]: JsonValue } = {};
    Object.entries(value).forEach(([key, val]) => {
      output[sanitizeKey(key)] = sanitizeValue(val as JsonValue);
    });
    return output;
  }

  return value;
}

export function sanitizeBody<T>(body: T): T {
  if (body == null || typeof body !== "object") {
    return body;
  }

  return sanitizeValue(body as JsonValue) as T;
}
