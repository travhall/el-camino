// Test script to find online sale price location
import { Client, Environment } from 'square';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production  // Force production
});

async function test() {
  // First, get all locations
  const locations = await client.locationsApi.listLocations();
  console.log('=== LOCATIONS ===');
  locations.result.locations?.forEach(loc => {
    console.log(`${loc.id}: ${loc.name} (${loc.status})`);
  });
  
  // Then check first item with variations
  const { result } = await client.catalogApi.listCatalog(undefined, 'ITEM');
  const item = result.objects?.[0];
  
  if (item?.itemData?.variations?.[0]) {
    const v = item.itemData.variations[0];
    console.log('\n=== FIRST VARIATION ===');
    console.log('Name:', v.itemVariationData?.name);
    console.log('Base Price:', v.itemVariationData?.priceMoney?.amount);
    
    if (v.itemVariationData?.locationOverrides) {
      console.log('\nLocation Overrides:');
      v.itemVariationData.locationOverrides.forEach(override => {
        console.log(`  ${override.locationId}: $${override.priceMoney?.amount || 0}`);
      });
    }
  }
}

test().catch(console.error);
