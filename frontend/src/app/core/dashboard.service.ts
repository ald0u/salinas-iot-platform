import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { DashboardOverview, ReadingsAnalytics, TrendsResponse } from './models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/dashboard`;

  overview() {
    return this.http.get<DashboardOverview>(`${this.base}/overview`);
  }

  rack(rackId: string) {
    return this.http.get<{ rackId: string; totalDevices: number; byStatus: Record<string, number> }>(
      `${this.base}/rack/${rackId}`,
    );
  }

  trends(hours = 24) {
    return this.http.get<TrendsResponse>(`${this.base}/trends`, {
      params: new HttpParams().set('hours', hours),
    });
  }

  readingsAnalytics(deviceId?: string) {
    let params = new HttpParams();
    if (deviceId) {
      params = params.set('deviceId', deviceId);
    }
    return this.http.get<ReadingsAnalytics>(`${environment.apiUrl}/readings/analytics`, { params });
  }
}
