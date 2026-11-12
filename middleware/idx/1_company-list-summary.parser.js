export default function parser(data) {
  return data?.map((item) => {
    return {
      ticker: item?.kode,
      name: item?.nama,
    };
  });
}
