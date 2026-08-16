import {
  SESSION_STORAGE_KEY,
  SESSION_VERSION,
  emptyReceiptState,
  serializeSession,
  deserializeSession,
  migrateSession,
  serializeAssignedItems,
  isDefaultSession,
} from "./session-persistence";
import { mockReceipt, mockPeople } from "@/test/test-utils";
import { type ReceiptState, type ItemAssignments } from "@/types";

const V1_ASSIGNMENTS: [number, { personId: string; sharePercentage: number }[]][] = [
  [0, [{ personId: "a", sharePercentage: 100 }]],
];

function v1Blob(overrides: Record<string, unknown> = {}) {
  return {
    state: {
      originalReceipt: mockReceipt,
      people: mockPeople,
      assignedItems: V1_ASSIGNMENTS,
      unassignedItems: [1],
      groups: [],
      isLoading: false,
      error: null,
      ...overrides,
    },
    activeTab: "assign",
  };
}

describe("session-persistence", () => {
  it("exports the localStorage key and v2 version", () => {
    expect(SESSION_STORAGE_KEY).toBe("receiptSplitterSession");
    expect(SESSION_VERSION).toBe(2);
  });

  it("emptyReceiptState has no receipts and empty assignment map", () => {
    const empty = emptyReceiptState();
    expect(empty.receipts).toEqual([]);
    expect(empty.people).toEqual([]);
    expect(empty.groups).toEqual([]);
    expect(empty.assignedItems).toBeInstanceOf(Map);
    expect(empty.assignedItems.size).toBe(0);
    expect(empty.isLoading).toBe(false);
    expect(empty.error).toBeNull();
    expect(isDefaultSession(empty, "upload")).toBe(true);
  });

  describe("v1 migration", () => {
    it("round-trips a v1 single-receipt blob to receipts[0] + nested map", () => {
      const migrated = deserializeSession(JSON.stringify(v1Blob()));
      expect(migrated).not.toBeNull();
      expect(migrated!.activeTab).toBe("assign");
      expect(migrated!.state.receipts).toHaveLength(1);
      expect(migrated!.state.receipts[0].receipt).toEqual(mockReceipt);
      expect(migrated!.state.receipts[0].id).toBeTruthy();
      expect(migrated!.state.people).toEqual(mockPeople);

      const receiptId = migrated!.state.receipts[0].id;
      const inner = migrated!.state.assignedItems.get(receiptId);
      expect(inner).toBeInstanceOf(Map);
      expect(inner?.get(0)).toEqual([{ personId: "a", sharePercentage: 100 }]);
    });

    it("preserves item 0 assignment to person a after migrate", () => {
      const migrated = migrateSession(v1Blob());
      expect(migrated).not.toBeNull();
      const receiptId = migrated!.state.receipts[0].id;
      const assignment = migrated!.state.assignedItems.get(receiptId)?.get(0);
      expect(assignment).toEqual([{ personId: "a", sharePercentage: 100 }]);
    });

    it("migrates empty v1 originalReceipt to an empty session", () => {
      const migrated = migrateSession({
        state: {
          originalReceipt: null,
          people: [],
          assignedItems: [],
          unassignedItems: [],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      });
      expect(migrated).not.toBeNull();
      expect(migrated!.state.receipts).toEqual([]);
      expect(migrated!.state.assignedItems.size).toBe(0);
      expect(isDefaultSession(migrated!.state, migrated!.activeTab)).toBe(true);
    });

    it("does not double-migrate assignedItems that are already v2 nested arrays", () => {
      const receiptId = "already-v2-id";
      const hybrid = {
        state: {
          originalReceipt: mockReceipt,
          people: mockPeople,
          assignedItems: [
            [receiptId, [[0, [{ personId: "a", sharePercentage: 100 }]]]],
          ],
          unassignedItems: [1],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "people",
      };

      const migrated = migrateSession(hybrid);
      expect(migrated).not.toBeNull();
      // Nested string-keyed assignedItems is treated as v2 — keep the existing id
      expect(migrated!.state.assignedItems.get(receiptId)?.get(0)).toEqual([
        { personId: "a", sharePercentage: 100 },
      ]);
      // Must not wrap again as Map([[newId, Map([[receiptId, ...]])]])
      expect(migrated!.state.assignedItems.get(receiptId)).toBeInstanceOf(Map);
    });
  });

  describe("v2 serialize/deserialize", () => {
    function v2State(): ReceiptState {
      const receiptId = "receipt-v2";
      const inner: ItemAssignments = new Map([
        [0, [{ personId: "a", sharePercentage: 100 }]],
        [1, [{ personId: "b", sharePercentage: 50 }, { personId: "a", sharePercentage: 50 }]],
      ]);
      return {
        receipts: [{ id: receiptId, receipt: mockReceipt }],
        people: mockPeople,
        groups: [],
        assignedItems: new Map([[receiptId, inner]]),
        isLoading: false,
        error: null,
      };
    }

    it("serializes assignedItems as nested entry arrays, not {}", () => {
      const state = v2State();
      const parsed = JSON.parse(serializeSession(state, "results"));
      expect(parsed.version).toBe(2);
      expect(parsed.activeTab).toBe("results");
      expect(parsed.state.originalReceipt).toBeUndefined();
      expect(parsed.state.unassignedItems).toBeUndefined();
      expect(Array.isArray(parsed.state.assignedItems)).toBe(true);
      expect(parsed.state.assignedItems).toEqual([
        [
          "receipt-v2",
          [
            [0, [{ personId: "a", sharePercentage: 100 }]],
            [1, [{ personId: "b", sharePercentage: 50 }, { personId: "a", sharePercentage: 50 }]],
          ],
        ],
      ]);
      // Guard the Map pitfall: JSON.stringify of a Map is {}
      expect(parsed.state.assignedItems).not.toEqual({});
    });

    it("round-trips nested maps through serialize then deserialize", () => {
      const state = v2State();
      const restored = deserializeSession(serializeSession(state, "results"));
      expect(restored).not.toBeNull();
      expect(restored!.activeTab).toBe("results");
      expect(restored!.state.receipts).toEqual(state.receipts);
      expect(restored!.state.people).toEqual(mockPeople);

      const inner = restored!.state.assignedItems.get("receipt-v2");
      expect(inner).toBeInstanceOf(Map);
      expect(inner?.get(0)).toEqual([{ personId: "a", sharePercentage: 100 }]);
      expect(inner?.get(1)).toEqual([
        { personId: "b", sharePercentage: 50 },
        { personId: "a", sharePercentage: 50 },
      ]);
    });

    it("does not generate a new receipt id when deserializing v2", () => {
      const state = v2State();
      const first = deserializeSession(serializeSession(state, "upload"));
      const second = deserializeSession(serializeSession(first!.state, "upload"));
      expect(second!.state.receipts[0].id).toBe("receipt-v2");
      expect(second!.state.assignedItems.has("receipt-v2")).toBe(true);
    });

    it("serializes an empty Map as []", () => {
      expect(serializeAssignedItems(new Map())).toEqual([]);
      const parsed = JSON.parse(serializeSession(emptyReceiptState(), "upload"));
      expect(parsed.state.assignedItems).toEqual([]);
    });
  });

  describe("corrupt and empty input", () => {
    it("returns null for corrupt JSON", () => {
      expect(deserializeSession("invalid json {")).toBeNull();
      expect(deserializeSession("")).toBeNull();
    });

    it("returns null for unrecognized shapes", () => {
      expect(deserializeSession("null")).toBeNull();
      expect(deserializeSession("[]")).toBeNull();
      expect(deserializeSession("42")).toBeNull();
      expect(migrateSession({ foo: "bar" })).toBeNull();
    });

    it("round-trips an empty/default session", () => {
      const serialized = serializeSession(emptyReceiptState(), "upload");
      const restored = deserializeSession(serialized);
      expect(restored).not.toBeNull();
      expect(restored!.state.receipts).toEqual([]);
      expect(restored!.state.people).toEqual([]);
      expect(restored!.state.groups).toEqual([]);
      expect(restored!.state.assignedItems.size).toBe(0);
      expect(restored!.activeTab).toBe("upload");
      expect(isDefaultSession(restored!.state, restored!.activeTab)).toBe(true);
    });
  });
});
