// src/lib/square/money.ts
import type { Money, SquareMoneyObject } from './types';

export class MoneyUtils {
    static readonly DEFAULT_CURRENCY = 'USD';

    static format(money: Money | SquareMoneyObject): string {
        if (!money?.amount || money.amount === null) {
            return `$0.00`;
        }

        const amount = typeof money.amount === 'bigint'
            ? Number(money.amount)
            : typeof money.amount === 'string'
            ? Number(money.amount)
            : money.amount;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: money.currency || MoneyUtils.DEFAULT_CURRENCY
        }).format(amount / 100);
    }

    static fromFloat(amount: number, currency: string = MoneyUtils.DEFAULT_CURRENCY): Money {
        return {
            amount: Math.round(amount * 100),
            currency
        };
    }
}