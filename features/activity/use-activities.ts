"use client";

import { isServer, queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { activityRepository } from "../../lib/repositories/activities";

export const activitiesQueryOptions = queryOptions({ queryKey: queryKeys.activities.list, queryFn: () => activityRepository.getAll(), enabled: !isServer });
export const useActivities = () => useQuery(activitiesQueryOptions);
