// Session-scoped mark for the private-groups intro sheet (A-modal).
// When A displayed this session, the groups tutorial (C-modal) is deferred
// to the next session's first GroupsListScreen entry. Module singleton,
// mirroring resetGroupHubStore() test-reset conventions.
let introShownThisSession = false;

export function hasIntroShownThisSession() {
  return introShownThisSession;
}

export function markIntroShownThisSession() {
  introShownThisSession = true;
}

export function resetGroupsIntroSessionForTests() {
  introShownThisSession = false;
}
