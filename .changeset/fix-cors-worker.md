---
"@zod-monaco/monaco": patch
---

Fix CORS error when loading Monaco workers from CDN by switching from getWorkerUrl to getWorker with blob proxy using importScripts(). Also handle cases where Monaco or AMD loader is already present on the page.
