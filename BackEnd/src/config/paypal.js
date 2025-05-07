import axios from 'axios';

// config/paypal.js
export default {
  mode: 'sandbox',
  client_id: 'ASdJeRp0R7bgOOIJisXHP8wj99Qn9obdYy10ZVA7NVkliLjleW54wYonEZSTkpO0Y2F0kKyNYfGtR4c7',
  client_secret: 'EAsfPKoJCsOIfPepHQyaksz1cJEa0WQ1OUO8EhY3suBW0ULzFjkPNSbC4vm73xS9XJUzuBpX27tkLQ8g',
};

const PAYPAL_API_BASE =
  process.env.NODE_ENV === 'production' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.sandbox.paypal.com';

const getPayPalAccessToken = async () => {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  try {
    const response = await axios.post(`${PAYPAL_API_BASE}/v1/oauth2/token`, 'grant_type=client_credentials', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error fetching PayPal access token:', error);
    throw new Error('Unable to fetch PayPal access token');
  }
};

const createPayPalOrder = async (amount, currency = 'USD') => {
  const accessToken = await getPayPalAccessToken();
  try {
    const response = await axios.post(
      `${PAYPAL_API_BASE}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    throw new Error('Unable to create PayPal order');
  }
};

const capturePayPalOrder = async (orderId) => {
  const accessToken = await getPayPalAccessToken();
  try {
    const response = await axios.post(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    throw new Error('Unable to capture PayPal order');
  }
};

export { createPayPalOrder, capturePayPalOrder };
