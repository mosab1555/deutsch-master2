// Shared domain constants — required by server (Node) and optionally loaded in browsers.
(function (g) {
  "use strict";
  const C = {
    ROLES: ["customer", "seller", "admin"],
    ORDER_STATUS: ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "returned", "refunded"],
    PAY_STATUS: ["pending", "paid", "failed", "cancelled", "refunded"],
    PAY_METHODS: ["cod", "card", "wallet"],
    SELLER_STATUS: ["pending", "approved", "suspended"],
    PRODUCT_STATUS: ["pending", "published", "hidden"],
    ERROR_CODES: ["UNAUTHENTICATED", "INVALID_TOKEN", "FORBIDDEN", "INVALID_INPUT", "NOT_FOUND", "PRODUCT_NOT_FOUND", "ORDER_NOT_FOUND", "DUPLICATE", "EMAIL_EXISTS", "INVALID_CREDENTIALS", "INSUFFICIENT_STOCK", "CART_EMPTY", "COUPON_NOT_APPLICABLE", "PAYMENTS_NOT_CONFIGURED", "INTERNAL"],
  };
  if (typeof module !== "undefined" && module.exports) module.exports = C;
  else g.DMM_CONST = C;
})(typeof self !== "undefined" ? self : this);
