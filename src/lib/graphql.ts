// src/lib/graphql.ts

interface GraphQLResponse<T> {
    data: T;
    errors?: Array<{
        message: string;
        locations: Array<{
            line: number;
            column: number;
        }>;
        path: string[];
    }>;
}

export async function fetchGraphQL<T>(
    query: string,
    variables: Record<string, any> = {}
): Promise<T> {
    const url = `${import.meta.env.STRAPI_URL}/graphql`;
    const token = import.meta.env.STRAPI_API_TOKEN;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });

    const result = await response.json() as GraphQLResponse<T>;

    if (result.errors) {
        console.error('GraphQL Errors:', result.errors);
        throw new Error(result.errors[0].message);
    }

    return result.data;
}