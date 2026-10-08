import { QueryClient } from "@tanstack/react-query";

/** One client per mounted provider; never share a server cache between requests. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: false,
        // IndexedDB reads do not depend on connectivity.
        networkMode: "always",
      },
      mutations: {
        retry: false,
        networkMode: "always",
      },
    },
  });
}
