import type { APIRoute } from 'astro';

export const get: APIRoute = async () => {
    return new Response(
        JSON.stringify({
            status: 'ok',
            runtime: 'edge',
            timestamp: new Date().toISOString(),
            environment: {
                node: process.version,
                platform: process.platform
            }
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
};