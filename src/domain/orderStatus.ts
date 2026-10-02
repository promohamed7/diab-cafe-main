// Read-only presentation of Café order and payment states. The website never
// changes these values; it only maps what Café reports into friendly wording.

import type { CafeOrderStatus, CafePaymentStatus, OrderType, PaymentMethod } from '../types/order.ts';

export interface StatusPresentation {
  label: string;
  description: string;
  icon: string;
  tone: 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'rejected';
}

export const ORDER_STATUS_PRESENTATION: Record<CafeOrderStatus, StatusPresentation> = {
  PENDING: {
    label: 'تم استلام الطلب وجارٍ مراجعته',
    description: 'وصل طلبك إلى الكافيه وينتظر تأكيد الفريق. قد يُرفض إذا نفد أحد الأصناف.',
    icon: 'hourglass_top',
    tone: 'pending'
  },
  ACCEPTED: {
    label: 'تم قبول الطلب',
    description: 'أكد فريق الكافيه طلبك وسيبدأ تحضيره قريباً.',
    icon: 'task_alt',
    tone: 'accepted'
  },
  PREPARING: {
    label: 'جاري تحضير طلبك',
    description: 'الباريستا يحضّر طلبك الآن.',
    icon: 'coffee_maker',
    tone: 'preparing'
  },
  READY: {
    label: 'طلبك جاهز',
    description: 'طلبك جاهز للتسليم.',
    icon: 'notifications_active',
    tone: 'ready'
  },
  COMPLETED: {
    label: 'تم إكمال الطلب',
    description: 'تم تسليم الطلب. نتمنى لك تجربة ممتعة.',
    icon: 'check_circle',
    tone: 'completed'
  },
  REJECTED: {
    label: 'تم رفض الطلب',
    description: 'لم يتمكن الكافيه من قبول هذا الطلب.',
    icon: 'block',
    tone: 'rejected'
  },
  CANCELLED: {
    label: 'تم إلغاء الطلب',
    description: 'تم إلغاء هذا الطلب من قبل الكافيه.',
    icon: 'cancel',
    tone: 'rejected'
  }
};

/** Normal progression shown in the stepper. REJECTED/CANCELLED are shown as alerts instead. */
export const PROGRESS_STEPS: readonly CafeOrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

export function progressIndex(status: CafeOrderStatus): number {
  return PROGRESS_STEPS.indexOf(status);
}

export function isTerminalStatus(status: CafeOrderStatus): boolean {
  return status === 'COMPLETED' || status === 'REJECTED' || status === 'CANCELLED';
}

export const PAYMENT_STATUS_LABELS: Record<CafePaymentStatus, string> = {
  PENDING: 'لم يتم الدفع بعد — الدفع عند الاستلام',
  SUBMITTED: 'تم إرسال بيانات الدفع',
  VERIFICATION_REQUIRED: 'بانتظار تحقق الكافيه من الدفع',
  VERIFIED: 'تم التحقق من الدفع',
  PAID: 'مدفوع',
  FAILED: 'لم يكتمل الدفع',
  REFUNDED: 'تم رد المبلغ',
  PARTIALLY_REFUNDED: 'تم رد جزء من المبلغ'
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  PICKUP: 'استلام من الفرع (تيك أواي)',
  DELIVERY: 'توصيل للمنزل',
  DINE_IN: 'طلب من الطاولة داخل الكافيه'
};

export function paymentMethodLabel(method: PaymentMethod, orderType: OrderType): string {
  if (orderType === 'DINE_IN') {
    return method === 'CASH' ? 'كاش للموظف داخل الكافيه' : 'بطاقة للموظف داخل الكافيه';
  }
  const when = orderType === 'DELIVERY' ? 'عند التوصيل' : 'عند الاستلام';
  return method === 'CASH' ? `الدفع كاش ${when}` : `الدفع بالبطاقة ${when}`;
}
