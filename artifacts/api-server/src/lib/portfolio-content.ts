import { z } from "zod/v4";

const trimmedText = (maximum: number) =>
  z.string().trim().max(maximum);

const bookingSchema = z.object({
  enabled: z.boolean(),
  url: trimmedText(2048),
  timezone: z.string().trim().min(1).max(100),
  availability: trimmedText(2000),
});

const availabilitySchema = z.object({
  published: z.boolean(),
  roles: trimmedText(2000),
  workArrangement: trimmedText(1000),
  locations: trimmedText(1000),
  joining: trimmedText(1000),
});

const certificateSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: trimmedText(200),
  issuer: trimmedText(200),
  completed: trimmedText(10),
  verificationUrl: trimmedText(2048),
  published: z.boolean(),
});

const recommendationSchema = z.object({
  id: z.string().trim().min(1).max(100),
  author: trimmedText(160),
  relationship: trimmedText(160),
  text: trimmedText(3000),
  consent: z.boolean(),
  approved: z.boolean(),
  published: z.boolean(),
});

export const portfolioContentInputSchema = z.object({
  booking: bookingSchema,
  availability: availabilitySchema,
  certificates: z.array(certificateSchema).max(30),
  recommendations: z.array(recommendationSchema).max(30),
});

export type PortfolioContentDocument = z.infer<typeof portfolioContentInputSchema>;

export const defaultPortfolioContent: PortfolioContentDocument = {
  booking: {
    enabled: false,
    url: "",
    timezone: "Asia/Kolkata",
    availability: "",
  },
  availability: {
    published: false,
    roles: "",
    workArrangement: "",
    locations: "",
    joining: "",
  },
  certificates: [],
  recommendations: [],
};

export function isSafeHttpsUrl(value: string): boolean {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validatePortfolioContent(input: unknown):
  | { success: true; data: PortfolioContentDocument }
  | { success: false; error: string } {
  const parsed = portfolioContentInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Check all portfolio fields and length limits." };
  const content = parsed.data;

  if (!isValidTimezone(content.booking.timezone)) {
    return { success: false, error: "Choose a valid IANA timezone." };
  }
  if (!isSafeHttpsUrl(content.booking.url)) {
    return { success: false, error: "Booking URL must be a safe HTTPS URL or blank." };
  }
  if (
    content.booking.enabled &&
    (!content.booking.url || !content.booking.availability)
  ) {
    return { success: false, error: "Enabled booking requires a URL and availability details." };
  }

  for (const certificate of content.certificates) {
    if (!isSafeHttpsUrl(certificate.verificationUrl)) {
      return { success: false, error: "Certificate verification links must be safe HTTPS URLs or blank." };
    }
    if (certificate.completed && !isValidCalendarDate(certificate.completed)) {
      return { success: false, error: "Certificate completion dates must be valid YYYY-MM-DD dates." };
    }
    if (
      certificate.published &&
      (!certificate.title || !certificate.issuer || !isValidCalendarDate(certificate.completed))
    ) {
      return { success: false, error: "Published certificates require a title, issuer, and valid completion date." };
    }
  }

  if (content.recommendations.some((entry) =>
    entry.published &&
    (!entry.consent || !entry.approved || !entry.author || !entry.relationship || !entry.text)
  )) {
    return { success: false, error: "Published recommendations require consent, approval, author, relationship, and text." };
  }

  const ids = [...content.certificates, ...content.recommendations].map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) {
    return { success: false, error: "Portfolio entry IDs must be unique." };
  }

  return { success: true, data: content };
}

export function publicPortfolioContent(content: PortfolioContentDocument): PortfolioContentDocument {
  return {
    booking: {
      ...content.booking,
      timezone: content.booking.enabled ? content.booking.timezone : "UTC",
      url: content.booking.enabled ? content.booking.url : "",
      availability: content.booking.enabled ? content.booking.availability : "",
    },
    availability: {
      ...content.availability,
      roles: content.availability.published ? content.availability.roles : "",
      workArrangement: content.availability.published ? content.availability.workArrangement : "",
      locations: content.availability.published ? content.availability.locations : "",
      joining: content.availability.published ? content.availability.joining : "",
    },
    certificates: content.certificates.filter((entry) => entry.published),
    recommendations: content.recommendations.filter(
      (entry) => entry.published && entry.consent && entry.approved,
    ),
  };
}