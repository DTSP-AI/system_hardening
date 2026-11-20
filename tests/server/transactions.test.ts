import { test, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";
import { callerFor, seedUser } from "../helpers/caller";
import { spyTransactions } from "../helpers/tx-spy";
import { EmailProviderError } from "@/lib/email";
import { sendContactEmail } from "@/server/services/email-send";
import { createAttachment, deleteAttachment } from "@/server/services/attachments";

let spy: ReturnType<typeof spyTransactions>;
beforeEach(async () => {
  await resetDb();
  spy = spyTransactions();
});
afterEach(() => spy.restore());
after(closeDb);

test("an authed query does not open a database transaction", async () => {
  const api = await callerFor(await seedUser());
  await api.lead.list();
  await api.deal.list();
  assert.equal(spy.state.count, 0);
});

test("an authed mutation runs in one transaction and rolls back as a whole", async () => {
  const api = await callerFor(await seedUser());
  const lead = await api.lead.create({ firstName: "Ada", lastName: "Lovelace" });
  spy.state.count = 0;
  // No pipeline stage exists, so convert claims the lead and then fails.
  await assert.rejects(api.lead.convert({ id: lead.id }), /No open pipeline stage/);
  assert.equal(spy.state.count, 1);
  const after = await testDb.lead.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(after.status, "NEW");
});

async function contactWithEmail() {
  return testDb.contact.create({ data: { firstName: "Grace", lastName: "Hopper", email: "grace@example.test" } });
}

test("email send: success leaves one activity marked sent and sends once, outside any transaction", async () => {
  const user = await seedUser();
  const contact = await contactWithEmail();
  const sends: Array<{ idempotencyKey?: string; openTx: number }> = [];

  const activity = await sendContactEmail(
    testDb,
    { actorId: user.clerkUserId!, rateKey: user.id, contactId: contact.id, subject: "Hi", body: "Hello" },
    {
      configured: () => true,
      send: async (input) => {
        sends.push({ idempotencyKey: input.idempotencyKey, openTx: spy.state.open });
        return { from: "crm@example.test", resendId: "re_123" };
      },
    },
  );

  assert.equal(sends.length, 1);
  assert.equal(sends[0].openTx, 0);
  assert.ok(sends[0].idempotencyKey?.includes(activity.id));
  const rows = await testDb.activity.findMany({ where: { type: "EMAIL" } });
  assert.equal(rows.length, 1);
  const meta = rows[0].metadata as { status?: string; resendId?: string; to?: string };
  assert.equal(meta.status, "sent");
  assert.equal(meta.resendId, "re_123");
  assert.equal(meta.to, "grace@example.test");
});

test("email send: a provider failure leaves one activity marked failed and sends at most once", async () => {
  const user = await seedUser();
  const contact = await contactWithEmail();
  let calls = 0;

  await assert.rejects(
    sendContactEmail(
      testDb,
      { actorId: user.clerkUserId!, rateKey: user.id, contactId: contact.id, subject: "Hi", body: "Hello" },
      {
        configured: () => true,
        send: async () => {
          calls += 1;
          throw new EmailProviderError(new Error("rejected"), "rejected");
        },
      },
    ),
    /Email provider rejected the message/,
  );

  assert.equal(calls, 1);
  const rows = await testDb.activity.findMany({ where: { type: "EMAIL" } });
  assert.equal(rows.length, 1);
  assert.equal((rows[0].metadata as { status?: string }).status, "failed");
});

test("email send: unconfigured email records nothing and sends nothing", async () => {
  const user = await seedUser();
  const contact = await contactWithEmail();
  let calls = 0;
  await assert.rejects(
    sendContactEmail(
      testDb,
      { actorId: user.clerkUserId!, rateKey: user.id, contactId: contact.id, subject: "Hi", body: "Hello" },
      {
        configured: () => false,
        send: async () => {
          calls += 1;
          return { from: "x", resendId: "y" };
        },
      },
    ),
    /Email isn.t configured/,
  );
  assert.equal(calls, 0);
  assert.equal(await testDb.activity.count(), 0);
});

test("email.send through the router reports unconfigured email without opening a transaction", async () => {
  const api = await callerFor(await seedUser());
  const contact = await contactWithEmail();
  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    api.email.send({ contactId: contact.id, subject: "Hi", body: "Hello" }),
    /Email isn.t configured/,
  );
  assert.equal(spy.state.count, 0);
});

const BLOB_PATH = "attachments/contact/CONTACT_ID/0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.pdf";

test("attachment create looks up storage before any transaction opens, then writes the row and its audit", async () => {
  const user = await seedUser();
  const contact = await contactWithEmail();
  const path = BLOB_PATH.replace("CONTACT_ID", contact.id);
  let openDuringHead = -1;

  const created = await createAttachment(
    testDb,
    { actorId: user.clerkUserId!, entityType: "CONTACT", entityId: contact.id, fileName: "quote.pdf", blobPathname: path },
    {
      head: async () => {
        openDuringHead = spy.state.open;
        return { size: 1234 };
      },
    },
  );

  assert.equal(openDuringHead, 0);
  assert.equal(created.fileSize, 1234);
  assert.equal(await testDb.attachment.count(), 1);
  assert.equal(await testDb.auditLog.count({ where: { entityType: "ATTACHMENT", action: "CREATE" } }), 1);
});

test("attachment delete removes the row and audit in a transaction, then deletes the blob outside it", async () => {
  const user = await seedUser();
  const contact = await contactWithEmail();
  const path = BLOB_PATH.replace("CONTACT_ID", contact.id);
  const created = await createAttachment(
    testDb,
    { actorId: user.clerkUserId!, entityType: "CONTACT", entityId: contact.id, fileName: "quote.pdf", blobPathname: path },
    { head: async () => ({ size: 10 }) },
  );
  let openDuringDel = -1;
  let rowsDuringDel = -1;

  await deleteAttachment(
    testDb,
    { actorId: user.clerkUserId!, actorRole: "MEMBER", id: created.id },
    {
      del: async () => {
        openDuringDel = spy.state.open;
        rowsDuringDel = await testDb.attachment.count();
      },
    },
  );

  assert.equal(openDuringDel, 0);
  assert.equal(rowsDuringDel, 0);
  assert.equal(await testDb.auditLog.count({ where: { entityType: "ATTACHMENT", action: "DELETE" } }), 1);
});

test("a member cannot delete another user's attachment", async () => {
  const owner = await seedUser();
  const other = await seedUser();
  const contact = await contactWithEmail();
  const created = await createAttachment(
    testDb,
    {
      actorId: owner.clerkUserId!,
      entityType: "CONTACT",
      entityId: contact.id,
      fileName: "q.pdf",
      blobPathname: BLOB_PATH.replace("CONTACT_ID", contact.id),
    },
    { head: async () => ({ size: 10 }) },
  );
  await assert.rejects(
    deleteAttachment(
      testDb,
      { actorId: other.clerkUserId!, actorRole: "MEMBER", id: created.id },
      { del: async () => {} },
    ),
    /permission/,
  );
  assert.equal(await testDb.attachment.count(), 1);
});

test("attachment.create through the router opens no transaction around the storage lookup", async () => {
  const api = await callerFor(await seedUser());
  const contact = await contactWithEmail();
  // No storage token in tests, so the lookup fails; what matters is that no transaction was open for it.
  await assert.rejects(
    api.attachment.create({
      entityType: "CONTACT",
      entityId: contact.id,
      fileName: "quote.pdf",
      blobPathname: BLOB_PATH.replace("CONTACT_ID", contact.id),
    }),
  );
  assert.equal(spy.state.count, 0);
  assert.equal(await testDb.attachment.count(), 0);
});

test("email send: an unknown outcome (network error or timeout) is recorded as unconfirmed, not failed", async () => {
  const user = await seedUser();
  const contact = await contactWithEmail();
  await assert.rejects(
    sendContactEmail(
      testDb,
      { actorId: user.clerkUserId!, rateKey: user.id, contactId: contact.id, subject: "Hi", body: "Hello" },
      {
        configured: () => true,
        send: async () => {
          throw new EmailProviderError(new Error("socket hang up"), "unknown");
        },
      },
    ),
    /could not be confirmed/,
  );
  const rows = await testDb.activity.findMany({ where: { type: "EMAIL" } });
  assert.equal(rows.length, 1);
  assert.equal((rows[0].metadata as { status?: string }).status, "unconfirmed");
});

test("email send: if recording the result fails after the provider accepted, the caller still gets success", async () => {
  const user = await seedUser();
  const contact = await contactWithEmail();
  const activities = testDb.activity as unknown as { update: (...args: unknown[]) => Promise<unknown> };
  const original = activities.update.bind(testDb.activity);
  let calls = 0;
  activities.update = async () => {
    calls += 1;
    throw new Error("database went away");
  };
  try {
    const activity = await sendContactEmail(
      testDb,
      { actorId: user.clerkUserId!, rateKey: user.id, contactId: contact.id, subject: "Hi", body: "Hello" },
      { configured: () => true, send: async () => ({ from: "crm@example.test", resendId: "re_9" }) },
    );
    assert.equal((activity.metadata as { status?: string }).status, "sent");
    assert.equal(calls, 1);
  } finally {
    activities.update = original;
  }
});
