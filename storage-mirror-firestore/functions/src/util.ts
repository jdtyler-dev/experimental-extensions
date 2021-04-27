import config from "./config";
import * as crypto from "crypto";

/**
 * Returns all the key-value pairs in an Object that match the given filter RegEx.
 * @param o The Object to filter.
 * @param filter The RegEx expression to match with.
 */
export function filterObjectFields(
  o: Object,
  filter: RegExp
): { key: string; value: any }[] {
  const ret: { key: string; value: any }[] = [];
  Object.entries(o).forEach((e) => {
    const key = e[0];
    const value = e[1];
    if (key.match(filter) !== null) {
      ret.push({ key, value });
    }
  });
  return ret;
}

/**
 * Returns whether the event is an Object Archiving or Object Deletion.
 * @param eventType The event type.
 */
export function isDeletionEventType(eventType: string): boolean {
  return (
    eventType === "google.storage.object.delete" ||
    eventType === "google.storage.object.archive"
  );
}

/**
 * Returns whether an a Document name (includes Prefixes) is valid in Firestore.
 * https://firebase.google.com/docs/firestore/quotas#collections_documents_and_fields
 * @param name The name to validate. e.g. `gcs/foo/bar.jpg`
 */
export function isValidDocumentName(name: string): boolean {
  // Cannot be more than 100 subcollections deep.
  if (name.split("/").length > 100) return false;
  // Cannot be larger than 6 KiB.
  if (new Buffer(name).byteLength > 6144) return false;
  return true;
}

/**
 * Returns whether a id is valid for a Document in Firestore.
 * https://firebase.google.com/docs/firestore/quotas#collections_documents_and_fields
 * @param id The id to validate. e.g. `image.jpg`
 */
export function isValidDocumentId(id: string): boolean {
  // Cannot be empty.
  if (id.length === 0) return false;
  // Must be no longer than 1500 bytes.
  if (new Buffer(id).byteLength > 1500) return false;
  // Cannot solely consist of a single or double period.
  if (id === "." || id === "..") return false;
  // Cannot match this regex.
  if (id.match(new RegExp("__.*__"))) return false;
  return true;
}

/**
 * Returns whether an Object should be mirrored (matches the configured RegEx).
 * @param name The name of the Object.
 */
export function shouldMirrorObject(name: string): boolean {
  return name.match(config.objectNameFilter) !== null;
}

// All the relevant Item Document and Prefix Document paths for a given GCS Object name.
export interface DocumentPaths {
  prefixPaths: string[];
  itemPath: string;
}

/**
 * Returns the Firestore Paths to all the Prefix Documents and the Item Document
 * for a given GCS Object name. `prefixPaths` is sorted from the root to the parent
 * prefix just before the item path.
 * @param name The name of the Object.
 */
export function objectNameToFirestorePaths(name: string): DocumentPaths {
  const parts = name.split("/");
  const fileName = parts[parts.length - 1];
  // Build array of prefixes for the Object.
  let prefix = `${config.firestoreRoot}`;
  const prefixes = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    prefix += `/${config.prefixesSubcollectionName}/${part}`;
    prefixes.push(prefix);
  }
  return {
    prefixPaths: prefixes,
    itemPath: `${prefix}/${config.itemsSubcollectionName}/${fileName}`,
  };
}

/**
 * Returns the relevant Tombstone path for any Item Document or Prefix Document path.
 * @param path The Item Document or Prefix Document path. This is assumed to be a valid Document path
 * that was generated by the extension (through the `objectNameToFirestorePaths` function or similar).
 */
export function mirrorDocumentPathToTombstonePath(path: string): string {
  const parts = path.split("/");
  if (parts[parts.length - 2] === config.itemsSubcollectionName) {
    // Tombstone path for an Item Document.
    parts[parts.length - 2] = config.itemsTombstoneSubcollectionName;
  } else if (parts[parts.length - 2] === config.prefixesSubcollectionName) {
    // Tombstone path for an Prefix Document.
    parts[parts.length - 2] = config.prefixesTombstoneSubcollectionName;
  } else {
    throw "Invalid Mirror Document Path.";
  }
  return parts.join("/");
}

/**
 * Returns a hash of the Firestore Document path.
 * @param path The Document path
 */
export function pathHash(path: string): string {
  const hash = crypto
    .createHash("md5")
    .update(path)
    .digest("hex");
  return hash;
}
