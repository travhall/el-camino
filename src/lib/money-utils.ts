// src/lib/money-utils.ts
import type { Money } from 'square';

export function formatMoney(money: Money | null | undefined): string {
    if (!money || !money.amount) return '0.00';
    const amount = typeof money.amount === 'string' ? BigInt(money.amount) : money.amount;
    return (Number(amount) / 100).toFixed(2);
}

export function getAmount(money: Money | null | undefined): bigint {
    if (!money || !money.amount) return BigInt(0);
    return typeof money.amount === 'string' ? BigInt(money.amount) : money.amount;
}

export function createMoney(amount: number, currency: string = 'USD'): Money {
    return {
        amount: BigInt(Math.round(amount * 100)),
        currency
    };
}

export function addMoney(a: Money | null | undefined, b: Money | null | undefined): Money {
    const amountA = getAmount(a);
    const amountB = getAmount(b);

    return {
        amount: amountA + amountB,
        currency: (a?.currency || b?.currency || 'USD')
    };
}

export function multiplyMoney(money: Money | null | undefined, multiplier: number): Money {
    if (!money || !money.amount) {
        return createMoney(0);
    }

    const amount = getAmount(money);
    return {
        amount: (amount * BigInt(Math.round(multiplier * 100))) / BigInt(100),
        currency: money.currency
    };
}

export function subtractMoney(a: Money | null | undefined, b: Money | null | undefined): Money {
    const amountA = getAmount(a);
    const amountB = getAmount(b);

    return {
        amount: amountA - amountB,
        currency: (a?.currency || b?.currency || 'USD')
    };
}

export function isPositiveMoney(money: Money | null | undefined): boolean {
    return getAmount(money) > BigInt(0);
}

export function moneyToNumber(money: Money | null | undefined): number {
    const amount = getAmount(money);
    return Number(amount) / 100;
}

export function numberToMoney(amount: number, currency: string = 'USD'): Money {
    return createMoney(amount, currency);
}