const { Storage } = require("@google-cloud/storage");

(async () => {
  try {
    const storage = new Storage(); // ADC por archivo
    const [buckets] = await storage.getBuckets();
    console.log("Buckets en el proyecto:");
    for (const b of buckets) console.log(" -", b.name);
  } catch (e) {
    console.error("Error listando buckets:", e.message);
    process.exit(1);
  }
})();