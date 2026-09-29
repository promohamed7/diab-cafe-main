import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

// In-memory order store for API consistency
const inMemoryOrders = new Map<string, any>();

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-server-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const urlStr = req.url || '';
          const [pathname, queryString] = urlStr.split('?');
          const searchParams = new URLSearchParams(queryString || '');

          if (req.method === 'OPTIONS') {
            res.writeHead(204, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end();
            return;
          }

          // GET /api/catalog
          if (pathname === '/api/catalog' && req.method === 'GET') {
            const storeCode = searchParams.get('store_code') || 'DIAB-SIDI-SALEM';
            sendJson(res, 200, {
              store: {
                code: storeCode,
                name: 'دياب كافيه — فرع سيدي سالم الرئيسي',
                currency: 'EGP',
                isOpen: true,
                coverageArea: 'سيدي سالم وجميع مراكز كفر الشيخ'
              },
              categories: [
                {
                  id: 'espresso',
                  name: 'مشروبات الإسبريسو والقهوة الساخنة',
                  nameEn: 'Espresso & Hot Coffee',
                  sortOrder: 1
                },
                {
                  id: 'turkish',
                  name: 'القهوة التركية التراثية',
                  nameEn: 'Traditional Turkish Coffee',
                  sortOrder: 2
                },
                {
                  id: 'beans',
                  name: 'قسم المحمصة وبن الحبوب',
                  nameEn: 'Roastery & Whole Beans',
                  sortOrder: 3,
                  isRoastery: true
                }
              ]
            });
            return;
          }

          // GET /api/tables/resolve
          if (pathname === '/api/tables/resolve' && req.method === 'GET') {
            const token = searchParams.get('token') || searchParams.get('t') || '';
            const clean = token.trim().toLowerCase();
            const numMatch = clean.match(/\d+/);
            const num = numMatch ? parseInt(numMatch[0], 10) : 1;
            sendJson(res, 200, {
              tableId: num,
              tableNumber: num < 10 ? '0' + num : String(num),
              displayLabel: `طاولة ${num}`,
              qrToken: clean || `tbl_${num}`,
              isActive: true,
              status: 'AVAILABLE'
            });
            return;
          }

          // POST /api/orders
          if (pathname === '/api/orders' && req.method === 'POST') {
            const body = await parseJsonBody(req);
            const orderId = 'ord_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            const orderNumber = 'WEB-' + (1000 + inMemoryOrders.size + 1);
            const orderSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            const createdAt = new Date().toISOString();

            const newOrder = {
              orderId,
              orderNumber,
              orderSecret,
              storeCode: body.storeCode || 'DIAB-SIDI-SALEM',
              orderType: body.orderType || 'DINE_IN',
              orderChannel: body.orderChannel || 'WEB',
              tableToken: body.tableToken || null,
              tableNumber: body.tableNumber || null,
              items: body.items || [],
              customerInfo: body.customerInfo || {},
              paymentMethod: body.paymentMethod || 'CASH',
              paymentStatus: 'PENDING',
              orderStatus: 'PENDING',
              authoritativeTotalCents: body.estimatedTotalCents || 0,
              rejectionReason: null,
              estimatedMinutesRemaining: body.orderType === 'DINE_IN' ? 8 : (body.orderType === 'PICKUP' ? 15 : 30),
              createdAt,
              updatedAt: createdAt
            };

            inMemoryOrders.set(orderId, newOrder);

            sendJson(res, 201, {
              orderId: newOrder.orderId,
              orderNumber: newOrder.orderNumber,
              orderStatus: newOrder.orderStatus,
              paymentStatus: newOrder.paymentStatus,
              orderSecret: newOrder.orderSecret,
              createdAt: newOrder.createdAt
            });
            return;
          }

          // GET /api/orders/:id/track
          const trackMatch = pathname.match(/^\/api\/orders\/([^\/]+)\/track$/);
          if (trackMatch && req.method === 'GET') {
            const orderId = trackMatch[1];
            const order = inMemoryOrders.get(orderId);
            if (!order) {
              sendJson(res, 404, { code: 'ORDER_NOT_FOUND', message: 'الطلب غير موجود' });
              return;
            }
            sendJson(res, 200, {
              orderId: order.orderId,
              orderNumber: order.orderNumber,
              orderStatus: order.orderStatus,
              paymentStatus: order.paymentStatus,
              authoritativeTotalCents: order.authoritativeTotalCents,
              rejectionReason: order.rejectionReason,
              estimatedMinutesRemaining: order.estimatedMinutesRemaining,
              updatedAt: order.updatedAt
            });
            return;
          }

          next();
        });
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  }
});
