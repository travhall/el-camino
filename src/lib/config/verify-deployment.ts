// src/lib/config/verify-deployment.ts
import type { APIRoute } from 'astro';

interface IntegrationStatus {
    configured: boolean;
    error: string | null;
}

interface VerificationChecks {
    ssr: boolean;
    environment: string;
    square: IntegrationStatus;
    strapi: IntegrationStatus;
}

interface EnvironmentStatus {
    square: {
        hasToken: boolean;
        hasAppId: boolean;
        hasLocationId: boolean;
    };
    strapi: {
        hasUrl: boolean;
        hasToken: boolean;
    };
}

interface VerificationResponse {
    status: string;
    baseUrl: string;
    timestamp: string;
    checks: VerificationChecks;
    env: EnvironmentStatus;
}

export const get: APIRoute = async ({ request }) => {
    const baseUrl = new URL(request.url).origin;
    const checks: VerificationChecks = {
        ssr: true,
        environment: process.env.NODE_ENV || 'unknown',
        square: {
            configured: false,
            error: null
        },
        strapi: {
            configured: false,
            error: null
        }
    };

    // Verify Square configuration
    if (import.meta.env.SQUARE_ACCESS_TOKEN) {
        try {
            const { squareClient } = await import('../square/client');
            await squareClient.locationsApi.retrieveLocation(
                import.meta.env.PUBLIC_SQUARE_LOCATION_ID
            );
            checks.square.configured = true;
        } catch (error) {
            checks.square.error = error instanceof Error ? error.message : 'Unknown error';
            console.error('Square check failed:', error);
        }
    }

    // Verify Strapi configuration
    if (import.meta.env.STRAPI_URL) {
        try {
            const response = await fetch(`${import.meta.env.STRAPI_URL}/api/healthcheck`, {
                headers: {
                    Authorization: `Bearer ${import.meta.env.STRAPI_API_TOKEN}`
                }
            });
            checks.strapi.configured = response.ok;
        } catch (error) {
            checks.strapi.error = error instanceof Error ? error.message : 'Unknown error';
            console.error('Strapi check failed:', error);
        }
    }

    const responseData: VerificationResponse = {
        status: 'active',
        baseUrl,
        timestamp: new Date().toISOString(),
        checks,
        env: {
            square: {
                hasToken: !!import.meta.env.SQUARE_ACCESS_TOKEN,
                hasAppId: !!import.meta.env.PUBLIC_SQUARE_APP_ID,
                hasLocationId: !!import.meta.env.PUBLIC_SQUARE_LOCATION_ID
            },
            strapi: {
                hasUrl: !!import.meta.env.STRAPI_URL,
                hasToken: !!import.meta.env.STRAPI_API_TOKEN
            }
        }
    };

    return new Response(JSON.stringify(responseData, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};