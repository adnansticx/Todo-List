import { supabase } from "../../lib/supabase";
import { VAPID_PUBLIC_KEY } from "./vapidPublicKey";

const urlBase64ToUint8Array = (value) => {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
};

export const canSchedulePush = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  window.isSecureContext;

export async function registerDevicePush(listId) {
  if (!canSchedulePush() || !supabase || !listId) {
    return { ok: false, reason: "unsupported" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, reason: Notification.permission };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, reason: "incomplete" };
  }

  const { error } = await supabase.rpc("register_push_device", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_list_id: listId,
    p_origin: window.location.origin,
  });

  if (error) return { ok: false, reason: "server" };
  return { ok: true };
}
