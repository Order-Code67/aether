import { ingestMspPollBytes } from "@/lib/mspStatusPoll";
import { ingestMspTransactionBytes } from "@/lib/mspTransaction";

/** Route serial bytes to any active MSP poll / transaction. */
export function ingestMspBytes(bytes: number[] | Uint8Array): void {
  ingestMspPollBytes(bytes);
  ingestMspTransactionBytes(bytes);
}
