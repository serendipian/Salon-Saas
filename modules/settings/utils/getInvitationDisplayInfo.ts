interface InvitationDisplayInput {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface InvitationDisplayInfo {
  initials: string;
  primaryLine: string;
  secondaryLine: string;
}

export function getInvitationDisplayInfo(row: InvitationDisplayInput): InvitationDisplayInfo {
  const firstName = row.first_name?.trim() || '';
  const lastName = row.last_name?.trim() || '';
  const email = row.email?.trim() || '';

  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  if (fullName) {
    const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase();
    return {
      initials,
      primaryLine: fullName,
      secondaryLine: email,
    };
  }

  if (email) {
    return {
      initials: (email[0] ?? '').toUpperCase(),
      primaryLine: email,
      secondaryLine: '',
    };
  }

  return { initials: '—', primaryLine: '—', secondaryLine: '' };
}
