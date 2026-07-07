# 🛍️ MarketHub E-Commerce Platform

**Full-stack e-commerce solution with custom Linux-based backend infrastructure**

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript)](https://github.com/jesus3131/MarketHub-E-Commerce)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react)](https://github.com/jesus3131/MarketHub-E-Commerce)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js)](https://github.com/jesus3131/MarketHub-E-Commerce)
[![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux)](https://github.com/jesus3131/MarketHub-E-Commerce)

---

## 📋 Overview

MarketHub is a comprehensive e-commerce platform demonstrating full-stack development capabilities:

- **Frontend**: Modern React UI with responsive design
- **Backend**: Custom Node.js server built from scratch
- **Infrastructure**: Linux server deployed on VirtualBox
- **Database**: PostgreSQL for persistent storage
- **Features**: Product catalog, shopping cart, checkout, order management

---

## ✨ Key Features

### 🛒 Shopping Experience
- Product catalog with categories
- Search & filtering capabilities
- Shopping cart management
- Checkout process
- Order history & tracking

### 🏪 Admin Panel
- Product management (CRUD)
- Inventory tracking
- Order management dashboard
- Sales analytics

### 🔒 Security
- User authentication
- Secure payment processing
- Input validation & sanitization
- CORS protection

---

## 🛠️ Technology Stack

| Layer | Technologies |
|-------|------------|
| **Frontend** | React, JavaScript, CSS3 |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL |
| **Infrastructure** | Linux (VirtualBox) |
| **Server** | Custom-built from scratch |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Linux environment (or VirtualBox VM)

### Installation

```bash
# Clone the repository
git clone https://github.com/jesus3131/MarketHub-E-Commerce.git
cd MarketHub-E-Commerce

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npm run migrate

# Start the server
npm run dev
```

### Development URLs
- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000
- **Docs**: http://localhost:5000/api/docs

---

## 📁 Project Structure

```
MarketHub-E-Commerce/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API calls
│   │   └── styles/        # CSS files
│   └── public/
├── server/                 # Node.js backend
│   ├── routes/            # API routes
│   ├── controllers/        # Request handlers
│   ├── models/            # Data models
│   ├── middleware/        # Custom middleware
│   └── config/            # Configuration files
├── database/              # Database setup & migrations
└── README.md
```

---

## 📊 Key Endpoints

### Products
```
GET    /api/products           # List all products
GET    /api/products/:id       # Get product details
POST   /api/products           # Create product (admin)
PUT    /api/products/:id       # Update product (admin)
DELETE /api/products/:id       # Delete product (admin)
```

### Orders
```
POST   /api/orders             # Create order
GET    /api/orders             # Get user orders
GET    /api/orders/:id         # Get order details
PUT    /api/orders/:id/status  # Update order status
```

### Users
```
POST   /api/auth/register      # Register
POST   /api/auth/login         # Login
GET    /api/users/profile      # Get profile
PUT    /api/users/profile      # Update profile
```

---

## 🔄 Deployment

### Linux Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js & PostgreSQL
sudo apt install nodejs postgresql -y

# Clone and setup
git clone <repo-url>
cd MarketHub-E-Commerce
npm install
npm run build

# Start with PM2
npm install -g pm2
pm2 start server.js
pm2 save
```

---

## 📝 License

This project is licensed under the MIT License - see LICENSE.md for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

<div align="center">

Made with ❤️ by Jesus Rafael

[⬆ Back to top](#-marketplace-e-commerce-platform)

</div>
