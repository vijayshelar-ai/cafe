# Chai-K Café Website

A mobile-first, animated café ordering website with:
- High-end landing page using the supplied café photo
- Responsive menu for phone/tablet/laptop
- Category filters
- Customer registration/login
- Add-to-cart + quantity controls
- Table selection and order placement
- SQLite database for customers, menu and orders
- Admin login/dashboard
- Admin view of customer name, table number, items, bill and status
- Live admin refresh every 10 seconds
- GSAP + Lucide animations/icons

## Run locally

1. Install Node.js 18+.
2. Open this folder in a terminal.
3. Run:
   npm install
   npm start
4. Open:
   http://localhost:3000

## Admin

Email: admin@chaikcafe.com
Password: admin123

Change these before production and set a strong JWT_SECRET environment variable.

## Production notes

For a real café launch, add:
- Razorpay/UPI payment integration
- WhatsApp/SMS order notification
- Kitchen display screen
- QR code for each table
- Cloud image storage
- HTTPS + secure cookies
- Strong environment secrets
- Rate limiting and server-side validation
- Menu management in admin
- Customer order history/profile
