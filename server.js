const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const HOST = '0.0.0.0';
const WEBSITE_DIR = path.join(__dirname, 'website');
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// ============================================================
// IN-MEMORY STORE FOR ORDERS & SESSIONS
// ============================================================
const inMemoryOrders = new Map();

// Sample Verified Tables
const VERIFIED_TABLES = {
  'tbl_01': { tableId: 1, tableNumber: '01', displayLabel: 'طاولة 1 — الصالة الرئيسية', qrToken: 'tbl_01', isActive: true, status: 'AVAILABLE' },
  'tbl_02': { tableId: 2, tableNumber: '02', displayLabel: 'طاولة 2 — ركن العائلات', qrToken: 'tbl_02', isActive: true, status: 'AVAILABLE' },
  'tbl_03': { tableId: 3, tableNumber: '03', displayLabel: 'طاولة 3 — بجوار النافذة', qrToken: 'tbl_03', isActive: true, status: 'AVAILABLE' },
  'tbl_04': { tableId: 4, tableNumber: '04', displayLabel: 'طاولة 4 — ركن الباريستا', qrToken: 'tbl_04', isActive: true, status: 'AVAILABLE' },
  'tbl_05': { tableId: 5, tableNumber: '05', displayLabel: 'طاولة 5 — الشرفة الخارجية', qrToken: 'tbl_05', isActive: true, status: 'AVAILABLE' },
  'tbl_06': { tableId: 6, tableNumber: '06', displayLabel: 'طاولة 6 — الصالة الداخلية', qrToken: 'tbl_06', isActive: true, status: 'AVAILABLE' },
  'tbl_07': { tableId: 7, tableNumber: '07', displayLabel: 'طاولة 7 — الصالة الرئيسية', qrToken: 'tbl_07', isActive: true, status: 'AVAILABLE' },
  'tbl_08': { tableId: 8, tableNumber: '08', displayLabel: 'طاولة 8 — ركن هادئ', qrToken: 'tbl_08', isActive: true, status: 'AVAILABLE' },
  'tbl_09': { tableId: 9, tableNumber: '09', displayLabel: 'طاولة 9 — بجوار المحمصة', qrToken: 'tbl_09', isActive: true, status: 'AVAILABLE' },
  'tbl_10': { tableId: 10, tableNumber: '10', displayLabel: 'طاولة 10 — VIP Lounge', qrToken: 'tbl_10', isActive: true, status: 'AVAILABLE' },
};

// Helper: send JSON response with standard CORS & security headers
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(data));
}

// Helper: read incoming request body
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // Guard against oversized bodies (> 1MB)
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', err => reject(err));
  });
}

// ============================================================
// HTTP REQUEST ROUTER
// ============================================================
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // -----------------------------------------------------------
  // 15.1: GET /api/catalog
  // -----------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/catalog') {
    const storeCode = parsedUrl.query.store_code || 'DIAB-SIDI-SALEM';

    const catalogResponse = {
      store: {
        code: storeCode,
        name: 'دياب كافيه — فرع سيدي سالم الرئيسي',
        currency: 'EGP',
        isOpen: true,
        address: 'سيدي سالم، كفر الشيخ — أمام بنك مصر'
      },
      categories: [
        {
          id: 'espresso',
          name: 'إسبريسو ومشروبات القهوة',
          nameEn: 'Espresso & Coffee',
          sortOrder: 1,
          products: [
            { id: 101, name: 'ريستريتو', nameEn: 'Ristretto', sellingPriceCents: 3500, inStock: true, description: 'شوت إسبريسو مركز بنكهة قوية غنية وكريما ذهبية' },
            { id: 102, name: 'إسبريسو سينجل', nameEn: 'Single Espresso', sellingPriceCents: 4000, inStock: true, description: 'جرعة إسبريسو كلاسيكية من محصول أرابيكا نقي' },
            { id: 104, name: 'إسبريسو دبل', nameEn: 'Double Espresso', sellingPriceCents: 5000, inStock: true, description: 'جرعة مضاعفة تمنحك طاقة وتركيز فوري' },
            { id: 106, name: 'كورتادو', nameEn: 'Cortado', sellingPriceCents: 5000, inStock: true, description: 'توازن متساوي بين الإسبريسو والحليب المبخر بنعومة' },
            { id: 107, name: 'كابتشينو', nameEn: 'Cappuccino', sellingPriceCents: 5500, inStock: true, description: 'طبقات متناغمة من الإسبريسو والحليب مع رغوة كريمية غنية' },
            { id: 108, name: 'فلات وايت', nameEn: 'Flat White', sellingPriceCents: 5500, inStock: true, description: 'دبل ريستريتو مع مايكروفوم حليبي حريري بدون فقاعات' },
            { id: 109, name: 'سبانيش لاتيه', nameEn: 'Spanish Latte', sellingPriceCents: 6000, inStock: true, description: 'إسبريسو ممزوج بالحليب المكثف المحلى بنكهة دافئة' }
          ]
        },
        {
          id: 'turkish',
          name: 'القهوة التركية التراثية',
          nameEn: 'Traditional Turkish Coffee',
          sortOrder: 2,
          products: [
            { id: 201, name: 'قهوة تركي سينجل', nameEn: 'Single Turkish Coffee', sellingPriceCents: 3000, inStock: true, description: 'تحضير على الرمالة ببن برازيلي كولومبي مطحون ناعم' },
            { id: 202, name: 'قهوة تركي دبل', nameEn: 'Double Turkish Coffee', sellingPriceCents: 4500, inStock: true, description: 'فنجان مزدوج غني بالرغوة الوفيرة والنكهة الأصيلة' },
            { id: 203, name: 'قهوة تركي محوج مخصوص', nameEn: 'Spiced Special Turkish', sellingPriceCents: 4000, inStock: true, description: 'تحويجة دياب السرية بهيل فاخر ومستكة وزعفران' }
          ]
        },
        {
          id: 'beans',
          name: 'قسم المحمصة وبن الحبوب',
          nameEn: 'Roastery & Whole Beans',
          sortOrder: 3,
          isRoastery: true,
          products: [
            { id: 1401, name: 'بن تركي بليند دياب الفاخر', nameEn: 'Diab Signature Turkish Blend', sellingPriceCents: 16000, inStock: true, description: 'توليفة خاصة من البن البرازيلي الفاخر والكولومبي المعالج بالغسيل' },
            { id: 1404, name: 'بن كولومبيا سوبريمو', nameEn: 'Colombia Supremo', sellingPriceCents: 21000, inStock: true, description: 'حموضة متزنة وإيحاءات الفواكه المجففة مع لمسات الكراميل والشوكولاتة' },
            { id: 1405, name: 'بن إثيوبيا يرجاتشيفي', nameEn: 'Ethiopia Yirgacheffe', sellingPriceCents: 23000, inStock: true, description: 'إيحاءات أزهار الياسمين والخوخ المجفف بحموضة فاكهية ساحرة' }
          ]
        }
      ]
    };

    sendJson(res, 200, catalogResponse);
    return;
  }

  // -----------------------------------------------------------
  // 15.2: GET /api/tables/resolve
  // -----------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/tables/resolve') {
    const rawToken = parsedUrl.query.token || parsedUrl.query.table || parsedUrl.query.t || '';
    const cleanToken = String(rawToken).trim().toLowerCase();

    // Standardize token lookup (supports '3', 'tbl_03', 'tbl_3', 'tbl_9f83a8f4c2e1')
    let foundTable = VERIFIED_TABLES[cleanToken];

    if (!foundTable) {
      // Check by numeric string
      const numMatch = cleanToken.match(/\d+/);
      if (numMatch) {
        const num = parseInt(numMatch[0], 10);
        const paddedKey = `tbl_${num < 10 ? '0' + num : num}`;
        foundTable = VERIFIED_TABLES[paddedKey];
        if (!foundTable && num >= 1 && num <= 50) {
          // Dynamically valid in-store table
          foundTable = {
            tableId: num,
            tableNumber: num < 10 ? '0' + num : String(num),
            displayLabel: `طاولة ${num}`,
            qrToken: `tbl_${num}`,
            isActive: true,
            status: 'AVAILABLE'
          };
        }
      }
    }

    if (foundTable) {
      sendJson(res, 200, foundTable);
    } else {
      sendJson(res, 404, {
        code: 'TABLE_INACTIVE_OR_INVALID',
        message: 'عذراً، رمز الطاولة غير صالح أو غير متاح حالياً.',
        tableToken: rawToken
      });
    }
    return;
  }

  // -----------------------------------------------------------
  // 15.3: POST /api/orders
  // -----------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/orders') {
    try {
      const body = await parseRequestBody(req);

      // Validate required payload fields
      if (!body.orderType || !Array.isArray(body.items) || body.items.length === 0) {
        sendJson(res, 400, {
          code: 'INVALID_ORDER_PAYLOAD',
          message: 'بيانات الطلب غير مكتملة. يجب تحديد نوع الطلب والأصناف المطلوبة.'
        });
        return;
      }

      // Generate authoritative server keys
      const orderId = 'ord_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      const orderNumber = 'WEB-' + (1000 + inMemoryOrders.size + 1);
      const orderSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const createdAt = new Date().toISOString();

      const newOrder = {
        orderId,
        orderNumber,
        orderSecret,
        storeCode: body.storeCode || 'DIAB-SIDI-SALEM',
        orderType: body.orderType,
        orderChannel: body.orderChannel || (body.orderType === 'DINE_IN' ? 'TABLE_QR' : 'WEB'),
        tableToken: body.tableToken || null,
        tableNumber: body.tableNumber || null,
        items: body.items,
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
    } catch (err) {
      console.error('Error handling POST /api/orders:', err);
      sendJson(res, 500, {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في معالجة الطلب على الخادم. يرجى المحاولة مرة أخرى.'
      });
      return;
    }
  }

  // -----------------------------------------------------------
  // 15.4: GET /api/orders/:id/track (or /api/orders/track?id=...&secret=...)
  // -----------------------------------------------------------
  const trackPathMatch = pathname.match(/^\/api\/orders\/([^\/]+)\/track$/);
  if (req.method === 'GET' && (trackPathMatch || pathname === '/api/orders/track')) {
    const orderId = trackPathMatch ? trackPathMatch[1] : (parsedUrl.query.id || parsedUrl.query.orderId);
    const secret = parsedUrl.query.secret;

    if (!orderId) {
      sendJson(res, 400, {
        code: 'MISSING_ORDER_ID',
        message: 'معرف الطلب (orderId) مطلوب.'
      });
      return;
    }

    const order = inMemoryOrders.get(orderId);

    if (!order) {
      sendJson(res, 404, {
        code: 'ORDER_NOT_FOUND',
        message: 'لم يتم العثور على الطلب المطلوب في قاعدة بيانات الخادم.'
      });
      return;
    }

    if (secret && order.orderSecret !== secret) {
      sendJson(res, 403, {
        code: 'INVALID_ORDER_SECRET',
        message: 'رمز الأمان الخاص بالطلب غير مطابق.'
      });
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

  // -----------------------------------------------------------
  // BARISTA / SIMULATION HELPER: POST /api/orders/:id/status
  // -----------------------------------------------------------
  const statusPathMatch = pathname.match(/^\/api\/orders\/([^\/]+)\/status$/);
  if (req.method === 'POST' && (statusPathMatch || pathname === '/api/orders/status')) {
    try {
      const orderId = statusPathMatch ? statusPathMatch[1] : (parsedUrl.query.id || parsedUrl.query.orderId);
      const body = await parseRequestBody(req);
      const order = inMemoryOrders.get(orderId);

      if (!order) {
        sendJson(res, 404, { code: 'ORDER_NOT_FOUND', message: 'الطلب غير موجود.' });
        return;
      }

      if (body.status) {
        order.orderStatus = body.status;
        order.updatedAt = new Date().toISOString();
        if (body.rejectionReason) order.rejectionReason = body.rejectionReason;
        if (body.status === 'COMPLETED' || body.status === 'READY') {
          order.estimatedMinutesRemaining = 0;
        } else if (body.status === 'PREPARING') {
          order.estimatedMinutesRemaining = 6;
        }
      }

      sendJson(res, 200, {
        success: true,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        updatedAt: order.updatedAt
      });
      return;
    } catch (err) {
      sendJson(res, 500, { code: 'STATUS_UPDATE_ERROR', message: err.message });
      return;
    }
  }

  // -----------------------------------------------------------
  // 16. DESKTOP POS SYNC POLL: GET /api/sync/orders
  // -----------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/sync/orders') {
    const queuedOrders = Array.from(inMemoryOrders.values()).filter(o => o.orderStatus === 'PENDING');
    sendJson(res, 200, {
      storeCode: parsedUrl.query.store_code || 'DIAB-SIDI-SALEM',
      count: queuedOrders.length,
      orders: queuedOrders
    });
    return;
  }

  // ===========================================================
  // STATIC FILES HANDLER
  // ===========================================================
  let normalizedPath = pathname;
  if (normalizedPath.startsWith('/website/')) {
    normalizedPath = normalizedPath.substring('/website'.length);
  }
  if (normalizedPath === '/' || normalizedPath === '') {
    normalizedPath = '/index.html';
  }

  const safePath = path.normalize(normalizedPath).replace(/^(\.\.[\/\\])+/, '');
  
  // Try WEBSITE_DIR first, then ROOT_DIR
  let filePath = path.join(WEBSITE_DIR, safePath);
  if (!fs.existsSync(filePath)) {
    const rootPath = path.join(ROOT_DIR, safePath);
    if (fs.existsSync(rootPath)) {
      filePath = rootPath;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head><meta charset="UTF-8"><title>404 — الصفحة غير موجودة</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 4rem 1rem; background: #120F0D; color: #F4EDE4;">
          <h1 style="color: #F4BD61;">404 — الصفحة غير موجودة</h1>
          <p>الملف المطلوب (${pathname}) غير متاح.</p>
          <a href="/" style="color: #C8963E; text-decoration: none; font-weight: bold;">العودة للرئيسية</a>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(` DIAB CAFE — API & Web Server is running live!`);
  console.log(` Listening on: http://${HOST}:${PORT}`);
  console.log(` REST Endpoints active:`);
  console.log(`  - 15.1: GET  /api/catalog?store_code=DIAB-SIDI-SALEM`);
  console.log(`  - 15.2: GET  /api/tables/resolve?token=tbl_03`);
  console.log(`  - 15.3: POST /api/orders`);
  console.log(`  - 15.4: GET  /api/orders/:id/track?secret=...`);
  console.log(`  - 16.0: GET  /api/sync/orders (POS Sync)`);
  console.log(`====================================================`);
});
