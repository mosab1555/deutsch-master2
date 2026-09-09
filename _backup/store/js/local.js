/* DMM — local-only helpers: guest cart/wishlist, recently viewed, search history.
   IndexedDB is NO LONGER the data source; these are UI preferences + guest cart only. */
(function (g) {
  "use strict";
  const J = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const L = {
    guestCart: () => J.get("dmm-cart", []),
    setGuestCart: items => J.set("dmm-cart", items),
    clearGuestCart: () => J.del("dmm-cart"),
    guestWish: () => J.get("dmm-wish", []),
    setGuestWish: w => J.set("dmm-wish", w),
    viewedAdd(pid) { const v = J.get("dmm-viewed", []).filter(x => x !== pid); v.unshift(pid); J.set("dmm-viewed", v.slice(0, 20)); },
    viewedIds: () => J.get("dmm-viewed", []),
    searchAdd(q) {
      q = String(q || "").trim().slice(0, 80); if (!q) return;
      const h = J.get("dmm-search", []);
      h.unshift({ q, n: 1, at: Date.now() });
      const merged = [];
      h.forEach(x => { const f = merged.find(m => m.q === x.q); if (f) f.n++; else merged.push({ q: x.q, n: x.n || 1 }); });
      J.set("dmm-search", merged.slice(0, 30));
    },
    recentSearches: () => J.get("dmm-search", []).slice(0, 6).map(x => x.q),
    popularSearches: () => [...J.get("dmm-search", [])].sort((a, b) => b.n - a.n).slice(0, 8).map(x => x.q),
  };
  g.DMM_LOCAL = L;
})(typeof self !== "undefined" ? self : this);
