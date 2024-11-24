class MoneyUtils {
  static DEFAULT_CURRENCY = "USD";
  static format(money) {
    if (!money?.amount) {
      return `$0.00`;
    }
    const amount = typeof money.amount === "bigint" ? Number(money.amount) : money.amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: money.currency || MoneyUtils.DEFAULT_CURRENCY
    }).format(amount / 100);
  }
  static fromFloat(amount, currency = MoneyUtils.DEFAULT_CURRENCY) {
    return {
      amount: Math.round(amount * 100),
      currency
    };
  }
  static toFloat(money) {
    return money.amount / 100;
  }
  static fromSquareMoney(squareMoney) {
    if (!squareMoney || !squareMoney.amount) {
      return { amount: 0, currency: MoneyUtils.DEFAULT_CURRENCY };
    }
    return {
      amount: typeof squareMoney.amount === "string" ? parseInt(squareMoney.amount, 10) : typeof squareMoney.amount === "bigint" ? Number(squareMoney.amount) : squareMoney.amount,
      currency: squareMoney.currency || MoneyUtils.DEFAULT_CURRENCY
    };
  }
  static toSquareMoney(money) {
    return {
      amount: BigInt(money.amount),
      currency: money.currency || MoneyUtils.DEFAULT_CURRENCY
    };
  }
  static add(a, b) {
    if (a.currency !== b.currency) {
      throw new Error("Cannot add money with different currencies");
    }
    return {
      amount: a.amount + b.amount,
      currency: a.currency
    };
  }
  static subtract(a, b) {
    if (a.currency !== b.currency) {
      throw new Error("Cannot subtract money with different currencies");
    }
    return {
      amount: a.amount - b.amount,
      currency: a.currency
    };
  }
  static multiply(money, multiplier) {
    return {
      amount: Math.round(money.amount * multiplier),
      currency: money.currency
    };
  }
  static isZero(money) {
    return money.amount === 0;
  }
  static isPositive(money) {
    return money.amount > 0;
  }
  static isNegative(money) {
    return money.amount < 0;
  }
  static validate(money) {
    return typeof money.amount === "number" && Number.isInteger(money.amount) && typeof money.currency === "string" && money.currency.length === 3;
  }
  static zero(currency = MoneyUtils.DEFAULT_CURRENCY) {
    return { amount: 0, currency };
  }
}

export { MoneyUtils as M };
