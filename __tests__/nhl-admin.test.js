import { describe, expect, test, jest } from '@jest/globals';


const { isNhlAdmin, nhlAdminEmails } = require('../lib/nhl-admin');

describe('nhl admin gate', () => {
  test('defaults to the owner email, case-insensitive', () => {
    delete process.env.NHL_ADMIN_EMAILS;
    expect(nhlAdminEmails()).toEqual(['vincentploum@gmail.com']);
    expect(isNhlAdmin({ email: 'VincentPloum@gmail.com' })).toBe(true);
    expect(isNhlAdmin({ email: 'someone@else.com' })).toBe(false);
    expect(isNhlAdmin(null)).toBe(false);
    expect(isNhlAdmin({})).toBe(false);
  });

  test('NHL_ADMIN_EMAILS overrides the list', () => {
    process.env.NHL_ADMIN_EMAILS = ' a@x.com , B@y.com ';
    expect(isNhlAdmin({ email: 'b@y.com' })).toBe(true);
    expect(isNhlAdmin({ email: 'vincentploum@gmail.com' })).toBe(false);
    delete process.env.NHL_ADMIN_EMAILS;
  });
});
