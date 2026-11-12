import { toNumber } from "../../lib/helper.js";
import { format, parse, isValid } from "date-fns";
import { id } from "date-fns/locale";

export default async function parsing(idx = {}) {
  return idx?.map((item) => {
    const parsed_date = parse(item?.tanggal.trim(), "dd MMM yyyy", new Date(), {
      locale: id,
    });

    return {
      no: toNumber(item?.no ?? "0"),
      date: isValid(parsed_date) ? format(parsed_date, "yyyy-MM-dd") : null,
      open: toNumber(item?.harga_pembukaan ?? "0"),
      high: toNumber(item?.tertinggi ?? "0"),
      low: toNumber(item?.terendah ?? "0"),
      close: toNumber(item?.penutupan ?? "0"),
      volume: toNumber(item?.volume ?? "0"),
      value: toNumber(item?.nilai ?? "0"),
      freq: toNumber(item?.frekuensi ?? "0"),
    };
  });
}
