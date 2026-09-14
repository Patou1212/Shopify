export type Connection<T> = {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};
export async function collect<T>(
  load: (after: string | null) => Promise<Connection<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | null = null;
  do {
    const page = await load(after);
    all.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) return all;
    if (!page.pageInfo.endCursor || page.pageInfo.endCursor === after)
      throw new Error("Pagination Shopify invalide");
    after = page.pageInfo.endCursor;
  } while (true);
}
export function optionValue(
  options: { name: string; value: string }[],
  names: string[],
) {
  return (
    options.find((o) => names.includes(o.name.toLowerCase().trim()))?.value ??
    null
  );
}
export function quantities(values: { name: string; quantity: number }[]) {
  const get = (name: string) => {
    const value = values.find((v) => v.name === name);
    if (!value || !Number.isInteger(value.quantity))
      throw new Error(`Quantité ${name} absente`);
    return value.quantity;
  };
  return { availableQty: get("available"), onHandQty: get("on_hand") };
}
