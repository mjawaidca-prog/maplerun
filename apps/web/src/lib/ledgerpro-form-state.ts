/**
 * Form-state derivation for the LedgerPro Integrations form (M6).
 *
 * Pure helpers, split out of the client component so the rules are
 * unit-testable at the layer the web test suite supports.
 *
 * Why this exists: the saved LedgerProConnection is the source of truth —
 * a finalize-time sync reads IT, not whatever the form happens to show.
 * The form therefore re-syncs from the saved connection whenever that
 * record changes (see connectionFingerprint). Before this, the form kept
 * its mount-time state forever: after a save + revalidation the displayed
 * mapping mode could disagree with what was persisted (in the live pilot
 * the mode dropdown showed Mode 1 right after a Mode 2 save, until an
 * unrelated re-render restored it) — cosmetic, but exactly the kind of
 * divergence that makes an owner distrust what Test Connection evaluated.
 *
 * Test Connection intentionally evaluates the form's CURRENT values (so
 * an owner can check edits before saving them); once a Save lands, the
 * re-sync below makes "current form values" and "saved connection"
 * identical again, which is what a later finalize will read.
 */

import { DEFAULT_MAPPING, type LedgerProMapping, type MappingMode } from "./ledgerpro-journal";

/** The saved connection as the settings page passes it to the form. */
export interface LedgerProConnectionView {
  baseUrl: string;
  mappingMode: MappingMode;
  mapping: LedgerProMapping;
  syncEnabled: boolean;
  /** The encrypted key exists server-side; the key itself is never sent. */
  hasKey: boolean;
}

/** The editable form fields, as local component state. */
export interface LedgerProFormState {
  baseUrl: string;
  mode: MappingMode;
  mapping: LedgerProMapping;
  syncEnabled: boolean;
}

export const DEFAULT_BASE_URL = "https://ledger.nexvarlab.com";

/** Initial (or re-synced) form state from the saved connection. */
export function formStateFromConnection(connection: LedgerProConnectionView | null): LedgerProFormState {
  if (!connection) {
    return {
      baseUrl: DEFAULT_BASE_URL,
      mode: "MODE1",
      mapping: { ...DEFAULT_MAPPING },
      syncEnabled: false,
    };
  }
  return {
    baseUrl: connection.baseUrl,
    mode: connection.mappingMode,
    mapping: { ...connection.mapping },
    syncEnabled: connection.syncEnabled,
  };
}

/**
 * Stable fingerprint of the SAVED connection. The form compares it
 * against the previous render's: any change means the record on the
 * server changed (a save landed, a disconnect cleared it), so the form
 * re-syncs from it. Equal fingerprints never trigger a reset, so plain
 * re-renders with an equal-but-new prop object don't clobber edits.
 *
 * Mapping keys are serialized in a fixed order (DEFAULT_MAPPING's) so
 * the fingerprint doesn't depend on the stored JSON's key order.
 */
export function connectionFingerprint(connection: LedgerProConnectionView | null): string {
  if (!connection) return "null";
  const mappingInOrder = (Object.keys(DEFAULT_MAPPING) as (keyof LedgerProMapping)[]).map(
    (key) => connection.mapping[key] ?? "",
  );
  return JSON.stringify([
    connection.baseUrl,
    connection.mappingMode,
    connection.syncEnabled,
    connection.hasKey,
    ...mappingInOrder,
  ]);
}
