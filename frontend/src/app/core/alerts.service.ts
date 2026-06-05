import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Alert, CursorPage } from './models';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/alerts`;

  list(limit = 100, cursor?: string) {
    let params = new HttpParams().set('limit', limit);
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    return this.http.get<CursorPage<Alert>>(this.base, { params });
  }

  acknowledge(id: string) {
    return this.http.patch<Alert>(`${this.base}/${id}/acknowledge`, {});
  }

  resolve(id: string) {
    return this.http.patch<Alert>(`${this.base}/${id}/resolve`, {});
  }
}
