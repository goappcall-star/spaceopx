const fs = require("node:fs/promises");
exports.createPermissionStore = async (file) => {
  let values = {};
  try {
    values = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {}
  let queue = Promise.resolve();
  return {
    get: (key) => values[key],
    async set(key, value) {
      queue = queue
        .catch(() => {})
        .then(async () => {
          const updated = { ...values, [key]: value };
          await fs.writeFile(file + ".tmp", JSON.stringify(updated));
          await fs.rename(file + ".tmp", file);
          values = updated;
        });
      await queue;
    },
  };
};
