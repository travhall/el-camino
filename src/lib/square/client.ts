import { Client, Environment } from 'square';

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