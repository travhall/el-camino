declare interface Window {
    Square: {
        payments: (appId: string, locationId: string) => SquarePayments;
    };
}

interface SquarePayments {
    card(): Promise<SquareCard>;
}

interface SquareCard {
    attach(elementId: string): Promise<void>;
    tokenize(): Promise<SquareTokenResult>;
}

interface SquareTokenResult {
    status: 'OK' | 'ERROR';
    token?: string;
    errors?: Array<{
        code: string;
        message: string;
    }>;
}