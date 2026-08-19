import { describe, expect, it, beforeEach } from "vitest";
import {
  serializeSet,
  deserializeSet,
  createScopedStorageKey,
  saveScopedState,
  loadScopedState,
  clearScopedState,
  SCOPED_STORAGE_SCHEMA_VERSION,
} from "./scopedStateStorage";

describe("scopedStateStorage", () => {
  let mockStorage: Storage;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: Object.keys(store).length,
    };
  });

  describe("Set Serialization & Deserialization", () => {
    it("should serialize a Set to an Array", () => {
      const set = new Set(["tc-1", "tc-2", "tc-3"]);
      const serialized = serializeSet(set);
      expect(serialized).toEqual(["tc-1", "tc-2", "tc-3"]);
    });

    it("should handle null or undefined gracefully when serializing", () => {
      expect(serializeSet(null)).toEqual([]);
      expect(serializeSet(undefined)).toEqual([]);
      expect(serializeSet("not a set" as any)).toEqual([]);
    });

    it("should deserialize an Array back to a Set", () => {
      const arr = ["item-a", "item-b"];
      const deserialized = deserializeSet<string>(arr);
      expect(deserialized).toBeInstanceOf(Set);
      expect(deserialized.has("item-a")).toBe(true);
      expect(deserialized.has("item-b")).toBe(true);
      expect(deserialized.size).toBe(2);
    });

    it("should handle non-array inputs when deserializing", () => {
      expect(deserializeSet(null).size).toBe(0);
      expect(deserializeSet(undefined).size).toBe(0);
      expect(deserializeSet({} as any).size).toBe(0);
      expect(deserializeSet("invalid" as any).size).toBe(0);
    });
  });

  describe("Key Generation", () => {
    it("generates namespaced storage keys with sanitized characters", () => {
      const key = createScopedStorageKey("testing", "project:123/alpha");
      expect(key).toBe("tabs:testing:v1:project_123/alpha");
    });
  });

  describe("Storage Persistence and Schema Versioning", () => {
    it("saves and loads state matching expected schema version", () => {
      const testKey = "tabs:testing:v1:p1";
      const payload = { activeSection: "discover", draftInput: "hello" };

      const saved = saveScopedState(mockStorage, testKey, payload, 1);
      expect(saved).toBe(true);

      const loaded = loadScopedState<typeof payload>(mockStorage, testKey, 1);
      expect(loaded).toEqual(payload);
    });

    it("discards stale data and returns null on schema version mismatch", () => {
      const testKey = "tabs:testing:v1:p1";
      // Save with version 1
      saveScopedState(mockStorage, testKey, { oldField: "legacy" }, 1);

      // Attempt to load expecting version 2
      const loaded = loadScopedState(mockStorage, testKey, 2);
      expect(loaded).toBeNull();
      // Verifies storage key was cleaned up
      expect(mockStorage.getItem(testKey)).toBeNull();
    });

    it("handles corrupted JSON gracefully", () => {
      const testKey = "tabs:testing:v1:p1";
      mockStorage.setItem(testKey, "{ malformed json");

      const loaded = loadScopedState(mockStorage, testKey, SCOPED_STORAGE_SCHEMA_VERSION);
      expect(loaded).toBeNull();
      expect(mockStorage.getItem(testKey)).toBeNull();
    });

    it("validates data with custom validator if provided", () => {
      const testKey = "tabs:testing:v1:p1";
      saveScopedState(mockStorage, testKey, { count: "not a number" }, 1);

      const validator = (data: unknown): data is { count: number } => {
        return typeof data === "object" && data !== null && typeof (data as any).count === "number";
      };

      const loaded = loadScopedState(mockStorage, testKey, 1, validator);
      expect(loaded).toBeNull();
    });

    it("clears scoped state accurately", () => {
      const testKey = "tabs:testing:v1:p1";
      saveScopedState(mockStorage, testKey, { val: 42 });
      expect(mockStorage.getItem(testKey)).not.toBeNull();

      clearScopedState(mockStorage, testKey);
      expect(mockStorage.getItem(testKey)).toBeNull();
    });
  });
});
