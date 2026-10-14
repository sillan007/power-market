/* 나눔의 자리 - 서비스 워커: 앱이 꺼져 있어도 푸시 알림을 화면에 띄웁니다. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

function onPush(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { try { data = { body: event.data.text() }; } catch (e2) { data = {}; } }
  var title = data.title || '나눔의 자리';
  var options = {
    body: data.body || '새 글이 올라왔어요.',
    tag: data.itemId ? 'item-' + data.itemId : 'nanum',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: self.registration.scope }
  };
  // iOS 규칙: 푸시를 받으면 반드시 알림을 보여 줘야 함
  event.waitUntil(self.registration.showNotification(title, options));
}

function onClick(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
      return self.clients.openWindow(url);
    })
  );
}

self.addEventListener('push', onPush);
self.addEventListener('notificationclick', onClick);
