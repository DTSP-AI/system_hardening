import twilio from "twilio";
import { readValidatedTwilioForm } from "@/lib/twilio/validate";

// Twilio's "whisper" callback: requested once the dialed party answers,
// TwiML returned here plays to that leg alone, then Twilio auto-joins it
// into the bridge with the agent -- see the `url` on dial.number() in
// ../route.ts for why this is the leg that actually needs the disclosure.
export async function POST(req: Request) {
  const params = await readValidatedTwilioForm(req);
  if (!params) {
    return new Response("Invalid signature", { status: 403 });
  }

  const response = new twilio.twiml.VoiceResponse();
  response.say("This call may be recorded for quality and training purposes.");

  return new Response(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
