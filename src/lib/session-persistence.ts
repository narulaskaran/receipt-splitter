import {
  type Receipt,
  type ReceiptState,
  type Person,
  type Group,
  type PersonItemAssignment,
  type StoredReceipt,
  type ItemAssignments,
} from "@/types";

export const SESSION_STORAGE_KEY = "receiptSplitterSession";
export const SESSION_VERSION = 2;

export interface PersistedSession {
  state: ReceiptState;
  activeTab: string;
}

type SerializedInnerAssignments = Array<[number, PersonItemAssignment[]]>;
type SerializedAssignedItems = Array<[string, SerializedInnerAssignments]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function emptyReceiptState(): ReceiptState {
  return {
    receipts: [],
    people: [],
    groups: [],
    assignedItems: new Map(),
    isLoading: false,
    error: null,
  };
}

export function isDefaultSession(state: ReceiptState, activeTab: string): boolean {
  return (
    activeTab === "upload" &&
    state.receipts.length === 0 &&
    state.people.length === 0 &&
    state.groups.length === 0 &&
    state.assignedItems.size === 0 &&
    !state.isLoading &&
    state.error === null
  );
}

/**
 * Serialize nested assignment Maps as arrays of entries.
 * JSON.stringify(Map) is `{}`, so Maps must never be stringified directly.
 */
export function serializeAssignedItems(
  assignedItems: Map<string, ItemAssignments>
): SerializedAssignedItems {
  return Array.from(assignedItems.entries()).map(([rid, inner]) => [
    rid,
    Array.from(inner.entries()),
  ]);
}

export function serializeSession(state: ReceiptState, activeTab: string): string {
  return JSON.stringify({
    version: SESSION_VERSION,
    state: {
      receipts: state.receipts,
      people: state.people,
      groups: state.groups,
      assignedItems: serializeAssignedItems(state.assignedItems),
      isLoading: state.isLoading,
      error: state.error,
    },
    activeTab,
  });
}

export function deserializeSession(
  raw: string
): PersistedSession | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return migrateSession(parsed);
  } catch {
    return null;
  }
}

/**
 * Convert a parsed localStorage blob (v1 or v2) into runtime ReceiptState.
 * Returns null for unrecognized or unusable shapes.
 */
export function migrateSession(parsed: unknown): PersistedSession | null {
  if (!isRecord(parsed)) {
    return null;
  }

  const activeTab =
    typeof parsed.activeTab === "string" ? parsed.activeTab : "upload";
  const rawState = isRecord(parsed.state) ? parsed.state : parsed;

  const hasReceiptsArray = Array.isArray(rawState.receipts);
  const hasOriginalReceipt = "originalReceipt" in rawState;
  const assignedIsV2 = isV2AssignedItems(rawState.assignedItems);

  // v2 wins when versioned or receipts[] is present. v1 originalReceipt is
  // checked before assignedItems shape so a leftover v1 blob with nested
  // assignments is not treated as receipts-less v2.
  if (parsed.version === SESSION_VERSION || hasReceiptsArray) {
    return migrateV2(rawState, activeTab);
  }

  if (hasOriginalReceipt) {
    return migrateV1(rawState, activeTab);
  }

  if (assignedIsV2) {
    return migrateV2(rawState, activeTab);
  }

  return null;
}

function migrateV2(
  rawState: Record<string, unknown>,
  activeTab: string
): PersistedSession {
  const receipts = parseStoredReceipts(rawState.receipts);
  const assignedItems = assignedItemsFromUnknown(rawState.assignedItems, receipts);

  return {
    state: {
      receipts,
      people: parsePeople(rawState.people),
      groups: parseGroups(rawState.groups),
      assignedItems,
      isLoading: Boolean(rawState.isLoading),
      error: typeof rawState.error === "string" ? rawState.error : null,
    },
    activeTab,
  };
}

function migrateV1(
  rawState: Record<string, unknown>,
  activeTab: string
): PersistedSession {
  const originalReceipt = parseReceipt(rawState.originalReceipt);
  const people = parsePeople(rawState.people);
  const groups = parseGroups(rawState.groups);
  const isLoading = Boolean(rawState.isLoading);
  const error = typeof rawState.error === "string" ? rawState.error : null;

  if (!originalReceipt) {
    return {
      state: {
        receipts: [],
        people,
        groups,
        assignedItems: isV2AssignedItems(rawState.assignedItems)
          ? deserializeV2AssignedItems(rawState.assignedItems)
          : new Map(),
        isLoading,
        error,
      },
      activeTab,
    };
  }

  const id = crypto.randomUUID();
  const receipts: StoredReceipt[] = [{ id, receipt: originalReceipt }];

  // If assignedItems is already nested (string keys), don't wrap again.
  const assignedItems = isV2AssignedItems(rawState.assignedItems)
    ? deserializeV2AssignedItems(rawState.assignedItems)
    : new Map<string, ItemAssignments>([
        [id, deserializeV1InnerAssignments(rawState.assignedItems)],
      ]);

  return {
    state: {
      receipts,
      people,
      groups,
      assignedItems,
      isLoading,
      error,
    },
    activeTab,
  };
}

function assignedItemsFromUnknown(
  raw: unknown,
  receipts: StoredReceipt[]
): Map<string, ItemAssignments> {
  if (isV2AssignedItems(raw)) {
    return deserializeV2AssignedItems(raw);
  }

  // v1 inner shape stored under a v2 receipts array — attach to first receipt
  if (receipts[0] && Array.isArray(raw)) {
    return new Map([
      [receipts[0].id, deserializeV1InnerAssignments(raw)],
    ]);
  }

  return new Map();
}

function isV2AssignedItems(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) {
    return false;
  }
  const first = raw[0];
  if (!Array.isArray(first) || first.length < 2) {
    return false;
  }
  return typeof first[0] === "string";
}

function deserializeV2AssignedItems(raw: unknown): Map<string, ItemAssignments> {
  const result = new Map<string, ItemAssignments>();
  if (!Array.isArray(raw)) {
    return result;
  }

  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) {
      continue;
    }
    const [receiptId, inner] = entry;
    if (typeof receiptId !== "string") {
      continue;
    }
    result.set(receiptId, deserializeV1InnerAssignments(inner));
  }

  return result;
}

function deserializeV1InnerAssignments(raw: unknown): ItemAssignments {
  const inner: ItemAssignments = new Map();
  if (!Array.isArray(raw)) {
    return inner;
  }

  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) {
      continue;
    }
    const [itemIndex, assignments] = entry;
    const index = Number(itemIndex);
    if (!Number.isInteger(index) || !Array.isArray(assignments)) {
      continue;
    }
    inner.set(index, assignments as PersonItemAssignment[]);
  }

  return inner;
}

function parseStoredReceipts(raw: unknown): StoredReceipt[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const receipts: StoredReceipt[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      continue;
    }
    const receipt = parseReceipt(entry.receipt);
    if (!receipt) {
      continue;
    }
    receipts.push({ id: entry.id, receipt });
  }
  return receipts;
}

function parseReceipt(raw: unknown): Receipt | null {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.items) ||
    !isFiniteNonNegativeNumber(raw.subtotal) ||
    !isFiniteNonNegativeNumber(raw.tax) ||
    !isFiniteNonNegativeNumber(raw.total) ||
    typeof raw.currency !== "string" ||
    raw.currency.trim() === ""
  ) {
    return null;
  }
  return raw as unknown as Receipt;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parsePeople(raw: unknown): Person[] {
  return Array.isArray(raw) ? (raw as Person[]) : [];
}

function parseGroups(raw: unknown): Group[] {
  return Array.isArray(raw) ? (raw as Group[]) : [];
}
