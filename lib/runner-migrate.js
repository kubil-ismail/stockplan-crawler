import { zipFolder } from "./migrate.js";
import { select } from "@clack/prompts";
import { format } from "date-fns";
import fs from "fs/promises";

const source = await select({
  message: "Pilih export data",
  options: [
    { value: "idx", label: "IDX" },
    { value: "tradingview", label: "TradingView" },
    { value: "yahoo", label: "Yahoo Finance" },
  ],
});

if (source === "idx") {
  const date = format(new Date(), "yyyy-MM-dd");

  const sourceFolder = "../dist/idx";
  const zipPath = `../archive/idx-${date}.zip`;

  await zipFolder(sourceFolder, zipPath);

  await fs.rm(sourceFolder, {
    recursive: true,
    force: true,
  });

  console.log("Folder berhasil dibersihkan");
}
