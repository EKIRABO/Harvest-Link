# HarvestLink

HarvestLink is a full-stack agricultural coordination platform designed to connect **farmers, buyers, transport providers, storage providers, and administrators** within a single system. The platform streamlines agricultural operations by providing role-based dashboards, produce marketplace functionality, transport coordination, storage management, buyer reservations, simulated payments, messaging, notifications, offline sales tracking, and administrative reporting.

## Live Application

https://your-deployed-url-here.com

---

# Technology Stack

## Backend
- Node.js
- Express.js
- MySQL
- JWT Authentication
- bcryptjs
- Multer

## Frontend
- HTML
- CSS
- JavaScript

---

# Features

## Authentication & User Management

- User registration and login
- JWT authentication
- Role-based authorization
- Profile management
- Change password
- Forgot & Reset password

---

## Produce Marketplace

- Create, edit and delete produce listings
- Image upload support
- Browse and search produce
- Market demand posting
- Reservation approval workflow
- Automatic reservation expiration
- Simulated payments

---

## Transport Coordination

- Register transport services
- Accept transport requests
- Delivery tracking
- Delivery status updates

---

## Storage Management

- Register storage facilities
- Manage multiple storage types
- Capacity management
- Storage booking workflow

---

## Communication

- Direct messaging
- Real-time notifications

---

## Sales Tracking

- Record offline sales
- Online reservation sales
- Monthly sales analytics
- Produce sales reports

---

## Administration

- User management
- Produce listing oversight
- Platform analytics
- Reservation monitoring
- Delivery monitoring
- Reports and analytics
- Audit logs
- Food-loss and storage-capacity alerts

---

# Using HarvestLink

No installation is required to use the deployed application.

1. Open the live application.
2. Register as one of the available roles:
   - Farmer
   - Buyer
   - Transport Provider
   - Storage Provider
3. Log in to access your role-specific dashboard.

### Suggested Workflow

1. Register as a Farmer and create a produce listing.
2. Register as a Buyer and reserve produce.
3. Approve the reservation as the Farmer.
4. Complete the simulated payment.
5. Register as a Transport Provider and accept the delivery request.
6. Register as a Storage Provider and create storage space for farmers to book.

---

# Running the Project Locally

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/HarvestLink.git
```

## 2. Navigate into the Project

```bash
cd HarvestLink
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Configure Environment Variables

Create a `.env` file in the project root and configure the following variables:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=harvestlink
JWT_SECRET=your_secret_key
PORT=5000
```

## 5. Import the Database

Import the provided SQL file into MySQL using phpMyAdmin or MySQL Workbench. This creates the database schema required for the application to run.

Example:

```
harvestlink.sql
```

## 6. Start the Server

```bash
npm start
```

or

```bash
node server.js
```

The application will be available at:

```
http://localhost:5000
```

---

# Project Structure

```
HarvestLink/
│
├── public/
│   ├── js/
│   ├── uploads/
│   ├── dashboard-admin.html
│   ├── dashboard-buyer.html
│   ├── dashboard-farmer.html
│   ├── dashboard-storage.html
│   ├── dashboard-transporter.html
│   ├── forgot-password.html
│   ├── listings.html
│   ├── login.html
│   ├── register.html
│   ├── reset-password.html
│   └── ...
│
├── routes/
│   ├── admin.js
│   ├── alerts.js
│   ├── analytics.js
│   ├── auth.js
│   ├── delivery.js
│   ├── market.js
│   ├── messages.js
│   ├── notifications.js
│   ├── offlineSales.js
│   ├── payments.js
│   ├── produce.js
│   ├── reservations.js
│   ├── storage.js
│   ├── storageBookings.js
│   ├── transport.js
│   └── utils/
│
├── .env
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

---

# Password Reset

HarvestLink includes a secure password reset feature.

- Passwords are securely hashed using **bcryptjs**.
- Reset tokens are securely generated and expire automatically.
- During development, reset links are used directly instead of being emailed because no email service has been configured.

---

# Notes

- Payments are simulated for demonstration purposes.
- The application is developed for educational purposes.
- Test account credentials are provided separately.
