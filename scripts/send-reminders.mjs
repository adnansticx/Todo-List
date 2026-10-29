import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import webpush from "web-push";

const CATCH_UP_MS = 12 * 60 * 60 * 1000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const publicKeyFile = fs.readFileSync(
  path.join(root, "src/projects/Todo/vapidPublicKey.js"),
  "utf8"
);
const publicKey = publicKeyFile.match(/"([^"]+)"/)?.[1];
const privateKey = process.env.VAPID_PRIVATE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!publicKey || !privateKey || !dbPassword) {
  console.log("missing reminder sender configuration");
  process.exit(1);
}

webpush.setVapidDetails(
  "https://adnan-todo.netlify.app",
  publicKey,
  privateKey
);

const deliveryKey = (todoId, remindAt) =>
  `${todoId}|${new Date(remindAt).toISOString()}`;

const client = new pg.Client({
  host: "aws-0-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.kzdjaxeeoxwmokvqxmjg",
  database: "postgres",
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

await client.connect();

try {
  const now = Date.now();
  const from = new Date(now - CATCH_UP_MS).toISOString();
  const until = new Date(now).toISOString();
  const todos = await client.query(
    `select id, list_id, task, remind_at
     from public.todos
     where completed = false
       and remind_at is not null
       and remind_at >= $1
       and remind_at <= $2
     order by remind_at
     limit 100`,
    [from, until]
  );

  if (todos.rows.length === 0) {
    console.log("checked 0 sent 0");
    process.exit(0);
  }

  const deliveries = await client.query(
    `select todo_id, remind_at
     from public.reminder_deliveries
     where remind_at >= $1`,
    [from]
  );
  const alreadySent = new Set(
    deliveries.rows.map((row) => deliveryKey(row.todo_id, row.remind_at))
  );
  const pending = todos.rows.filter(
    (todo) => !alreadySent.has(deliveryKey(todo.id, todo.remind_at))
  );

  if (pending.length === 0) {
    console.log(`checked ${todos.rows.length} sent 0`);
    process.exit(0);
  }

  const listIds = [...new Set(pending.map((todo) => todo.list_id))];
  const links = await client.query(
    `select list_id, subscription_id
     from public.push_subscription_lists
     where list_id = any($1::text[])`,
    [listIds]
  );
  const subscriptionIds = [
    ...new Set(links.rows.map((row) => row.subscription_id)),
  ];
  const subscriptions = new Map();

  if (subscriptionIds.length > 0) {
    const rows = await client.query(
      `select id, endpoint, p256dh, auth, origin
       from public.push_subscriptions
       where id = any($1::uuid[])`,
      [subscriptionIds]
    );
    for (const row of rows.rows) subscriptions.set(row.id, row);
  }

  const linksByList = new Map();
  for (const link of links.rows) {
    const current = linksByList.get(link.list_id) ?? [];
    current.push(link.subscription_id);
    linksByList.set(link.list_id, current);
  }

  let sent = 0;

  for (const todo of pending) {
    let delivered = false;
    for (const subscriptionId of linksByList.get(todo.list_id) ?? []) {
      const subscription = subscriptions.get(subscriptionId);
      if (!subscription) continue;

      const payload = JSON.stringify({
        title: "Todo reminder",
        body: todo.task,
        tag: `todo-${todo.id}`,
        url: `${subscription.origin}/list/${todo.list_id}`,
        id: todo.id,
        listId: todo.list_id,
        remindAt: todo.remind_at,
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          {
            TTL: CATCH_UP_MS / 1000,
            urgency: "high",
            topic: String(todo.id).replaceAll("-", "").slice(0, 32),
          }
        );
        delivered = true;
      } catch (error) {
        const status = error?.statusCode;
        if (status === 404 || status === 410) {
          await client.query(
            "delete from public.push_subscriptions where id = $1",
            [subscription.id]
          );
          subscriptions.delete(subscription.id);
        }
      }
    }

    if (delivered) {
      const inserted = await client.query(
        `insert into public.reminder_deliveries (todo_id, remind_at)
         values ($1, $2)
         on conflict do nothing`,
        [todo.id, todo.remind_at]
      );
      if (inserted.rowCount > 0) sent += 1;
    }
  }

  console.log(`checked ${todos.rows.length} sent ${sent}`);
} finally {
  await client.end();
}
