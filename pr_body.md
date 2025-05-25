## Feat: Cache session data in local browser storage and add 'New Split' button

Implements [#16](https://github.com/narulaskaran/receipt-splitter/issues/16):

- Caches the entire receipt split session (receipt, people, assignments, and current tab) in localStorage under the key `receiptSplitterSession`.
- On page load, restores the session if present, so users don't lose progress if they navigate away or reload.
- Adds a **New Split** button to the right of the "Receipt Splitter" heading. This button:
  - Wipes the localStorage session and resets the app to its initial state.
  - Is only enabled if there is session data stored.
- The session is updated in localStorage on any state or tab change.
- UI/UX matches the [issue screenshot](https://github.com/narulaskaran/receipt-splitter/issues/16) and requirements.

This improves user experience by preventing accidental data loss and making it easy to start a new split.

---

- All changes are documented in `CURSOR.md` as per project conventions.
- No breaking changes.
