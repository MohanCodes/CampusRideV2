// Some colleges answer to two email domains. Both reach the same inbox, so a student who types the longer
// form is treated as the shorter one: one address, one account. The database still accepts both domains
// (campuses.email_domains), so a code request that skips this app can't be locked out, but this app never sends one.
export const EMAIL_DOMAIN_ALIASES: Record<string, string> = {
  "g.hmc.edu": "hmc.edu",
  "claremontmckenna.edu": "cmc.edu",
};

export function canonicalEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return email;
  const domain = email.slice(at + 1).toLowerCase();
  const canonical = EMAIL_DOMAIN_ALIASES[domain];
  return canonical ? `${email.slice(0, at)}@${canonical}` : email;
}
