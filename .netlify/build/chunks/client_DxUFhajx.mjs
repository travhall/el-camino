import { C as Client, E as Environment } from './client_CZE72IHa.mjs';

const squareClient = new Client({
  accessToken: "EAAAlzHv_3yNKWX5wofmfLHp_Pj4cSiIg2V84OcUTrXL6Lh5kbcMG0ZiINJJsy_a",
  environment: Environment.Sandbox,
  squareVersion: "2024-02-28"
});
const jsonStringifyReplacer = (_key, value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};
async function getImageUrl(imageId) {
  try {
    const { result } = await squareClient.catalogApi.retrieveCatalogObject(imageId);
    if (result.object?.type === "IMAGE") {
      return result.object.imageData?.url || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}
async function fetchProducts() {
  const { result } = await squareClient.catalogApi.listCatalog(void 0, "ITEM");
  if (!result.objects?.length) {
    return [];
  }
  const products = await Promise.all(
    result.objects.filter((item) => item.type === "ITEM").map(async (item) => {
      const variation = item.itemData?.variations?.[0];
      const priceMoney = variation?.itemVariationData?.priceMoney;
      let imageUrl = "/images/placeholder.png";
      if (item.itemData?.imageIds?.[0]) {
        const fetchedUrl = await getImageUrl(item.itemData.imageIds[0]);
        if (fetchedUrl) {
          imageUrl = fetchedUrl;
        }
      }
      return {
        id: item.id,
        catalogObjectId: item.id,
        variationId: variation?.id || item.id,
        title: item.itemData?.name || "",
        description: item.itemData?.description || "",
        image: imageUrl,
        price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
        url: `/product/${item.id}`
      };
    })
  );
  return products;
}
async function fetchProduct(id) {
  try {
    const { result } = await squareClient.catalogApi.retrieveCatalogObject(id);
    if (!result.object || result.object.type !== "ITEM") return null;
    const item = result.object;
    const variation = item.itemData?.variations?.[0];
    const priceMoney = variation?.itemVariationData?.priceMoney;
    if (!variation || !priceMoney) return null;
    let imageUrl = "/images/placeholder.png";
    if (item.itemData?.imageIds?.[0]) {
      const fetchedUrl = await getImageUrl(item.itemData.imageIds[0]);
      if (fetchedUrl) {
        imageUrl = fetchedUrl;
      }
    }
    return {
      id: item.id,
      catalogObjectId: item.id,
      variationId: variation.id,
      title: item.itemData?.name || "",
      description: item.itemData?.description || "",
      image: imageUrl,
      price: Number(priceMoney.amount) / 100,
      url: `/product/${item.id}`
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}

export { fetchProducts as a, fetchProduct as f, jsonStringifyReplacer as j, squareClient as s };
