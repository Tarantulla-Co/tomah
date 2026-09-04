'use client';
import { useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { api, ApiError, devConfirmOrder, type OrderCreateResponse } from '@/lib/api';
import { useStoreCart } from './cart-context';
import { formatMoney } from '@/lib/money';

const field = (form: FormData, name: string) => String(form.get(name) || '').trim();

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(publicKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publicKey);
  return stripePromise;
}

/** Cards, Apple Pay and Google Pay all render from this one Payment Element —
 *  which wallets show up is decided by Stripe (based on the browser/device and
 *  what's enabled on the account), not by anything here. */
function PayButton({ orderNumber, email }: { orderNumber: string; email: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const returnUrl = new URL('/checkout/callback', window.location.origin);
    returnUrl.searchParams.set('orderNumber', orderNumber);
    returnUrl.searchParams.set('email', email);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl.toString() },
    });
    // Only reachable on immediate failure (card declined, validation, etc.) —
    // success navigates the browser to return_url instead of resolving here.
    if (confirmError) {
      setError(confirmError.message || 'Payment failed. Please try another method.');
      setBusy(false);
    }
  }

  return (
    <form className="store-form" onSubmit={confirm}>
      <PaymentElement />
      {error && <p className="store-error" role="alert">{error}</p>}
      <button className="store-button" disabled={!stripe || busy}>
        {busy ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  );
}

function StripeCheckout({ order, email }: { order: OrderCreateResponse; email: string }) {
  if (!order.payment.clientSecret || !order.payment.publicKey) {
    return <p className="store-error" role="alert">Payment could not be started. Please contact support.</p>;
  }
  return (
    <Elements
      stripe={getStripe(order.payment.publicKey)}
      options={{ clientSecret: order.payment.clientSecret, appearance: { theme: 'stripe' } }}
    >
      <PayButton orderNumber={order.orderNumber} email={email} />
    </Elements>
  );
}

export function CheckoutForm() {
  const cart = useStoreCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<OrderCreateResponse | null>(null);
  const [email, setEmail] = useState('');
  const [devConfirmed, setDevConfirmed] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    const customerEmail = field(f, 'email');
    try {
      const response = await api.createOrder({
        customer: { name: field(f, 'name'), email: customerEmail, phone: field(f, 'phone') },
        shippingAddress: {
          line1: field(f, 'line1'), line2: field(f, 'line2') || undefined, city: field(f, 'city'),
          region: field(f, 'region'), postalCode: field(f, 'postalCode'), country: field(f, 'country'),
        },
        items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variant.id, quantity: i.quantity })),
        currency: 'USD',
      });
      setOrder(response);
      setEmail(customerEmail);
      sessionStorage.setItem('tomah-last-order', JSON.stringify({ orderNumber: response.orderNumber, email: customerEmail }));
      cart.clear();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not create the order. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmManually() {
    if (!order?.payment.devConfirmPath) return;
    setBusy(true);
    try {
      await devConfirmOrder(order.payment.devConfirmPath);
      setDevConfirmed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm the order.');
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <main id="main" className="store-main">
        <div className="store-success">
          <p className="store-kicker">Order created</p>
          <h1>{order.orderNumber}</h1>
          <p>
            The API confirmed a total of <strong>{formatMoney(order.amounts.total, order.amounts.currency)}</strong>.
            Payment status is confirmed only by Tomah's server.
          </p>
        </div>
        {order.payment.online ? (
          <StripeCheckout order={order} email={email} />
        ) : devConfirmed ? (
          <p className="store-notice">
            Payment simulated (dev mode). <a href={`/checkout/callback?orderNumber=${order.orderNumber}&email=${encodeURIComponent(email)}`}>Check order status →</a>
          </p>
        ) : order.payment.devConfirmPath ? (
          <div className="store-notice">
            <p>Online collection is off in this environment (PAYMENT_PROVIDER=manual). Simulate a successful payment to continue testing the flow.</p>
            <button className="store-button" onClick={confirmManually} disabled={busy}>
              {busy ? 'Confirming…' : 'Simulate payment success (dev only)'}
            </button>
          </div>
        ) : (
          <p className="store-notice">Your order is awaiting payment confirmation. Tomah will be in touch.</p>
        )}
        {error && <p className="store-error" role="alert">{error}</p>}
      </main>
    );
  }

  return (
    <main id="main" className="store-main">
      <p className="store-kicker">Secure retail checkout</p>
      <h1 className="store-title">Delivery details</h1>
      <div className="store-notice">Cart prices are estimates. Tomah rechecks stock and returns the authoritative shipping, tax and total before payment.</div>
      {!cart.items.length ? (
        <p>Your cart is empty. <a href="/products">Browse products.</a></p>
      ) : (
        <form className="store-form" onSubmit={submit}>
          <div className="store-fields">
            <label className="store-field">Full name<input required name="name" autoComplete="name" className="store-input" /></label>
            <label className="store-field">Email<input required type="email" name="email" autoComplete="email" className="store-input" /></label>
            <label className="store-field">Phone<input required type="tel" name="phone" autoComplete="tel" className="store-input" /></label>
            <label className="store-field store-wide">Address<input required name="line1" autoComplete="shipping address-line1" className="store-input" /></label>
            <label className="store-field store-wide">Apartment, suite or unit (optional)<input name="line2" autoComplete="shipping address-line2" className="store-input" /></label>
            <label className="store-field">City<input required name="city" autoComplete="shipping address-level2" className="store-input" /></label>
            <label className="store-field">State / region<input required name="region" autoComplete="shipping address-level1" className="store-input" /></label>
            <label className="store-field">Postal code<input required name="postalCode" autoComplete="shipping postal-code" className="store-input" /></label>
            <label className="store-field">Country<input required name="country" defaultValue="US" autoComplete="shipping country" className="store-input" maxLength={2} /></label>
          </div>
          {error && <p className="store-error" role="alert">{error}</p>}
          <button className="store-button" disabled={busy}>{busy ? 'Creating order…' : 'Review total and continue'}</button>
        </form>
      )}
    </main>
  );
}
