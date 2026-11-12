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

export default function tester(dir, code) {
  const check_json = {
    main: validateJsonFile(dir.main, dir.main),
    minify: validateJsonFile(dir.minify, dir.minify),
  };

  if (
    !Array.isArray(Object.keys(check_json.main.data)) ||
    !Array.isArray(Object.keys(check_json.minify.data))
  ) {
    console.error(`❌ ${code} not a valid array`);
  }

  if (check_json.main.total !== Object.keys(check_json.main.data).length) {
    console.error(`❌ ${dir.main} length not valid`);
  }

  if (check_json.minify.total !== Object.keys(check_json.minify.data).length) {
    console.error(`❌ ${dir.minify} minify length not valid`);
  }
}
