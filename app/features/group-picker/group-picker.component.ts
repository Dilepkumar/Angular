import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

export interface MyGroup {
  id: number;
  groupName: string;
  monthlyPoolTarget: number;
  inviteCode: string | null;
  memberCount: number;
  myRole: string | null;
}

@Component({
  selector: 'app-group-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './group-picker.component.html'
})
export class GroupPickerComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  groups = signal<MyGroup[]>([]);
  showJoin = false;
  inviteCode = '';
  newGroupName = '';
  error = signal<string | null>(null);
  newGroupTarget: number | null = null;


  ngOnInit() {
    this.api.get<MyGroup[]>('groups/my').subscribe(g => this.groups.set(g));
  }

  enter(groupId: number) {
    localStorage.setItem('rl_group_id', String(groupId));
    this.router.navigate(['/g', groupId, 'dashboard']);
  }

  createGroup() {
    if (!this.newGroupName.trim()) {
    this.error.set('Enter a group name first');
    return;
  }
  this.api.post<{ id: number }>('groups', {
    groupName: this.newGroupName,
    monthlyPool: this.newGroupTarget ?? 0
  }).subscribe({
    next: g => this.enter(g.id),
    error: e => this.error.set(e.error?.message)
  });
}

  joinByCode() {
    this.api.post<{ groupId: number }>('groups/join', { code: this.inviteCode }).subscribe({
      next: r => this.enter(r.groupId),
      error: e => this.error.set(e.error?.message)
    });
  }

  get me() { return this.auth.user(); }
}
