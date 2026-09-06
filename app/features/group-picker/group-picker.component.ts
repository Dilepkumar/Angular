import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Group } from '../shared/models'; 

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

  groups = signal<Group[]>([]);
  showJoin = false;
  inviteCode = '';
  newGroupName = '';
  error = signal<string | null>(null);

  ngOnInit() {
    this.api.get<Group[]>('groups/my').subscribe(g => this.groups.set(g));
  }

  enter(groupId: string) {
    localStorage.setItem('rl_group_id', groupId);
    this.router.navigate(['/g', groupId, 'dashboard']);
  }

  createGroup() {
    this.api.post<{ id: string }>('groups', { groupName: this.newGroupName }).subscribe({
      next: g => this.enter(g.id),
      error: e => this.error.set(e.error?.message)
    });
  }

  joinByCode() {
    this.api.post<{ groupId: string }>('groups/join', { code: this.inviteCode }).subscribe({
      next: r => this.enter(r.groupId),
      error: e => this.error.set(e.error?.message)
    });
  }

  get me() { return this.auth.user(); }
}
