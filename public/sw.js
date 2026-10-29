self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || `${self.location.origin}/`;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }

        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.focus().then((focused) => {
              if (focused && "navigate" in focused) {
                return focused.navigate(targetUrl);
              }
              return focused;
            });
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Todo reminder";
  const options = {
    body: payload.body || "",
    tag: payload.tag,
    icon: "/todo.svg",
    data: {
      url: payload.url || `${self.location.origin}/`,
      id: payload.id,
      listId: payload.listId,
      remindAt: payload.remindAt,
      content: payload.body || "",
    },
  };

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        const visible = windowClients.some(
          (client) => client.visibilityState === "visible"
        );
        windowClients.forEach((client) => {
          client.postMessage({
            type: "REMINDER_PUSH",
            todo: {
              id: payload.id,
              listId: payload.listId,
              remindAt: payload.remindAt,
              content: payload.body || "",
            },
          });
        });
        if (visible) return undefined;
        return self.registration.showNotification(title, options);
      })
  );
});
