import path from "path";
import fs from "fs";

import { __dirname } from "../../lib/migrate.js";
import ticker_parser from "../../middleware/ticker.parser.js";
import company_parser from "../../middleware/company.parser.js";
import financial_parser from "../../middleware/financial.parser.js";
import shareholder_parser from "../../middleware/shareholder.parser.js";
import corp_actions_parser from "../../middleware/corp_actions.parser.js";

const distFolder = path.resolve(__dirname, "../dist");
const globalFolder = path.resolve(__dirname, "../data/global");
const idxCompanyFolder = path.resolve(__dirname, "../dist/company/detail/idx");
const yfCompanyFolder = path.resolve(__dirname, "../dist/company/detail/yf");
const yfCompanyHistoryFolder = path.resolve(
  __dirname,
  "../dist/company/history/yf",
);

function readJson(folder, fileName) {
  const filePath = path.join(distFolder, folder, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  return JSON.parse(raw);
}

function readJsonDataGlobal(fileName) {
  const filePath = path.join(globalFolder, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  return JSON.parse(raw);
}

function readJsonIDX(fileName) {
  const filePath = path.join(idxCompanyFolder, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  return JSON.parse(raw);
}

function readJsonYF(fileName) {
  const filePath = path.join(yfCompanyFolder, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  return JSON.parse(raw);
}

function readJsonYFHistory(fileName) {
  const filePath = path.join(yfCompanyHistoryFolder, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  return JSON.parse(raw);
}

function normalizeJson(data = [], mapper = (item) => item) {
  return {
    total: data.length,
    data: data.map(mapper),
  };
}

function writeJson(folder, fileName, data, minify = false) {
  const filePath = path.join(distFolder, folder, fileName);

  if (minify) {
    fs.writeFileSync(filePath, JSON.stringify(data));
  } else {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}

// MAIN FUCTION
const industries = readJsonDataGlobal("industries.json");
const subIndustries = readJsonDataGlobal("sub_industries.json");
const sectors = readJsonDataGlobal("sectors.json");
const subSectors = readJsonDataGlobal("sub_sectors.json");
const company = readJson("company", "company.json");

const corporate_actions = readJson("information", `corporate_actions.json`);
const calendar = readJson("information", `calendar.json`);
const special_board = readJson("information", `special_board.json`);
const notation = readJson("information", `notation.json`);

function normalizeDetailCompany(data) {
  const banned = ["MFIN.JK.json", "WBSA.JK.json"];

  normalizeJson(data, async (item) => {
    const detailIDX = readJsonIDX(`${item.kode}.json`);
    const detailYF = !banned.includes(`${item.kode}.JK.json`)
      ? readJsonYF(`${item.kode}.JK.json`)
      : {};

    const ticker_json = ticker_parser(detailIDX?.data, detailYF?.data ?? {}, {
      industries,
      subIndustries,
      sectors,
      subSectors,
    });

    const request = await ticker_json;

    writeJson("minify/company/detail", `${item.kode}-min.json`, request, true);
  });
}

async function normalizeCompany(data) {
  const request = await company_parser(data);
  writeJson("minify/company", `company-min.json`, request, true);
}

async function normalizeShareholders(data) {
  const request = await shareholder_parser(data);

  writeJson("minify/company", `shareholder-min.json`, request, true);
}

function normalizeFinancialCompany(data) {
  const banned = ["MFIN.JK.json", "WBSA.JK.json"];

  normalizeJson(data, async (item) => {
    const Screener = readJson("company", `stock_screener.json`);
    const detailIDX = await Screener?.data?.find(
      (_item) => _item?.Kode_Saham === item.kode,
    );
    const detailYF = !banned.includes(`${item.kode}.JK.json`)
      ? readJsonYF(`${item.kode}.JK.json`)
      : {};

    const detailYFHistory = !banned.includes(`${item.kode}.JK.json`)
      ? readJsonYFHistory(`${item.kode}.JK.json`)
      : {};

    const financial_json = financial_parser(detailIDX, detailYF?.data ?? {}, {
      industries,
      subIndustries,
      sectors,
      subSectors,
      detailYFHistory,
    });

    const request = await financial_json;

    writeJson(
      "minify/company/financial",
      `${item.kode}-FIN.json`,
      request,
      true,
    );
  });
}

function normalizeFinancialCorpActions(data) {
  const banned = [];

  normalizeJson(data, async (item) => {
    // [ticker]-CA.json
    const detailIDX = readJsonIDX(`${item.kode}.json`);
    const request = await corp_actions_parser(item.kode, {
      corporate_actions,
      calendar,
      detailIDX,
    });

    writeJson(
      "minify/company/corp_actions",
      `${item.kode}-CA.json`,
      request,
      true,
    );
  });
}

async function main() {
  // [ticker].json
  await normalizeDetailCompany(company?.data);

  // [ticker]-FIN.json
  await normalizeFinancialCompany(company?.data);

  // company.json
  await normalizeCompany(company?.data);

  // shareholder.json
  await normalizeShareholders(company?.data);

  // [ticker]-CA.json
  await normalizeFinancialCorpActions(company?.data);
}

main();
