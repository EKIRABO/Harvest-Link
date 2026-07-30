# HarvestLink

HarvestLink is a full-stack agricultural supply chain management platform designed to improve coordination between farmers, buyers, transport providers, storage providers, and administrators. The platform enables users to trade agricultural produce, coordinate transportation and storage, manage reservations, communicate with stakeholders, and monitor agricultural activities through dedicated role-based dashboards.

The system was developed to reduce food loss, improve market accessibility, streamline agricultural logistics, and increase collaboration across Rwanda's agricultural supply chain.

---

# Problem Statement

Small-scale farmers often experience post-harvest losses due to limited market access, inadequate storage facilities, and poor coordination with transport providers. Buyers also struggle to locate available produce efficiently, while transport and storage providers lack a centralized platform to connect with farmers.

These challenges result in:

- Food waste and post-harvest losses
- Delayed deliveries
- Reduced farmer income
- Poor communication among stakeholders
- Limited visibility into agricultural operations

---

# Proposed Solution

HarvestLink provides a centralized web platform where:

- Farmers can list and manage produce.
- Buyers can browse and reserve produce.
- Transport providers can manage delivery requests.
- Storage providers can advertise and manage storage capacity.
- Administrators can monitor platform activities and manage users.

The platform digitizes the agricultural supply chain, making produce trading, transportation, storage, and communication more efficient.

---

# Live Demo

**Application**

https://harvest-link-hutw.onrender.com

**GitHub Repository**

https://github.com/EKIRABO/Harvest-Link

**Software Requirements Specification (SRS)**

Insert your SRS link here.

---

# System Actors

HarvestLink supports five user roles:

- Farmer
- Buyer
- Transport Provider
- Storage Provider
- Administrator

Each user has a dedicated dashboard with role-specific features and permissions.

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

- HTML5
- CSS3
- JavaScript

## Deployment

- Render
- Aiven MySQL

---

# Features

## Authentication and User Management

- User registration
- Secure login
- JWT authentication
- Role-based authorization
- Profile management
- Change password
- Forgot password
- Password reset

---

## Farmer Features

- Create produce listings
- Upload produce images
- Edit produce listings
- Delete produce listings
- Manage inventory
- Approve buyer reservations
- Record offline sales
- View sales analytics

---

## Buyer Features

- Browse marketplace
- Search produce listings
- Reserve produce
- Simulated payment
- View reservations
- Track order progress
- View order history

---

## Transport Provider Features

- Register transport services
- Accept delivery requests
- Update delivery status
- Track deliveries

---

## Storage Provider Features

- Register storage facilities
- Manage storage capacity
- Manage storage types
- Accept storage bookings

---

## Administrator Features

- Manage users
- Monitor produce listings
- Monitor reservations
- Monitor deliveries
- View audit logs
- Platform analytics
- Reports and statistics

---

## Additional Features

- Messaging
- Notifications
- Offline sales tracking
- Reservation workflow
- Simulated payment workflow
- Food-loss alerts
- Storage-capacity alerts

---

# Using the Deployed Application

No installation is required.

Visit:

https://harvest-link-hutw.onrender.com

Suggested demonstration workflow:

1. Register as a Farmer.
2. Create a produce listing.
3. Register as a Buyer.
4. Reserve produce.
5. Log in as the Farmer and approve the reservation.
6. Complete the simulated payment.
7. Register as a Transport Provider and accept the delivery request.
8. Register as a Storage Provider and create storage space for farmers.

**Note:** Test account credentials, the SQL database file, and additional submission resources are provided in the accompanying submission document for assessment purposes.

---

# Running the Project Locally

## Prerequisites

Install the following software before running the project:

- Node.js (Version 18 or later recommended)
- MySQL
- Git

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/EKIRABO/Harvest-Link.git
```

Navigate into the project folder:

```bash
cd Harvest-Link
```

---

## Step 2: Install Dependencies

Install all required Node.js packages:

```bash
npm install
```

---

## Step 3: Configure Environment Variables

Create a `.env` file in the project root and add the following variables:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=harvestlink
JWT_SECRET=your_secret_key
PORT=5000
```

If you are using the deployed Aiven database instead of a local MySQL server, replace the database credentials with your Aiven connection details.

---

## Step 4: Import the Database

Import the provided SQL database into MySQL using MySQL Workbench or phpMyAdmin.

Example SQL file:

```
harvestlink_db.sql
```

---

## Step 5: Start the Server

Run the application using:

```bash
npm start
```

or

```bash
node server.js
```

The application will start at:

```
http://localhost:5000
```

Open the application in your browser:

```
http://localhost:5000/login.html
```

---

# Project Structure

```
HarvestLink/
│
├── config/
├── middleware/
├── public/
│   ├── css/
│   ├── js/
│   ├── uploads/
│   ├── dashboard-admin.html
│   ├── dashboard-buyer.html
│   ├── dashboard-farmer.html
│   ├── dashboard-storage.html
│   ├── dashboard-transporter.html
│   ├── login.html
│   ├── register.html
│   ├── forgot-password.html
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
│   └── ...
│
├── utils/
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

---

# Password Security

HarvestLink implements secure password management using bcryptjs.

- Passwords are hashed before storage.
- Password reset tokens are securely generated.
- Reset tokens automatically expire.
- During development, reset links are displayed directly instead of being emailed because no email service has been integrated.

---

# Notes

- Payments are simulated for demonstration purposes.
- The application was developed as part of an academic Software Engineering project.
- Uploaded produce images are stored in the `public/uploads/produce` directory.
- Users can register directly through the application.
- All dashboards are role-based and accessible only to authorized users.

---

# Future Improvements

Potential future enhancements include:

- Mobile Money payment integration
- Interactive map integration
- Email notifications
- SMS notifications
- AI-powered demand prediction
- Real-time messaging using WebSockets
- Mobile application

---

# License

This project was developed as part of an academic Software Engineering assignment and is intended for educational purposes.
