import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getAssetProfile(ticker) {
  try {
    const result = await yahooFinance.quoteSummary(
      `${ticker}.JK`,
      {
        modules: ["assetProfile"],
      },
      { validateResult: false }
    );

    // anti rate limit
    await sleep(1000 + Math.random() * 3000);

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    console.log(`❌ Failed ${ticker}`);

    console.log(err.message);

    return {
      success: false,
      ticker,
      error: err.message,
    };
  }
}

export async function getFinancialHistory(ticker) {
  try {
    const period2 = new Date();

    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 5);

    const result = await yahooFinance.historical(
      `${ticker}.JK`,
      {
        period1,
        period2,
        interval: "1d",
      },
      { validateResult: false }
    );

    const sorted = result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // anti rate limit
    await sleep(1000 + Math.random() * 3000);

    return {
      success: true,
      data: sorted,
    };
  } catch (err) {
    console.log(`❌ Failed ${ticker}`);

    console.log(err);

    return {
      success: false,
      ticker,
      error: err.message,
    };
  }
}
