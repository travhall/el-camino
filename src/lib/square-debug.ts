import { squareClient } from './square-client';
import { jsonStringifyReplacer } from './square-client';

async function testSquareConnection() {
  const config = {
    hasAccessToken: !!import.meta.env.SQUARE_ACCESS_TOKEN,
    locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
    environment: 'sandbox',
    apiVersion: '2024-02-28'
  };

  try {
    const { result: locationResult } = await squareClient.locationsApi.listLocations();
    const locations = locationResult.locations || [];
    const hasLocation = locations.some(loc => loc.id === config.locationId);

    return {
      success: true,
      config,
      status: {
        locations: locations.length,
        validLocationId: hasLocation
      },
      details: {
        locations
      }
    };
  } catch (error) {
    console.error('Square connection test failed:', error);
    return {
      success: false,
      config,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export const squareDebugger = {
  runDiagnostics: testSquareConnection,
  formatMoney: (amount: number) => (amount / 100).toFixed(2)
};