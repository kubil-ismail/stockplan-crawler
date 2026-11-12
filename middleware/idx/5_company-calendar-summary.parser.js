import { format, parse, isValid } from "date-fns";
import { id } from "date-fns/locale";

export default async function parsing(idx = {}) {
  return idx?.map((item) => {
    const parsed_date = parse(item?.tanggal.trim(), "dd MMM yyyy", new Date(), {
      locale: id,
    });

    return {
      ticker: item?.kode,
      date: isValid(parsed_date) ? format(parsed_date, "yyyy-MM-dd") : null,
      title: item?.perihal,
      description: item?.lokasi,
    };
  });
}
