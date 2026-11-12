function validateJsonFile(content, label) {
  try {
    return JSON.parse(JSON.stringify(content));
  } catch {
    console.error(`❌ Parse file ${label}`);
    return null;
  }
}

export default function tester(dir, code) {
  const check_json = {
    main: validateJsonFile(dir.main, `/trading-history/${code}.json`),
    minify: validateJsonFile(dir.minify, `/trading-history/${code}.json`),
  };

  if (
    !Array.isArray(check_json.main.data) ||
    !Array.isArray(check_json.minify.data)
  ) {
    console.error(`❌ /trading-history/${code}.json not a valid array`);
    return false;
  }

  if (check_json.main.total !== check_json.main.data.length) {
    console.error(`❌ /trading-history/${code}.json length not valid`);
    return false;
  }

  if (check_json.minify.total !== check_json.minify.data.length) {
    console.error(`❌ /trading-history/${code}.json minify length not valid`);
    return false;
  }

  if (check_json.main.data.length !== check_json.minify.data.length) {
    console.error(
      `❌ /trading-history/${code}.json length not valid with minify`
    );
    return false;
  }

  if (check_json.main.data.length <= 1 && check_json.minify.data.length <= 1) {
    console.error(`❌ /trading-history/${code}.json not valid`);
    return false;
  }

  return true;
}
