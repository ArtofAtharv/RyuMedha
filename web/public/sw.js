self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Ryu Medha", body: "You have a new notification!", url: "/dashboard" };

  const options = {
    body: data.body,
    icon: "/icon.png", // Assuming you have an icon at public/icon.png
    badge: "/badge.png", // Assuming a badge
    vibrate: [100, 50, 100],
    data: {
      url: data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
