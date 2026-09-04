'use client';
import { useState } from 'react';
import type { ProductDetail } from '@/lib/api/types';
import { formatMoney } from '@/lib/money';
import { CATEGORY_META } from '@/lib/categories';
import { useStoreCart } from './cart-context';

export function ProductBuy({ product }: { product: ProductDetail }) {
  const available = product.variants.filter((v) => v.available);
  const [selected, setSelected] = useState(available[0]?.id || product.variants[0]?.id);
  const [added, setAdded] = useState(false);
  const cart = useStoreCart();
  const variant = product.variants.find((v) => v.id === selected);

  if (!CATEGORY_META[product.category].retail) {
    return (
      <div className="store-notice">
        This food category is priced only through an individual quote.{' '}
        <a href="/quote">Start a quote request →</a>
      </div>
    );
  }

  return (
    <div>
      <div className="store-price">{variant ? formatMoney(variant.price, variant.currency) : 'Unavailable'}</div>
      <div className="store-options" role="radiogroup" aria-label="Choose an option">
        {product.variants.map((v) => (
          <button
            type="button"
            role="radio"
            aria-checked={selected === v.id}
            disabled={!v.available}
            className={`store-option ${selected === v.id ? 'selected' : ''}`}
            onClick={() => setSelected(v.id)}
            key={v.id}
          >
            <strong>{v.name}</strong>
            <br />
            <small>{v.available ? `${v.stockQuantity} currently available` : 'Out of stock'}</small>
          </button>
        ))}
      </div>
      {variant?.available && (
        <>
          <p className="store-stock">In stock · availability is rechecked at checkout</p>
          <button
            className="store-button"
            onClick={() => {
              cart.add(product, variant);
              setAdded(true);
            }}
          >
            Add to cart
          </button>
          {added && (
            <p className="store-success" role="status">
              Added to your cart. <a href="/cart">Review cart →</a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
