import { Client, Environment } from 'square';
import type { Product } from '@/lib/types';
import { handleSquareError } from './errors';

if (!import.meta.env.SQUARE_ACCESS_TOKEN) {
    throw new Error('Square access token is missing');
}

if (!import.meta.env.PUBLIC_SQUARE_LOCATION_ID) {
    throw new Error('Square location ID is missing');
}

// Initialize Square client
const squareClient = new Client({
    accessToken: import.meta.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Sandbox,
    squareVersion: '2024-02-28'
});

// Custom replacer for BigInt serialization
export const jsonStringifyReplacer = (_key: string, value: any) => {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
};

function getImageUrl(item: any): string {
    return item.imageData?.url || '/images/placeholder.png';
}

export async function fetchProducts(): Promise<Product[]> {
    try {
        console.log('Fetching products from Square API...');
        const { result } = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');

        if (!result.objects?.length) {
            console.log('No products found in catalog');
            return [];
        }

        const products = result.objects
            .filter(item => {
                if (item.type !== 'ITEM' || !item.itemData?.variations) return false;
                const variations = item.itemData.variations;
                return variations.length > 0 && variations[0].itemVariationData?.priceMoney != null;
            })
            .map(item => {
                const variation = item.itemData!.variations![0];
                const priceMoney = variation.itemVariationData!.priceMoney!;
                const amountInCents = typeof priceMoney.amount === 'string'
                    ? BigInt(priceMoney.amount)
                    : priceMoney.amount || BigInt(0);

                return {
                    id: item.id,
                    catalogObjectId: item.id,
                    variationId: variation.id,
                    title: item.itemData?.name || 'Unnamed Product',
                    description: item.itemData?.description || '',
                    image: getImageUrl(item),
                    price: Number(amountInCents) / 100,
                    url: `/product/${item.id}`
                };
            });

        return products;
    } catch (error) {
        console.error('Square API Error:', error);
        throw handleSquareError(error);
    }
}

export async function fetchProduct(id: string): Promise<Product | null> {
    try {
        const { result } = await squareClient.catalogApi.retrieveCatalogObject(id);
        if (!result.object || result.object.type !== 'ITEM') return null;

        const item = result.object;
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;

        if (!variation || !priceMoney) {
            console.error('Product variation or price not found');
            return null;
        }

        const amountInCents = typeof priceMoney.amount === 'string'
            ? BigInt(priceMoney.amount)
            : priceMoney.amount || BigInt(0);

        return {
            id: item.id,
            catalogObjectId: item.id,
            variationId: variation.id,
            title: item.itemData?.name || 'Unnamed Product',
            description: item.itemData?.description || '',
            image: getImageUrl(item),
            price: Number(amountInCents) / 100,
            url: `/product/${item.id}`
        };
    } catch (error) {
        console.error('Square API Error:', error);
        throw handleSquareError(error);
    }
}

export { squareClient };