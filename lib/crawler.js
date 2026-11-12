import generate_company_list_IDX from "../crawler/idx/1_company-list-summary.js";
import generate_company_detail_IDX from "../crawler/idx/2_company-summary.js";
import generate_company_screener_IDX from "../crawler/idx/3_company-screener-summary.js";
import generate_corporate_actions_IDX from "../crawler/idx/4_company-corporate-summary.js";
import generate_company_calendar_IDX from "../crawler/idx/5_company-calendar-summary.js";
import generate_company_trading_history_IDX from "../crawler/idx/6_company-trading-history-summary.js";
import generate_company_suspend_IDX from "../crawler/idx/7_company-suspend-summary.js";
import generate_company_notation_IDX from "../crawler/idx/8_company-notations-summary.js";
import generate_company_uma_IDX from "../crawler/idx/9_company-uma-summary.js";
import generate_financial_report_IDX from "../crawler/idx/10_company-financial-summary.js";

import generate_company_logo_TRADING_VIEW from "../crawler/trading_view/2_company-summary_logo.js";

import generate_company_detail_YF from "../crawler/yf/1_company-summary.js";
import generate_company_history_YF from "../crawler/yf/2_company-history-summary.js";

import { select, multiselect } from "@clack/prompts";

const source = await select({
  message: "Pilih sumber data",
  options: [
    { value: "idx", label: "IDX" },
    { value: "tradingview", label: "TradingView" },
    { value: "yahoo", label: "Yahoo Finance" },
  ],
});

let selectedItems = [];

if (source === "idx") {
  selectedItems = await multiselect({
    message: "Pilih data yang ingin di-scrape",
    options: [
      {
        value: "company",
        label: "Company Profile",
        hint: "company detail, shareholders, management, subsidiaries",
      },
      { value: "fundamental", label: "Fundamental Report" },
      { value: "corporate_actions", label: "Corporate Actions" },
      { value: "corporate_event", label: "Corporate Event" },
      { value: "trading_history", label: "Trading History" },
      { value: "notations", label: "Special Notation" },
      { value: "suspensions", label: "Suspensions" },
      { value: "uma", label: "UMA" },
      { value: "financial_report", label: "Financial Report" },
    ],
    required: true,
  });
}

if (source === "tradingview") {
  selectedItems = await multiselect({
    message: "Pilih data yang ingin di-scrape",
    options: [{ value: "logo", label: "Logo" }],
    required: true,
  });
}

if (source === "yahoo") {
  selectedItems = await multiselect({
    message: "Pilih data yang ingin di-scrape",
    options: [
      {
        value: "company",
        label: "Company Profile",
        hint: "company detail, management",
      },
      {
        value: "history_prices",
        label: "History Prices",
      },
    ],
    required: true,
  });
}

switch (source) {
  case "idx":
    await generate_company_list_IDX();

    for (let item of selectedItems) {
      if (item === "company") {
        await generate_company_detail_IDX();
      }

      if (item === "fundamental") {
        await generate_company_screener_IDX();
      }

      if (item === "corporate_actions") {
        await generate_corporate_actions_IDX();
      }

      if (item === "corporate_event") {
        await generate_company_calendar_IDX();
      }

      if (item === "trading_history") {
        await generate_company_trading_history_IDX();
      }

      if (item === "notations") {
        await generate_company_notation_IDX();
      }

      if (item === "suspensions") {
        await generate_company_suspend_IDX();
      }

      if (item === "uma") {
        await generate_company_uma_IDX();
      }

      if (item === "financial_report") {
        await generate_financial_report_IDX();
      }
    }

    break;

  case "tradingview":
    await generate_company_list_IDX();

    for (let item of selectedItems) {
      if (item === "logo") {
        await generate_company_logo_TRADING_VIEW();
      }
    }

    break;

  case "yahoo":
    for (let item of selectedItems) {
      if (item === "company") {
        await generate_company_detail_YF();
      }

      if (item === "history_prices") {
        await generate_company_history_YF();
      }
    }

    break;

  default:
    break;
}
