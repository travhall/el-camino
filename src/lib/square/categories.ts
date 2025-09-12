// src/lib/square/categories.ts - WITH COMPREHENSIVE DEBUGGING
import { squareClient } from "./client";
import { batchGetImageUrls } from "./imageUtils";
import type {
  Category,
  CategoryHierarchy,
  PaginatedProducts,
  ProductLoadingOptions,
} from "./types";
import { categoryCache, productCache } from "./cacheUtils";
import { processSquareError, handleError } from "./errorUtils";
import { createProductUrl } from "@/lib/square/slugUtils";

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extract brand value from custom attributes (same logic as client.ts)
 */
function extractBrandValue(customAttributeValues: any): string {
  if (!customAttributeValues) return "";

  // Look for any attribute with 'brand' in the key name (case insensitive)
  const brandAttribute = Object.values(customAttributeValues).find(
    (attr: any) =>
      attr?.name?.toLowerCase() === "brand" ||
      attr?.key?.toLowerCase() === "brand"
  ) as any;

  if (
    brandAttribute &&
    brandAttribute.type === "STRING" &&
    brandAttribute.stringValue
  ) {
    return brandAttribute.stringValue;
  }

  return "";
}

export async function fetchCategories(): Promise<Category[]> {
  return categoryCache.getOrCompute("all-categories", async () => {
    try {
      const response = await squareClient.catalogApi.listCatalog(
        undefined,
        "CATEGORY"
      );

      if (!response.result?.objects?.length) {
        return [];
      }

      const rawObjects = response.result.objects;
      const categories = rawObjects
        .filter((item) => item.type === "CATEGORY")
        .map((item, index) => {
          // Extract ordinal from parentCategory (BigInt)
          const parentOrdinal = item.categoryData?.parentCategory?.ordinal;
          const orderValue = parentOrdinal ? Number(parentOrdinal) : 999;

          // ENHANCED: Try multiple ways to get rootCategoryId
          let rootCategoryId = null;

          // Method 1: Standard camelCase
          if (item.categoryData?.rootCategory) {
            rootCategoryId = item.categoryData.rootCategory;
          }

          // Method 2: snake_case fallback
          if (!rootCategoryId && (item.categoryData as any)?.root_category) {
            rootCategoryId = (item.categoryData as any).root_category;
          }

          // Method 3: parent category ID fallback for subcategories
          if (
            !rootCategoryId &&
            item.categoryData?.parentCategory?.id &&
            !item.categoryData?.isTopLevel
          ) {
            rootCategoryId = item.categoryData.parentCategory.id;
          }

          const category = {
            id: item.id,
            name: item.categoryData?.name || "",
            slug: createSlug(item.categoryData?.name || ""),
            isTopLevel: item.categoryData?.isTopLevel || false,
            parentCategoryId: item.categoryData?.parentCategory?.id,
            rootCategoryId: rootCategoryId,
            apiIndex: rawObjects.indexOf(item),
            rawOrder: orderValue,
          };

          // DEBUG: Log problematic categories
          if (
            ["Trucks", "Bearings Bolts & More", "Bottoms", "Hats"].includes(
              category.name
            )
          ) {
            // console.log(`[DEBUG] Category ${category.name}:`, {
            //   id: category.id,
            //   isTopLevel: category.isTopLevel,
            //   parentCategoryId: category.parentCategoryId,
            //   rootCategoryId: category.rootCategoryId,
            //   slug: category.slug,
            // });
          }

          return category;
        });

      // console.log(`[DEBUG] Total categories processed: ${categories.length}`);
      return categories;
    } catch (error) {
      const appError = processSquareError(error, "fetchCategories");
      return handleError<Category[]>(appError, []);
    }
  });
}

export async function fetchCategoryHierarchy(): Promise<CategoryHierarchy[]> {
  return categoryCache.getOrCompute("hierarchy", async () => {
    try {
      const allCategories = await fetchCategories();
      if (!allCategories.length) return [];

      // Sort by Square's ordinal instead of hardcoded order
      let topLevelCategories = allCategories.filter((cat) => cat.isTopLevel);

      // console.log(
      //   `[DEBUG] Top level categories found: ${topLevelCategories
      //     .map((c) => c.name)
      //     .join(", ")}`
      // );

      // REMOVE hardcoded getSortIndex, use Square's ordering
      topLevelCategories.sort((a, b) => {
        const orderA = a.rawOrder ?? 999;
        const orderB = b.rawOrder ?? 999;

        // If ordinals are the same, fall back to alphabetical
        if (orderA === orderB) {
          return a.name.localeCompare(b.name);
        }

        return orderA - orderB;
      });

      const hierarchy = topLevelCategories.map((topCat) => {
        let subcategories = allCategories.filter(
          (subCat) => subCat.rootCategoryId === topCat.id && !subCat.isTopLevel
        );

        // DEBUG: Log subcategory matching for Skateboards and Apparel
        if (["Skateboards", "Apparel"].includes(topCat.name)) {
          // console.log(
          //   `[DEBUG] ${topCat.name} (${topCat.id}) subcategories:`,
          //   subcategories.map((sub) => `${sub.name} (${sub.id})`)
          // );
        }

        // Sort subcategories by ordinal too
        subcategories.sort((a, b) => {
          const orderA = a.rawOrder ?? 999;
          const orderB = b.rawOrder ?? 999;

          if (orderA === orderB) {
            return a.name.localeCompare(b.name);
          }

          return orderA - orderB;
        });

        return {
          category: topCat,
          subcategories,
        };
      });

      // console.log(
      //   `[DEBUG] Hierarchy built with ${hierarchy.length} top-level categories`
      // );
      return hierarchy;
    } catch (error) {
      const appError = processSquareError(error, "fetchCategoryHierarchy");
      return handleError<CategoryHierarchy[]>(appError, []);
    }
  });
}

export async function fetchProductsByCategory(
  categoryId: string,
  options?: ProductLoadingOptions
): Promise<PaginatedProducts> {
  const { limit = 24, cursor } = options || {};
  const cacheKey = `category-${categoryId}-${cursor || "initial"}-${limit}`;

  return productCache.getOrCompute(cacheKey, async () => {
    try {
      const searchRequest: any = {
        categoryIds: [categoryId],
        limit: Math.min(limit, 100),
      };

      if (cursor) {
        searchRequest.cursor = cursor;
      }

      const { result } = await squareClient.catalogApi.searchCatalogItems(
        searchRequest
      );

      if (!result?.items?.length) {
        return {
          products: [],
          hasMore: false,
        };
      }

      // Parallel processing for performance
      const imageIds = result.items
        .map((item) => item.itemData?.imageIds?.[0])
        .filter((id): id is string => Boolean(id));

      const measurementUnitIds = result.items
        .map(
          (item) =>
            item.itemData?.variations?.[0]?.itemVariationData?.measurementUnitId
        )
        .filter((id): id is string => Boolean(id));

      // Batch fetch images and units
      const [imageUrlMap, measurementUnitsMap] = await Promise.all([
        imageIds.length
          ? batchGetImageUrls(imageIds)
          : Promise.resolve({} as Record<string, string>),
        measurementUnitIds.length
          ? fetchMeasurementUnits(measurementUnitIds)
          : Promise.resolve({} as Record<string, string>),
      ]);

      const products = result.items.map((item) => {
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;
        const imageId = item.itemData?.imageIds?.[0];
        const measurementUnitId =
          variation?.itemVariationData?.measurementUnitId;

        const imageUrl =
          imageId && imageUrlMap[imageId]
            ? imageUrlMap[imageId]
            : "data:image/svg+xml,%3Csvg%20width%3D%2248%22%20height%3D%2244%22%20fill%3D%22%23374151%22%20viewBox%3D%220%200%2048%2044%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%20%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M10.6848%2043.9997L10.5924%2044C8.15681%2044%206.34269%2043.4765%205.98588%2043.3736C3.89592%2042.7665%202.69408%2041.6367%202.46029%2041.4172C2.22808%2041.1939%201.04087%2040.0543%200.394889%2037.99C-0.250828%2035.9248%200.0772527%2033.5182%200.130018%2033.1324C0.501462%2030.4075%201.41988%2028.7811%201.61449%2028.4368C2.74136%2026.4667%204.18482%2025.404%204.46431%2025.1986C4.74773%2024.9897%206.20294%2023.9167%208.45877%2023.3094C8.84197%2023.207%2010.7284%2022.7023%2013.3855%2022.7023C15.0189%2022.7023%2016.0663%2022.835%2016.2978%2022.8643C17.5905%2023.0262%2018.4266%2023.2256%2018.609%2023.2689C19.6282%2023.5121%2020.2504%2023.7659%2020.3883%2023.8222L21.7626%2024.4025C21.4805%2026.4713%2021.1984%2028.5402%2020.9163%2030.6092H16.7502C16.1771%2029.638%2015.5068%2029.258%2015.3673%2029.1789C14.5719%2028.7202%2013.8003%2028.7202%2013.6585%2028.7202C13.532%2028.7202%2012.8834%2028.7202%2012.1095%2029.0172C11.9862%2029.0653%2011.3491%2029.3141%2010.7044%2029.8806C10.5973%2029.9746%2010.0595%2030.4475%209.60157%2031.2702C9.52426%2031.4072%209.14498%2032.0802%209.00157%2033.1324C8.97362%2033.3364%208.76491%2034.8681%208.95534%2035.7051C9.1455%2036.5413%209.5684%2036.9907%209.65356%2037.0814C9.73897%2037.17%2010.1749%2037.621%2010.9844%2037.8774L11.9475%2038.0788L13.461%2038.1216C13.6869%2038.1132%2014.9172%2038.0674%2016.2769%2037.8968C21.9175%2036.9146%2023.2285%2031.5305%2023.8883%2030.093L24.0205%2029.7727C24.6673%2028.2754%2025.4694%2027.3065%2025.6288%2027.1145L25.6327%2027.1096C25.9145%2026.7511%2027.3789%2024.8884%2030.3405%2023.8202L30.5158%2023.7547C30.7535%2023.6669%2031.9742%2023.2149%2033.5866%2022.9587C33.8515%2022.917%2035.2132%2022.7023%2036.9296%2022.7023H36.9432C38.6518%2022.7033%2039.9445%2022.9162%2040.2026%2022.9587C41.7597%2023.2151%2042.85%2023.6643%2043.0697%2023.7547C44.3804%2024.2946%2045.2221%2024.9938%2045.3874%2025.1311C45.5491%2025.2635%2046.4085%2025.9676%2047.0529%2027.128C47.6505%2028.2043%2047.8569%2029.5662%2047.8903%2029.7862C47.9311%2030.0507%2048.1202%2031.2807%2047.8817%2033.1324C47.5011%2036.0868%2046.4767%2037.7766%2046.2575%2038.1382C45.0053%2040.2163%2043.4393%2041.324%2043.1363%2041.5384C42.8367%2041.7505%2041.2678%2042.8607%2038.9342%2043.4276C38.5499%2043.5187%2036.5213%2044%2034.0255%2044C33.7661%2044%2032.4874%2044%2030.7893%2043.7785C29.2528%2043.576%2028.1605%2043.1141%2027.9442%2043.0227C26.6493%2042.4696%2025.7967%2041.7459%2025.6319%2041.6059L24.825%2040.7882C20.8256%2043.1895%2014.9423%2043.7247%2014.0492%2043.8062C13.7818%2043.8312%2012.0807%2043.9906%2010.6976%2043.9997L10.6846%2044L10.6848%2043.9997ZM34.5625%2029.0979C33.9377%2029.3141%2033.5626%2029.6171%2033.4868%2029.6782C33.0496%2030.0426%2032.8233%2030.4269%2032.7795%2030.5012L32.3344%2031.4322L32.0985%2032.3499L31.9778%2033.1324L31.8851%2033.9149L31.8689%2034.8459L32.0583%2035.7906C32.0807%2035.865%2032.2014%2036.2625%2032.5376%2036.6406C32.5979%2036.703%2032.8892%2037.0047%2033.4531%2037.2342C33.5631%2037.2777%2034.0307%2037.4636%2034.9167%2037.4636C35.8025%2037.4636%2036.3142%2037.2762%2036.4289%2037.2342C37.0688%2037.005%2037.4434%2036.7027%2037.5205%2036.6406C37.9732%2036.2627%2038.2009%2035.8675%2038.2453%2035.7906C38.5316%2035.3172%2038.6656%2034.9248%2038.6925%2034.8459L38.9302%2033.9149L39.0645%2033.1324L39.1436%2032.3499L39.158%2031.4322C39.1528%2031.3565%2039.1256%2030.9611%2038.9665%2030.5012C38.9433%2030.4281%2038.8213%2030.0423%2038.4697%2029.6782C38.4091%2029.6153%2038.1176%2029.3138%2037.5382%2029.0979C37.4298%2029.0538%2036.9743%2028.8687%2036.0888%2028.8687C35.2027%2028.8687%2034.6785%2029.0564%2034.5625%2029.0979ZM14.6691%2017.1565C18.2255%2017.1565%2020.2342%2015.9174%2020.6428%2015.28H23.018C22.7445%2017.2861%2022.471%2019.2919%2022.1975%2021.2977H3.18072C3.45421%2019.2919%203.7277%2017.2861%204.00119%2015.28L5.86912%2014.9334C6.25728%2012.0863%206.64544%209.23915%207.0336%206.39226L5.26049%206.04544C5.53502%204.03046%205.80982%202.01523%206.08462%200H25.1014C24.8279%202.00607%2024.5544%204.01187%2024.2809%206.01794H21.9909C21.6766%205.48319%2019.6622%204.14123%2016.4438%204.14123C16.2178%205.79742%2015.9921%207.45361%2015.7662%209.1098C17.2295%208.80932%2018.6928%208.5091%2020.1561%208.20862C19.933%209.84469%2019.71%2011.4808%2019.4869%2013.1171C18.1056%2012.8166%2016.7241%2012.5161%2015.3428%2012.2157C15.1181%2013.8627%2014.8935%2015.5097%2014.6691%2017.1565ZM36.497%2016.0893C37.1229%2016.0979%2042.4485%2016.1718%2044.0782%2014.1986H46.4733C46.1507%2016.5649%2045.8281%2018.9313%2045.5055%2021.2977H23.6344C23.9079%2019.2919%2024.1814%2017.2861%2024.4549%2015.28L26.3228%2014.9334C26.711%2012.0863%2027.0991%209.23915%2027.4873%206.39226L25.7179%206.01769C25.9913%204.01187%2026.2648%202.00607%2026.5383%200H40.5116C40.2381%202.00607%2039.9646%204.01187%2039.6911%206.01769L37.8193%206.39226C37.3786%209.62443%2036.9377%2012.8568%2036.497%2016.0893Z%22%20%2F%3E%20%3C%2Fsvg%3E";

        const unit = measurementUnitId
          ? measurementUnitsMap[measurementUnitId] || undefined
          : undefined;

        // ADDED: Extract brand from custom attributes
        const brandValue = extractBrandValue(item.customAttributeValues);

        return {
          id: item.id,
          catalogObjectId: item.id,
          variationId: variation?.id || item.id,
          title: item.itemData?.name || "",
          description: item.itemData?.description || "",
          image: imageUrl,
          price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
          url: createProductUrl({ title: item.itemData?.name || "" }),
          unit: unit,
          brand: brandValue || undefined, // ADDED: Include brand
        };
      });

      return {
        products,
        nextCursor: result.cursor,
        hasMore: !!result.cursor,
      };
    } catch (error) {
      const appError = processSquareError(
        error,
        `fetchProductsByCategory:${categoryId}`
      );
      return handleError<PaginatedProducts>(appError, {
        products: [],
        hasMore: false,
      });
    }
  });
}

// Optimized measurement unit fetching
async function fetchMeasurementUnits(
  unitIds: string[]
): Promise<Record<string, string>> {
  const results = await Promise.allSettled(
    unitIds.map(async (unitId) => {
      try {
        const { result } = await squareClient.catalogApi.retrieveCatalogObject(
          unitId
        );

        if (result.object?.type === "MEASUREMENT_UNIT") {
          const unitData = result.object.measurementUnitData;
          let unitName = "";

          if (unitData?.measurementUnit?.customUnit?.name) {
            unitName = unitData.measurementUnit.customUnit.name;
          } else if (unitData?.measurementUnit?.customUnit?.abbreviation) {
            unitName = unitData.measurementUnit.customUnit.abbreviation;
          } else if (unitData?.measurementUnit?.type) {
            unitName = unitData.measurementUnit.type
              .toLowerCase()
              .replace(/_/g, " ");
          }

          return { unitId, unitName };
        }
        return { unitId, unitName: "" };
      } catch {
        return { unitId, unitName: "" };
      }
    })
  );

  const unitMap: Record<string, string> = {};
  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value.unitName) {
      unitMap[result.value.unitId] = result.value.unitName;
    }
  });

  return unitMap;
}

export function clearCategoryCache(): void {
  categoryCache.clear();
  productCache.clear();
}

import type {
  PaginationOptions,
  PaginatedProductsWithMeta,
  PaginationMeta,
  ProductFilters,
} from "./types";
import { calculatePaginationMeta } from "./types";
import { filterProducts, extractFilterOptions } from "./filterUtils";

/**
 * Fetch ALL products from category, then filter and paginate
 */
async function fetchAllProductsFromCategory(
  categoryId: string
): Promise<any[]> {
  const allProducts: any[] = [];
  let cursor: string | undefined = undefined;

  do {
    const batch = await fetchProductsByCategory(categoryId, {
      limit: 100,
      cursor,
    });

    allProducts.push(...batch.products);
    cursor = batch.nextCursor;
  } while (cursor);

  return allProducts;
}

/**
 * Fetch products with server-side filtering and page-based pagination
 */
export async function fetchProductsByCategoryWithPagination(
  categoryId: string,
  options: PaginationOptions = {}
): Promise<PaginatedProductsWithMeta> {
  const { page = 1, pageSize = 24, filters = { brands: [] } } = options;

  // Cache ALL products for the category
  const baseCacheKey = `category-all-products-${categoryId}`;

  return productCache
    .getOrCompute(baseCacheKey, async () => {
      try {
        // Fetch ALL products for category - this fixes the pagination bug
        return await fetchAllProductsFromCategory(categoryId);
      } catch (error) {
        return [];
      }
    })
    .then(async (allProducts) => {
      // UPDATED: Now async to handle availability filtering
      const filteredProducts = await filterProducts(allProducts, filters);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

      const totalPages = Math.ceil(filteredProducts.length / pageSize);

      const pagination = calculatePaginationMeta(
        page,
        pageSize,
        paginatedProducts.length,
        page < totalPages,
        filteredProducts.length
      );

      const filterOptions = extractFilterOptions(allProducts);

      return {
        products: paginatedProducts,
        hasMore: page < totalPages,
        pagination,
        appliedFilters: filters,
        filterOptions,
      };
    });
}
