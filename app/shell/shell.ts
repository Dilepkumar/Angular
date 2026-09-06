import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet],        // ✅ add this
  templateUrl: './shell.html'
})
export class ShellComponent {}
