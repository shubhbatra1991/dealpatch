import { z } from "zod";

export const nonEmptyString = z.string().trim().min(1);
export const percentage = z.number().min(0).max(100);
export const isoDate = z.iso.date();
export const isoDateTime = z.iso.datetime();
export const websiteUrl = z.url({ protocol: /^https?$/ });
