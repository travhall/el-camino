import type { APIRoute } from 'astro';
import { squareClient, jsonStringifyReplacer } from '@/lib/square/client';
import type { CatalogObject } from 'square';

export const GET: APIRoute = async () => {
    try {
        console.log('Fetching catalog items...');
        const { result } = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');

        const items = result.objects
            ?.filter((item: CatalogObject) => item.type === 'ITEM')
            .map((item: CatalogObject) => {
                const variation = item.itemData?.variations?.[0];
                return {
                    id: item.id,
                    type: item.type,
                    name: item.itemData?.name,
                    description: item.itemData?.description,
                    variationId: variation?.id,
                    price: variation?.itemVariationData?.priceMoney ?
                        Number(variation.itemVariationData.priceMoney.amount) / 100 : 0
                };
            }) || [];

        return new Response(JSON.stringify({
            success: true,
            locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
            items,
            meta: {
                totalItems: items.length,
                hasAccessToken: !!import.meta.env.SQUARE_ACCESS_TOKEN,
                squareVersion: '2024-02-28'
            }
        }, jsonStringifyReplacer, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            }
        });
    } catch (error) {
        console.error('Catalog fetch error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch catalog',
            meta: {
                hasAccessToken: !!import.meta.env.SQUARE_ACCESS_TOKEN,
                locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID
            }
        }, jsonStringifyReplacer), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};