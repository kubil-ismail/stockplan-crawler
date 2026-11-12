import path from "path";

import { createFolder, __dirname } from "../../lib/migrate.js";

import generate_company_detail from "../../crawler/2_company-summary.js";
import generate_company_list from "../../crawler/1_company-list-summary.js";
import generate_company_logo from "../../crawler/2_company-summary_logo.js";
import generate_company_screener from "../../crawler/7_company-screener-summary.js";
import generate_corporate_actions from "../../crawler/3_company-corporate-summary.js";
import generate_notations from "../../crawler/4_company-notation-summary.js";
import generate_company_calendar from "../../crawler/5_company-calendar-summary.js";
import generate_company_special_board from "../../crawler/6_company-pemantauan-khusus-summary.js";
import generate_company_history from "../../crawler/8_company-history-summary.js";

function main() {
  const distFolder = path.resolve(__dirname, "../dist");

  /*
|--------------------------------------------------------------------------
| COMPANY
|--------------------------------------------------------------------------
*/

  const companyFolder = path.resolve(distFolder, "company");

  const companyDetailFolder = path.resolve(companyFolder, "detail");
  const companyDetailIdxFolder = path.resolve(companyDetailFolder, "idx");
  const companyDetailYfFolder = path.resolve(companyDetailFolder, "yf");

  const companyFinancialFolder = path.resolve(companyFolder, "financial");

  const companyHistoryFolder = path.resolve(companyFolder, "history");
  const companyHistoryYfFolder = path.resolve(companyHistoryFolder, "yf");

  const companyLogoFolder = path.resolve(companyFolder, "logo");

  /*
|--------------------------------------------------------------------------
| INFORMATION
|--------------------------------------------------------------------------
*/

  const informationFolder = path.resolve(distFolder, "information");

  /*
|--------------------------------------------------------------------------
| MINIFY
|--------------------------------------------------------------------------
*/

  const minifyFolder = path.resolve(distFolder, "minify");

  const minifyCompanyFolder = path.resolve(minifyFolder, "company");

  const minifyCompanyDetailFolder = path.resolve(minifyCompanyFolder, "detail");

  const minifyCompanyFinancialFolder = path.resolve(
    minifyCompanyFolder,
    "financial",
  );

  const minifyCompanyCorpActionFolder = path.resolve(
    minifyCompanyFolder,
    "corp_actions",
  );

  const minifyInformationFolder = path.resolve(minifyFolder, "information");
  /*
|--------------------------------------------------------------------------
| CREATE FOLDERS
|--------------------------------------------------------------------------
*/

  [
    companyFolder,

    companyDetailFolder,
    companyDetailIdxFolder,
    companyDetailYfFolder,

    companyFinancialFolder,

    companyHistoryFolder,
    companyHistoryYfFolder,

    companyLogoFolder,

    minifyFolder,
    minifyCompanyFolder,
    minifyCompanyDetailFolder,
    minifyCompanyFinancialFolder,
    minifyInformationFolder,
    minifyCompanyCorpActionFolder,

    informationFolder,
  ].forEach(createFolder);

  generate_company_list()
    .then(() => generate_company_detail())
    .then(() => generate_company_screener())
    .then(() => generate_company_history())

    .then(() => generate_corporate_actions())
    .then(() => generate_notations())
    .then(() => generate_company_calendar())
    .then(() => generate_company_special_board());
  // .then(() => generate_company_logo())
}

main();
