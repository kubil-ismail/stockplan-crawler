import fs from "fs";

function validateJsonFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File ${label} not found`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    console.error(`❌ Parse file ${label}`);
    return null;
  }
}

export default function tester(dir) {
  const check_json = {
    main: validateJsonFile(dir.main, "corporate_actions.json"),
    minify: validateJsonFile(dir.minify, "corporate_actions.json"),
  };

  if (
    !Array.isArray(check_json.main.data) ||
    !Array.isArray(check_json.minify.data)
  ) {
    console.error(`❌ corporate_actions.json not a valid array`);
  }

  if (check_json.main.total !== check_json.main.data.length) {
    console.error(`❌ corporate_actions.json length not valid`);
  }

  if (check_json.minify.total !== check_json.minify.data.length) {
    console.error(`❌ corporate_actions.json minify length not valid`);
  }

  if (check_json.main.data.length !== check_json.minify.data.length) {
    console.error(`❌ corporate_actions.json length not valid with minify`);
  }
}
