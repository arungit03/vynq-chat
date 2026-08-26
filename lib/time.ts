export class Timestamp {
  private readonly value: Date;

  constructor(value: string | number | Date) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    this.value = Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  toDate() {
    return new Date(this.value);
  }

  toMillis() {
    return this.value.getTime();
  }

  toISOString() {
    return this.value.toISOString();
  }
}

export function toTimestamp(value: unknown): Timestamp | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Timestamp) return value;
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) return new Timestamp(value);
  return null;
}

export function isoNow() {
  return new Date().toISOString();
}
