import { createWriteStream } from "node:fs";
import path from "node:path";
import archiver from "archiver";

export function createPackageZip(outputPath, { manifest, previewPath, sourceFiles }) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    archive.file(previewPath, { name: "preview.png" });
    archive.file(previewPath, { name: "images/base_pet.png" });

    for (const [index, filePath] of sourceFiles.entries()) {
      archive.file(filePath, { name: `source/source-${index}${path.extname(filePath) || ".bin"}` });
    }

    archive.finalize();
  });
}
