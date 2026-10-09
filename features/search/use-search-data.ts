"use client";

import { useContactCore } from "../contacts/use-contacts";
import { useAllProposals } from "../reviews/use-proposals";

export function useSearchData() {
  return { ...useContactCore(), proposals: useAllProposals() };
}
