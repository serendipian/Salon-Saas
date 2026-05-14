import { describe, expect, it } from 'vitest';
import { getInvitationDisplayInfo } from './getInvitationDisplayInfo';

describe('getInvitationDisplayInfo', () => {
  it('returns initials from first + last name', () => {
    const info = getInvitationDisplayInfo({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane.doe@test.local',
    });
    expect(info.initials).toBe('JD');
    expect(info.primaryLine).toBe('Jane Doe');
    expect(info.secondaryLine).toBe('jane.doe@test.local');
  });

  it('falls back to first letter of first name when last name missing', () => {
    const info = getInvitationDisplayInfo({
      first_name: 'Jane',
      last_name: null,
      email: 'j@test.local',
    });
    expect(info.initials).toBe('J');
    expect(info.primaryLine).toBe('Jane');
    expect(info.secondaryLine).toBe('j@test.local');
  });

  it('uses email when both names are missing', () => {
    const info = getInvitationDisplayInfo({
      first_name: null,
      last_name: null,
      email: 'lone@test.local',
    });
    expect(info.initials).toBe('L');
    expect(info.primaryLine).toBe('lone@test.local');
    expect(info.secondaryLine).toBe('');
  });

  it('uses em-dash when name and email are all null (legacy rows)', () => {
    const info = getInvitationDisplayInfo({
      first_name: null,
      last_name: null,
      email: null,
    });
    expect(info.initials).toBe('—');
    expect(info.primaryLine).toBe('—');
    expect(info.secondaryLine).toBe('');
  });

  it('handles whitespace-only name as missing', () => {
    const info = getInvitationDisplayInfo({
      first_name: '   ',
      last_name: '',
      email: 'ws@test.local',
    });
    expect(info.initials).toBe('W');
    expect(info.primaryLine).toBe('ws@test.local');
  });

  it('uppercases initials regardless of input casing', () => {
    const info = getInvitationDisplayInfo({
      first_name: 'jane',
      last_name: 'doe',
      email: 'j@test.local',
    });
    expect(info.initials).toBe('JD');
  });
});
