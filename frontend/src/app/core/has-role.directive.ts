import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from './auth.service';
import { UserRole } from './models';

/**
 * Muestra el contenido solo si el usuario tiene alguno de los roles indicados.
 * Uso: <button *hasRole="['admin', 'operator']">...</button>
 */
@Directive({ selector: '[hasRole]' })
export class HasRoleDirective {
  private tpl = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);
  private auth = inject(AuthService);

  readonly hasRole = input.required<UserRole[]>();

  constructor() {
    effect(() => {
      const roles = this.hasRole();
      this.vcr.clear();
      if (this.auth.hasRole(...roles)) {
        this.vcr.createEmbeddedView(this.tpl);
      }
    });
  }
}
