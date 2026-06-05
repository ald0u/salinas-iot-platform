import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Alert, CursorPage, Device, DeviceInput, DeviceStats, DeviceStatus, Reading } from './models';

@Injectable({ providedIn: 'root' })
export class DevicesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/devices`;

  list(limit = 50, cursor?: string) {
    let params = new HttpParams().set('limit', limit);
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    return this.http.get<CursorPage<Device>>(this.base, { params });
  }

  get(id: string) {
    return this.http.get<Device>(`${this.base}/${id}`);
  }

  create(input: DeviceInput) {
    return this.http.post<Device>(this.base, input);
  }

  update(id: string, input: DeviceInput) {
    return this.http.put<Device>(`${this.base}/${id}`, input);
  }

  patchStatus(id: string, status: DeviceStatus) {
    return this.http.patch<Device>(`${this.base}/${id}/status`, { status });
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  readings(id: string, limit = 50) {
    return this.http.get<CursorPage<Reading>>(`${this.base}/${id}/readings`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  deviceAlerts(id: string, limit = 50) {
    return this.http.get<{ items: Alert[] }>(`${this.base}/${id}/alerts`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  stats() {
    return this.http.get<DeviceStats>(`${this.base}/stats/summary`);
  }
}
