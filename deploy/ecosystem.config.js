module.exports = {
  apps: [
    {
      name: 'auth-service',
      script: 'server.js',
      cwd: '/opt/ecommerce/auth-service',
      env: {
        PORT: 3001,
        DATABASE_URL: 'postgresql://ecommerce:ecommerce123@localhost:5432/ecommerce',
        JWT_SECRET: 'super-secret-key-cambiar-en-produccion',
        UPLOAD_DIR: '/opt/ecommerce/carousel-service/uploads'
      }
    },
    {
      name: 'product-service',
      script: 'server.js',
      cwd: '/opt/ecommerce/product-service',
      env: {
        PORT: 3002,
        DATABASE_URL: 'postgresql://ecommerce:ecommerce123@localhost:5432/ecommerce',
        JWT_SECRET: 'super-secret-key-cambiar-en-produccion',
        UPLOAD_DIR: '/opt/ecommerce/carousel-service/uploads'
      }
    },
    {
      name: 'order-service',
      script: 'server.js',
      cwd: '/opt/ecommerce/order-service',
      env: {
        PORT: 3003,
        DATABASE_URL: 'postgresql://ecommerce:ecommerce123@localhost:5432/ecommerce',
        JWT_SECRET: 'super-secret-key-cambiar-en-produccion'
      }
    },
    {
      name: 'report-service',
      script: 'server.js',
      cwd: '/opt/ecommerce/report-service',
      env: {
        PORT: 3004,
        DATABASE_URL: 'postgresql://ecommerce:ecommerce123@localhost:5432/ecommerce',
        JWT_SECRET: 'super-secret-key-cambiar-en-produccion'
      }
    },
    {
      name: 'carousel-service',
      script: 'server.js',
      cwd: '/opt/ecommerce/carousel-service',
      env: {
        PORT: 3005,
        DATABASE_URL: 'postgresql://ecommerce:ecommerce123@localhost:5432/ecommerce',
        JWT_SECRET: 'super-secret-key-cambiar-en-produccion'
      }
    }
  ]
};
