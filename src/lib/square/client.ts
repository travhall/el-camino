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

// Add to src/lib/square/client.ts
export const jsonStringifyReplacer = (_key: string, value: any) => {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
};

export async function fetchProducts(): Promise<Product[]> {
    const { result } = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');

    if (!result.objects?.length) {
        return [];
    }

    return result.objects
        .filter(item => item.type === 'ITEM')
        .map(item => {
            const variation = item.itemData?.variations?.[0];
            const priceMoney = variation?.itemVariationData?.priceMoney;

            return {
                id: item.id,
                catalogObjectId: item.id,
                variationId: variation?.id || item.id,
                title: item.itemData?.name || '',
                description: item.itemData?.description || '',
                image: '/images/placeholder.png', // or handle image from Square
                price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
                url: `/product/${item.id}`
            };
        });
}

export async function fetchProduct(id: string): Promise<Product | null> {
    try {
        const { result } = await squareClient.catalogApi.retrieveCatalogObject(id);
        if (!result.object || result.object.type !== 'ITEM') return null;

        const item = result.object;
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;

        if (!variation || !priceMoney) return null;

        return {
            id: item.id,
            catalogObjectId: item.id,
            variationId: variation.id,
            title: item.itemData?.name || '',
            description: item.itemData?.description || '',
            image: '/images/placeholder.png',
            price: Number(priceMoney.amount) / 100,
            url: `/product/${item.id}`
        };
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
}