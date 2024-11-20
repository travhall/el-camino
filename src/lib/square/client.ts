// /src/lib/square/client.ts
import { Client, Environment } from 'square';
import type { Product } from './types';

if (!import.meta.env.SQUARE_ACCESS_TOKEN) {
    throw new Error('Square access token is missing');
}

if (!import.meta.env.PUBLIC_SQUARE_LOCATION_ID) {
    throw new Error('Square location ID is missing');
}

export const squareClient = new Client({
    accessToken: import.meta.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Sandbox,
    squareVersion: '2024-02-28'
});

export const jsonStringifyReplacer = (_key: string, value: any) => {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
};

async function getImageUrl(imageId: string): Promise<string | null> {
    try {
        const { result } = await squareClient.catalogApi.retrieveCatalogObject(imageId);
        if (result.object?.type === 'IMAGE') {
            return result.object.imageData?.url || null;
        }
        return null;
    } catch (error) {
        console.error('Error fetching image:', error);
        return null;
    }
}

export async function fetchProducts(): Promise<Product[]> {
    const { result } = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');

    if (!result.objects?.length) {
        return [];
    }

    const products = await Promise.all(
        result.objects
            .filter(item => item.type === 'ITEM')
            .map(async item => {
                const variation = item.itemData?.variations?.[0];
                const priceMoney = variation?.itemVariationData?.priceMoney;

                // Handle image
                let imageUrl = '/images/placeholder.png';
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
                    title: item.itemData?.name || '',
                    description: item.itemData?.description || '',
                    image: imageUrl,
                    price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
                    url: `/product/${item.id}`
                };
            })
    );

    return products;
}

export async function fetchProduct(id: string): Promise<Product | null> {
    try {
        const { result } = await squareClient.catalogApi.retrieveCatalogObject(id);
        if (!result.object || result.object.type !== 'ITEM') return null;

        const item = result.object;
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;

        if (!variation || !priceMoney) return null;

        // Handle image
        let imageUrl = '/images/placeholder.png';
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
            title: item.itemData?.name || '',
            description: item.itemData?.description || '',
            image: imageUrl,
            price: Number(priceMoney.amount) / 100,
            url: `/product/${item.id}`
        };
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
}