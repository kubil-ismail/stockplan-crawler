import fs from "fs";
import path from "path";
import { ZipArchive } from "archiver";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

export function folderExists(folderPath) {
  return fs.existsSync(folderPath);
}

export function createFolder(folderPath) {
  if (!folderExists(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

export async function zipFolder(sourceFolder, outputZipPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(sourceFolder)) {
      return reject(
        new Error(`Source folder tidak ditemukan: ${sourceFolder}`)
      );
    }

    const outputDir = path.dirname(outputZipPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const output = fs.createWriteStream(outputZipPath);

    const archive = new ZipArchive({
      zlib: { level: 9 },
    });

    output.on("close", () => {
      console.log(
        `ZIP berhasil dibuat: ${outputZipPath} (${archive.pointer()} bytes)`
      );
      resolve(outputZipPath);
    });

    output.on("end", () => {
      console.log("Data has been drained");
    });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn(err.message);
      } else {
        reject(err);
      }
    });

    archive.on("error", reject);

    archive.pipe(output);

    // isi folder dimasukkan ke root zip
    archive.directory(sourceFolder, false);

    archive.finalize();
  });
}
