export function isPackSourceFactReviewed(metadata: unknown): boolean {
  return typeof metadata !== "object" ||
    metadata === null ||
    !("verificationStatus" in metadata) ||
    metadata.verificationStatus !== "needs-review";
}