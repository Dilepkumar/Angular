import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import {
  ElectricityBiller,
  ElectricityBillerDetail,
  ElectricityAccount,
  ElectricityBill,
  ElectricityMonitoringStatus,
  ElectricityBillSplits
} from '../../features/shared/models';

export interface CreateElectricityAccountPayload {
  groupId: number;
  billerId: string;
  consumerNumber?: string;
  customerParameters: Record<string, string>;
  expectedBillDayOfMonth?: number | null;
}

export interface CheckBillResponse {
  message: string;
  account: ElectricityAccount;
  bill?: ElectricityBill | null;
  limitReached?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ElectricityService {
  private api = inject(ApiService);

  getBillers(): Observable<ElectricityBiller[]> {
    return this.api.get<ElectricityBiller[]>('electricity/billers');
  }

  getBillerDetails(billerId: string): Observable<ElectricityBillerDetail> {
    return this.api.get<ElectricityBillerDetail>(`electricity/billers/${encodeURIComponent(billerId)}`);
  }

  getAccounts(groupId: number): Observable<ElectricityAccount[]> {
    return this.api.get<ElectricityAccount[]>(`electricity/accounts?groupId=${groupId}`);
  }

  getAccount(id: number): Observable<ElectricityAccount> {
    return this.api.get<ElectricityAccount>(`electricity/accounts/${id}`);
  }

  createAccount(payload: CreateElectricityAccountPayload): Observable<ElectricityAccount> {
    return this.api.post<ElectricityAccount>('electricity/accounts', payload);
  }

  updateAccount(id: number, payload: { expectedBillDayOfMonth?: number | null; isActive?: boolean }): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`electricity/accounts/${id}`, payload);
  }

  checkBill(id: number): Observable<CheckBillResponse> {
    return this.api.post<CheckBillResponse>(`electricity/accounts/${id}/check`, {});
  }

  getLatestBill(id: number): Observable<ElectricityBill> {
    return this.api.get<ElectricityBill>(`electricity/accounts/${id}/bill`);
  }

  getMonitoringStatus(id: number): Observable<ElectricityMonitoringStatus> {
    return this.api.get<ElectricityMonitoringStatus>(`electricity/accounts/${id}/monitoring`);
  }

  getSplits(id: number, billId?: number): Observable<ElectricityBillSplits> {
    const url = billId ? `electricity/accounts/${id}/splits?billId=${billId}` : `electricity/accounts/${id}/splits`;
    return this.api.get<ElectricityBillSplits>(url);
  }
}
