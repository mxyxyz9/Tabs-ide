const DIGITS = "abcdefghijklmnopqrstuvwxyz";

function valid(key: string): boolean {
  return key.length > 0 && [...key].every((char) => DIGITS.includes(char)) && key.at(-1) !== "a";
}

function midpoint(before: string, after: string): string {
  if (after !== "" && before >= after) throw new Error("pin order bounds are out of order");
  if (after !== "") {
    let shared = 0;
    while ((before.charAt(shared) || "a") === after.charAt(shared)) shared += 1;
    if (shared > 0)
      return after.slice(0, shared) + midpoint(before.slice(shared), after.slice(shared));
  }
  const low = before === "" ? 0 : DIGITS.indexOf(before.charAt(0));
  const high = after === "" ? DIGITS.length : DIGITS.indexOf(after.charAt(0));
  if (high - low > 1) return DIGITS.charAt(Math.round((low + high) / 2));
  if (after.length > 1) return after.charAt(0);
  return DIGITS.charAt(low) + midpoint(before.slice(1), "");
}

export function pinOrderKeyBetween(before: string | null, after: string | null): string | null {
  if (before !== null && !valid(before)) return null;
  if (after !== null && !valid(after)) return null;
  if (before !== null && after !== null && before >= after) return null;
  return midpoint(before ?? "", after ?? "");
}

export function sortPinnedThreads<
  T extends { id: string; createdAt: string; pinOrderKey?: string | null },
>(threads: readonly T[]): T[] {
  const keyed = threads.filter((thread) => thread.pinOrderKey != null);
  const keyless = threads.filter((thread) => thread.pinOrderKey == null);
  keyed.sort((left, right) =>
    left.pinOrderKey! < right.pinOrderKey!
      ? -1
      : left.pinOrderKey! > right.pinOrderKey!
        ? 1
        : left.id.localeCompare(right.id),
  );
  keyless.sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id),
  );
  return [...keyed, ...keyless];
}
