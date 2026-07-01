import { generateOutreach } from "@/lib/ai";
import { countSentMessagesToday, createContact } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import type { OutreachMessage } from "@/lib/types";
import {
  defaultPlatformForChannel,
  isOutreachChannel,
  isUsableOutreachContact,
} from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<{
      name?: string;
      title?: string;
      company?: string;
      platform?: string;
      profileUrl?: string;
      channel?: OutreachMessage["channel"];
      companyContext?: string;
      markSent?: boolean | string;
    }>(request);

    if (!body.name?.trim() || !body.title?.trim() || !body.company?.trim()) {
      return jsonError("Name, title, and company are required", 400);
    }

    if (
      !isUsableOutreachContact({
        company: body.company,
        title: body.title,
      })
    ) {
      return jsonError("Detected company and title are required", 400);
    }

    if (body.channel && !isOutreachChannel(body.channel)) {
      return jsonError("Invalid outreach channel", 400);
    }

    const channel = body.channel ?? "linkedin_note";
    const platform = body.platform ?? defaultPlatformForChannel(channel);

    const markSent =
      body.markSent === true ||
      body.markSent === "true" ||
      body.markSent === "on";

    if (
      markSent &&
      channel === "linkedin_note" &&
      countSentMessagesToday(platform, "linkedin_note") >= 15
    ) {
      return jsonError("LinkedIn connection request daily cap reached", 429);
    }

    if (
      markSent &&
      channel === "linkedin_dm" &&
      countSentMessagesToday(platform, "linkedin_dm") >= 10
    ) {
      return jsonError("LinkedIn DM daily cap reached", 429);
    }

    const messageBody = await generateOutreach({
      name: body.name,
      title: body.title,
      company: body.company,
      channel,
      companyContext: body.companyContext,
    });

    const message = {
      channel,
      body: messageBody,
      createdAt: new Date().toISOString(),
    };

    const contact = createContact({
      name: body.name,
      title: body.title,
      company: body.company,
      platform,
      profileUrl: body.profileUrl ?? "",
      status: markSent ? "sent" : "drafted",
      message,
      followUpDate: markSent
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    });

    return jsonOk({ contact, message });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate message",
      500,
    );
  }
}
