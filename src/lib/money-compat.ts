import type { Money as SquareMoney } from 'square';
import { MoneyUtils } from './square/money';
import type { SquareMoneyObject } from './square/types';

export function formatMoney(money: SquareMoneyObject | null | undefined): string {
    const converted = MoneyUtils.fromSquareMoney(money);
    return MoneyUtils.format(converted);
}

export function getAmount(money: SquareMoneyObject | null | undefined): bigint {
    const converted = MoneyUtils.fromSquareMoney(money);
    return BigInt(converted.amount);
}

export function createMoney(amount: number, currency: string = 'USD'): SquareMoney {
    return {
        amount: BigInt(Math.round(amount * 100)),
        currency
    };
}

export function addMoney(a: SquareMoneyObject | null | undefined, b: SquareMoneyObject | null | undefined): SquareMoney {
    const convertedA = MoneyUtils.fromSquareMoney(a);
    const convertedB = MoneyUtils.fromSquareMoney(b);
    const result = MoneyUtils.add(convertedA, convertedB);
    return {
        amount: BigInt(result.amount),
        currency: result.currency
    };
}

export function multiplyMoney(money: SquareMoneyObject | null | undefined, multiplier: number): SquareMoney {
    const converted = MoneyUtils.fromSquareMoney(money);
    const result = MoneyUtils.multiply(converted, multiplier);
    return {
        amount: BigInt(result.amount),
        currency: result.currency
    };
}

export function subtractMoney(a: SquareMoneyObject | null | undefined, b: SquareMoneyObject | null | undefined): SquareMoney {
    const convertedA = MoneyUtils.fromSquareMoney(a);
    const convertedB = MoneyUtils.fromSquareMoney(b);
    const result = MoneyUtils.subtract(convertedA, convertedB);
    return {
        amount: BigInt(result.amount),
        currency: result.currency
    };
}

export function isPositiveMoney(money: SquareMoneyObject | null | undefined): boolean {
    const converted = MoneyUtils.fromSquareMoney(money);
    return converted.amount > 0;
}

export function moneyToNumber(money: SquareMoneyObject | null | undefined): number {
    const converted = MoneyUtils.fromSquareMoney(money);
    return MoneyUtils.toFloat(converted);
}

export function numberToMoney(amount: number, currency: string = 'USD'): SquareMoney {
    return {
        amount: BigInt(Math.round(amount * 100)),
        currency
    };
}