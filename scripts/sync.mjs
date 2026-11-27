import { copyFile } from "node:fs/promises";
for (const file of ["core.mjs", "desk.mjs", "desk.css"]) {
  await copyFile(new URL("../extension/" + file, import.meta.url), new URL("../docs/assets/" + file, import.meta.url));
}
await copyFile(new URL("../extension/icons/32.png", import.meta.url), new URL("../docs/assets/icon.png", import.meta.url));
