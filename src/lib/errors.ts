// src/lib/errors.ts
import { ApiError } from 'square';

export class SquareError extends Error {
    constructor(
        message: string,
        public code?: string,
        public httpStatus?: number,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = 'SquareError';
        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, SquareError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            httpStatus: this.httpStatus,
            details: this.details
        };
    }
}

export class ValidationError extends Error {
    constructor(
        message: string,
        public fields?: Record<string, string>
    ) {
        super(message);
        this.name = 'ValidationError';
        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, ValidationError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            fields: this.fields
        };
    }
}

export class CheckoutError extends Error {
    constructor(
        message: string,
        public orderId?: string,
        public details?: any
    ) {
        super(message);
        this.name = 'CheckoutError';
        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, CheckoutError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            orderId: this.orderId,
            details: this.details
        };
    }
}

export function handleSquareError(error: unknown): SquareError {
    if (error instanceof ApiError) {
        return new SquareError(
            error.message || 'Square API Error',
            error.errors?.[0]?.code,
            error.statusCode,
            {
                errors: error.errors,
                statusCode: error.statusCode,
                headers: error.headers
            }
        );
    }

    if (error instanceof Error) {
        return new SquareError(
            error.message,
            undefined,
            undefined,
            { originalError: error.name, stack: error.stack }
        );
    }

    return new SquareError(
        'An unknown error occurred',
        'UNKNOWN_ERROR',
        500,
        { originalError: error }
    );
}

export function handleCheckoutError(error: unknown): Error {
    if (error instanceof ValidationError || error instanceof SquareError || error instanceof CheckoutError) {
        return error;
    }

    if (error instanceof Error) {
        return new CheckoutError(`Checkout failed: ${error.message}`, undefined, {
            originalError: error.name,
            stack: error.stack
        });
    }

    return new CheckoutError('Checkout failed: Unknown error occurred');
}

export function isSquareError(error: unknown): error is SquareError {
    return error instanceof SquareError;
}

export function isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
}

export function isCheckoutError(error: unknown): error is CheckoutError {
    return error instanceof CheckoutError;
}