import { z } from "zod";
import { TITLE_TYPES } from "./pods";

const nairaAmount = z.coerce.number().positive().max(1_000_000_000);
const phone = z.string().trim().regex(/^\+?234\d{10}$|^0\d{10}$/, "Use a Nigerian number, e.g. 08012345678");
export const password = z
  .string()
  .min(10, "At least 10 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");

export const signUpSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone,
  password,
  nextOfKinName: z.string().trim().min(3).max(120),
  nextOfKinPhone: phone,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const kycTier2Schema = z.object({
  bvn: z.string().regex(/^\d{11}$/, "BVN is 11 digits"),
  nin: z.string().regex(/^\d{11}$/, "NIN is 11 digits").optional().or(z.literal("")),
  address: z.string().trim().min(10).max(300),
  state: z.string().trim().min(2).max(60),
  bankCode: z.string().regex(/^\d{3,6}$/),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number is 10 digits"),
});

export const depositSchema = z.object({
  amountNaira: nairaAmount.min(100),
  method: z.enum(["card", "transfer", "ussd"]),
});

export const goalSchema = z.object({
  name: z.string().trim().min(2).max(80),
  targetNaira: nairaAmount,
});

export const withdrawalQuoteSchema = z.object({ amountNaira: nairaAmount.min(100) });
export const withdrawalConfirmSchema = z.object({ quoteId: z.string().uuid(), password: z.string().min(1).max(128) });

export const claimQuoteSchema = z.object({ podId: z.string().uuid() });
export const claimConfirmSchema = z.object({ quoteId: z.string().uuid(), acceptTerms: z.literal(true) });

export const parcelSchema = z.object({
  title: z.string().trim().min(3).max(140),
  locationText: z.string().trim().min(3).max(200),
  state: z.string().trim().min(2).max(60),
  lga: z.string().trim().min(2).max(80),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  sizeSqm: z.coerce.number().int().positive(),
  titleType: z.enum(TITLE_TYPES),
  hasSurveyPlan: z.coerce.boolean(),
  description: z.string().trim().max(2000).default(""),
});

export const podSchema = z.object({
  parcelId: z.string().uuid(),
  acquisitionNaira: nairaAmount,
  syndicatedNaira: nairaAmount,
  slotCount: z.coerce.number().int().refine((n) => n === 5 || n === 6, "5 or 6 slots"),
  legalFeeBp: z.coerce.number().int().min(200).max(500),
}).refine((v) => v.syndicatedNaira >= v.acquisitionNaira, { message: "Syndicated price must be at least the acquisition cost", path: ["syndicatedNaira"] });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type KycTier2Input = z.infer<typeof kycTier2Schema>;
export type ParcelInput = z.infer<typeof parcelSchema>;
export type PodInput = z.infer<typeof podSchema>;
