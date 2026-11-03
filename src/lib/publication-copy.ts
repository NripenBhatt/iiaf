/** No-provider writing from attributable values. This is a local draft, not the
 * source-event-1 body checked by the database; saved content is never rewritten. */
export type PublicationFields = Partial<Record<"title" | "date" | "time" | "venue" | "subject" | "institutions" | "audience" | "organizer" | "host" | "facilitator", string | undefined>>;
export type PublicationChannel = "press_release" | "website_event" | "linkedin" | "facebook" | "instagram" | "x_post";

const sentenceValue = (value: string) => value.trim().replace(/[.:;]+$/, "");
const labelledValue = (value: string, label: RegExp) => sentenceValue(value.replace(label, ""));

export function publicationCopy(channel: PublicationChannel, fields: PublicationFields): string {
  const title = fields.title ?? "";
  const subject = fields.subject ? sentenceValue(fields.subject) : undefined;
  const organizer = fields.organizer ? labelledValue(fields.organizer, /^organis?ed by\s+/i) : undefined;
  const host = fields.host ? labelledValue(fields.host, /^hosted by\s+/i) : undefined;
  const facilitator = fields.facilitator ? labelledValue(fields.facilitator, /^and conducted by\s+/i) : undefined;
  const audience = fields.audience ? sentenceValue(fields.audience) : undefined;
  const lead = `${title} is announced${fields.date ? ` for ${fields.date}` : " in the source document"}${fields.time ? ` at ${fields.time}` : ""}${fields.venue ? `, at ${sentenceValue(fields.venue)}` : ""}.`;
  const focus = subject ? `The announced programme focuses on ${subject}.` : undefined;
  const people = [organizer ? `The source names ${organizer} as the organizer.` : undefined, host ? `${host} is named as the host.` : undefined, facilitator ? `The source identifies ${facilitator} as conducting the programme.` : undefined, fields.institutions ? `The institutions listed in the source are ${sentenceValue(fields.institutions)}.` : undefined].filter(Boolean).join(" ");
  const details = [fields.date ? `Printed date: ${fields.date}` : undefined, fields.time ? `Printed time: ${fields.time}` : undefined, fields.venue ? `Venue: ${fields.venue}` : undefined, organizer ? `Organizer: ${organizer}` : undefined, host ? `Host: ${host}` : undefined, facilitator ? `Conducting organization: ${facilitator}` : undefined].filter(Boolean).join("\n");
  const review = "This is an announcement, not confirmation that the event took place. Attendance, outcomes and completion are not established by the source. Human review is required before publication.";
  const join = (parts: (string | undefined)[]) => parts.filter(Boolean).join("\n\n");
  switch (channel) {
    case "press_release": return join([title, "Summary", lead, "Programme focus", focus, audience ? `The source describes the intended audience as “${audience}”.` : undefined, people ? "Organizers and participating institutions" : undefined, people || undefined, details ? "Event information from the source" : undefined, details || undefined, "Source and verification", review]);
    case "website_event": return join([title, "Event overview", lead, focus, audience ? `Audience: ${audience}` : undefined, details ? "Event details" : undefined, details || undefined, people || undefined, "Publication status", review]);
    case "linkedin": return join([title, focus ?? lead, audience ? `The programme is described as “${audience}”.` : undefined, subject ? lead : undefined, people || undefined, "Source-backed announcement · attendance and outcomes unconfirmed · review required."]);
    case "facebook": return join([`Workshop announcement: ${title}`, lead, focus, audience ? `For: ${audience}` : undefined, organizer ? `Organized by ${organizer}.` : undefined, "Announcement only · please check the original event notice. Review required."]);
    case "instagram": return join([title, subject, [fields.date ? `Printed date · ${fields.date}` : undefined, fields.venue ? `Venue · ${fields.venue}` : undefined].filter(Boolean).join("\n"), "Source-backed announcement · review required. Attendance and outcomes unconfirmed."]);
    case "x_post": return join([lead, "Announcement only · review required."]);
  }
}