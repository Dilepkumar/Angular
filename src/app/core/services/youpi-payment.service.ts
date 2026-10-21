import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, timer, switchMap, takeWhile, tap } from 'rxjs';

export type PaymentPurposeType = 'PoolContribution' | 'BillSplit' | 'ElectricitySplit' | 'IouSettlement';
export type PaymentStatusType = 'Pending' | 'Processing' | 'Success' | 'Failed' | 'Expired' | 'Cancelled';

export interface CreatePaymentSessionRequest {
  groupId: number;
  amount: number;
  purpose: PaymentPurposeType;
  referenceId?: number | null;
  description?: string;
  returnUrl?: string;
}

export interface PaymentSessionResponse {
  paymentTransactionId: number;
  orderId: string;
  amount: number;
  amountPaise: number;
  checkoutUrl: string;
  status: string;
  purpose: string;
  createdAt: string;
}

export interface PaymentTransactionStatus {
  id: number;
  groupId: number;
  payerUserId: number;
  payerName: string;
  amount: number;
  purpose: string;
  referenceId?: number;
  orderId: string;
  status: PaymentStatusType;
  bankUtr?: string;
  paymentApp?: string;
  payerVpa?: string;
  payerPhone?: string;
  verifiedAt?: string;
  failureReason?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class YoupiPaymentService {
  private api = inject(ApiService);

  /**
   * Creates a new payment session on RoomLedger backend and YouPI-PG
   */
  createSession(req: CreatePaymentSessionRequest): Observable<PaymentSessionResponse> {
    return this.api.post<PaymentSessionResponse>('payments/create-session', req);
  }

  /**
   * Fetches real-time status of a payment transaction
   */
  getStatus(orderId: string): Observable<PaymentTransactionStatus> {
    return this.api.get<PaymentTransactionStatus>(`payments/status/${orderId}`);
  }

  /**
   * Confirms payment using the Bank UTR reference or payer confirmation, recording originating app
   */
  confirmPayment(orderId: string, bankUtr?: string, paymentApp?: string): Observable<PaymentTransactionStatus> {
    return this.api.post<PaymentTransactionStatus>('payments/confirm', {
      orderId,
      bankUtr: bankUtr?.trim() || null,
      paymentApp: paymentApp?.trim() || null
    });
  }

  /**
   * Admin fetches pending payment claims for a group
   */
  getPendingApprovals(groupId: number | string): Observable<PaymentTransactionStatus[]> {
    return this.api.get<PaymentTransactionStatus[]>(`payments/pending-approvals?groupId=${groupId}`);
  }

  /**
   * Admin approves or rejects a payment claim
   */
  approvePayment(transactionId: number, approve: boolean, rejectionReason?: string): Observable<{ message: string; transaction: PaymentTransactionStatus }> {
    return this.api.post<{ message: string; transaction: PaymentTransactionStatus }>('payments/approve', {
      transactionId,
      approve,
      rejectionReason: rejectionReason?.trim() || null
    });
  }

  /**
   * Local development simulation: Triggers a mock bank webhook callback for an order
   */
  simulateWebhook(orderId: string, utr?: string): Observable<{ message: string; transaction: PaymentTransactionStatus }> {
    return this.api.post<{ message: string; transaction: PaymentTransactionStatus }>('payments/simulate-webhook', {
      orderId,
      utr: utr?.trim() || null
    });
  }

  /**
   * Polls status every intervalMs until resolved (Success, Failed, Expired, or Cancelled)
   */
  pollStatusUntilResolved(
    orderId: string, 
    intervalMs: number = 2000, 
    maxAttempts: number = 60
  ): Observable<PaymentTransactionStatus> {
    let attempts = 0;
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getStatus(orderId)),
      takeWhile(res => {
        attempts++;
        const isResolved = res.status === 'Success' || res.status === 'Failed' || res.status === 'Expired' || res.status === 'Cancelled';
        return !isResolved && attempts < maxAttempts;
      }, true) // Inclusive: emits the final resolving event
    );
  }

  /**
   * Builds standardized UPI payment intent URI
   */
  buildUpiUri(params: { vpa: string; name: string; amount: number; note: string }): string {
    const cleanVpa = (params.vpa || '').trim();
    const cleanName = (params.name || 'Flatmate').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().slice(0, 50);
    const cleanNote = (params.note || 'RoomLedger Payment').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().slice(0, 30);
    const encName = encodeURIComponent(cleanName || 'Flatmate');
    const encNote = encodeURIComponent(cleanNote || 'RoomLedger Payment');
    const amt = Number(params.amount || 0).toFixed(2);
    return `upi://pay?pa=${encodeURIComponent(cleanVpa)}&pn=${encName}&am=${amt}&tn=${encNote}&cu=INR`;
  }
}
