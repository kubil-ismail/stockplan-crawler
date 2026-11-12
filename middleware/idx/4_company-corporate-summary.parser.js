import { CORPORATE_ACTION_MAP, toNumber } from "../../lib/helper.js";
import { format, parse, isValid } from "date-fns";
import { id } from "date-fns/locale";

export default async function parsing(idx = {}) {
  return idx?.map((item) => {
    const parsed_date = parse(item?.Tanggal.trim(), "dd MMM yyyy", new Date(), {
      locale: id,
    });

    return {
      ticker: item?.Kode_Emiten,
      variant: CORPORATE_ACTION_MAP?.[item?.Tipe_Aksi_Korporasi],

      date: isValid(parsed_date) ? format(parsed_date, "yyyy-MM-dd") : null,

      description: `Pada tanggal ${item?.Tanggal}, ${
        item?.Kode_Emiten
      } melakukan ${
        CORPORATE_ACTION_MAP?.[item?.Tipe_Aksi_Korporasi]
      } sebesar: jumlah aksi korporasi ${
        item?.Jumlah_Aksi_Korporasi
      } dan jumlah total ${item?.Jumlah_Total}`,

      corporate_action_amount: toNumber(item?.Jumlah_Aksi_Korporasi ?? "0"),
      total_amount: toNumber(item?.Jumlah_Total ?? "0"),
    };
  });
}
