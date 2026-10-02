type Email = { emailAddress: string; verification?: { status: string } | null };

// Check Clerk's server-side user record, never a client-submitted email or claim.
export function hasVerifiedOwnerEmail(emails: Email[], ownerEmail: string | undefined): boolean {
  const owner = ownerEmail?.trim().toLowerCase();
  return Boolean(owner && emails.some((email) =>
    email.verification?.status === "verified" && email.emailAddress.toLowerCase() === owner,
  ));
}