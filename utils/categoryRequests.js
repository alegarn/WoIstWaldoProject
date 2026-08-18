import { buildE2ECategories, isE2EMode } from './e2eMode';
import { getDefaultCategories } from '../constants/defaultCategories';

// Public default categories are bundled; no server fetch.
// E2E mode returns its own stub.
export async function getCategories({ context }) {
  if (isE2EMode()) {
    return { data: buildE2ECategories() };
  }

  return getDefaultCategories();
}
