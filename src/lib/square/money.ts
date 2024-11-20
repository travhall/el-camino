import type { Money } from './types';

export class MoneyUtils {
    static readonly DEFAULT_CURRENCY = 'USD';

    /**
     * Format money amount for display
     */
    static format(money: Money): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: money.currency || MoneyUtils.DEFAULT_CURRENCY,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(money.amount / 100);
    }

    /**
     * Convert a regular number (dollars) to money object (cents)
     */
    static fromFloat(amount: number, currency: string = MoneyUtils.DEFAULT_CURRENCY): Money {
        return {
            amount: Math.round(amount * 100),
            currency
        };
    }

    /**
     * Convert money object (cents) to regular number (dollars)
     */
    static toFloat(money: Money): number {
        return money.amount / 100;
    }

    /**
     * Add two money objects
     */
    static add(a: Money, b: Money): Money {
        if (a.currency !== b.currency) {
            throw new Error('Cannot add money with different currencies');
        }
        return {
            amount: a.amount + b.amount,
            currency: a.currency
        };
    }

    /**
     * Subtract two money objects
     */
    static subtract(a: Money, b: Money): Money {
        if (a.currency !== b.currency) {
            throw new Error('Cannot subtract money with different currencies');
        }
        return {
            amount: a.amount - b.amount,
            currency: a.currency
        };
    }

    /**
     * Multiply money by a number
     */
    static multiply(money: Money, multiplier: number): Money {
        return {
            amount: Math.round(money.amount * multiplier),
            currency: money.currency
        };
    }

    /**
     * Convert from Square Money type
     */
    static fromSquareMoney(squareMoney: { amount?: string | number | bigint, currency?: string } | null | undefined): Money {
        if (!squareMoney || !squareMoney.amount) {
            return { amount: 0, currency: MoneyUtils.DEFAULT_CURRENCY };
        }

        const amount = typeof squareMoney.amount === 'string'
            ? parseInt(squareMoney.amount, 10)
            : typeof squareMoney.amount === 'bigint'
                ? Number(squareMoney.amount)
                : squareMoney.amount;

        return {
            amount,
            currency: squareMoney.currency || MoneyUtils.DEFAULT_CURRENCY
        };
    }

    /**
     * Convert to Square Money type
     */
    static toSquareMoney(money: Money): { amount: string, currency: string } {
        return {
            amount: money.amount.toString(),
            currency: money.currency || MoneyUtils.DEFAULT_CURRENCY
        };
    }

    /**
     * Validate a money object
     */
    static validate(money: Money): boolean {
        return (
            typeof money.amount === 'number' &&
            Number.isInteger(money.amount) &&
            typeof money.currency === 'string' &&
            money.currency.length === 3
        );
    }

    /**
     * Zero money value
     */
    static zero(currency: string = MoneyUtils.DEFAULT_CURRENCY): Money {
        return { amount: 0, currency };
    }
}