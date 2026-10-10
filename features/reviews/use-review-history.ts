"use client";

import { isServer, queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { auditRepository } from "../../lib/repositories/audit";

export const reviewHistoryAuditOptions = queryOptions({ queryKey: queryKeys.audit.list, queryFn: () => auditRepository.getAll(), enabled: !isServer });
export function useReviewHistoryAudit() { return useQuery(reviewHistoryAuditOptions); }
