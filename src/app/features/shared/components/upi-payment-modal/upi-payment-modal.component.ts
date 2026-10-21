import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { YoupiPaymentService, PaymentPurposeType, PaymentSessionResponse, PaymentTransactionStatus } from '../../../../core/services/youpi-payment.service';
import { PopupService } from '../../../../core/services/popup.service';
import { environment } from '../../../../../environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-upi-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  template: `
    @if (isOpen) {
      <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-[99999] fade-up"
           (click)="onBackdropClick($event)">
        
        <div class="w-full sm:max-w-md md:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]"
             style="background: var(--card); border: 1.5px solid var(--border);"
             (click)="$event.stopPropagation()">

          <!-- Mobile Drawer Pull Pill (Matches Mobile.mp4 Bottom Drawer) -->
          <div class="sm:hidden pt-2.5 pb-0 flex justify-center shrink-0" style="background: linear-gradient(135deg, #1ABC9C 0%, #16A085 100%);">
            <div class="w-10 h-1 rounded-full bg-white/40"></div>
          </div>

          <!-- ════════════ MODAL HEADER ════════════ -->
          <div class="p-5 sm:p-6 text-white flex items-center justify-between shrink-0 relative overflow-hidden"
               style="background: linear-gradient(135deg, #1ABC9C 0%, #16A085 100%);">
            
            <div class="flex items-center gap-3 relative z-10">
              <div class="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/20 border border-white/30 text-white shadow-sm shrink-0">
                <i class="fa-solid fa-bolt text-lg"></i>
              </div>
              <div>
                <h3 class="text-base sm:text-lg font-black tracking-tight leading-none text-white">
                  {{ step() === 'success' ? 'Payment Verified!' : step() === 'submitted' ? 'Proof Submitted!' : 'Pay with UPI' }}
                </h3>
                <p class="text-[11px] font-semibold text-white/80 mt-1">
                  {{ purposeTitle }} · Direct-to-Bank · 0% Fee
                </p>
              </div>
            </div>

            <button type="button"
                    (click)="closeModal()"
                    class="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 border border-white/30 text-white hover:bg-white/30 transition cursor-pointer relative z-10">
              <i class="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          <!-- ════════════ MODAL BODY ════════════ -->
          <div class="p-5 sm:p-6 overflow-y-auto space-y-4">

            <!-- STEP: CREATING SESSION -->
            @if (step() === 'creating') {
              <div class="py-12 text-center flex flex-col items-center justify-center space-y-3">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md animate-pulse"
                     style="background: color-mix(in srgb, #1ABC9C 15%, transparent); color: #1ABC9C; border: 1.5px solid color-mix(in srgb, #1ABC9C 30%, transparent);">
                  <i class="fa-solid fa-circle-notch fa-spin text-2xl"></i>
                </div>
                <div class="text-sm font-black" style="color: var(--text);">Generating Secure UPI Session…</div>
                <div class="text-xs" style="color: var(--t3);">Preparing direct peer-to-peer payment slot</div>
              </div>
            }

            <!-- STEP: ACTIVE PAYMENT -->
            @else if (step() === 'active') {

              <!-- HERO AMOUNT BANNER -->
              <div class="p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xs"
                   style="background: color-mix(in srgb, #1ABC9C 8%, var(--card)); border-color: color-mix(in srgb, #1ABC9C 30%, transparent);">
                <div>
                  <div class="text-[10px] font-extrabold tracking-wider uppercase" style="color: var(--t3);">
                    AMOUNT TO PAY
                  </div>
                  <div class="text-2xl sm:text-3xl font-black mt-0.5 flex items-baseline gap-1" style="color: var(--text);">
                    <span style="color: #1ABC9C;">₹</span>
                    <span>{{ amount | number:'1.2-2' }}</span>
                  </div>
                </div>

                <div class="text-right">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
                        style="background: rgba(26, 188, 156, 0.12); color: #16A085; border-color: rgba(26, 188, 156, 0.3);">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Single-Slot Queue</span>
                  </span>
                  <div class="text-[10px] font-mono font-medium mt-1 text-right" style="color: var(--t3);">
                    {{ activeSession()?.orderId }}
                  </div>
                </div>
              </div>

              <!-- DUAL TIMER PROGRESS BAR -->
              <div class="p-3 rounded-xl border flex items-center justify-between text-xs font-bold"
                   style="background: var(--bg2); border-color: var(--border);">
                <span class="inline-flex items-center gap-1.5" style="color: var(--t2);">
                  <i class="fa-regular fa-clock text-amber-500"></i>
                  <span>Session Expires In:</span>
                </span>
                <span class="font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                  {{ formatTimer(remainingSeconds()) }}
                </span>
              </div>

              <!-- MISSING RECIPIENT UPI ID PROMPT (Shows if payee has no UPI ID or placeholder) -->
              @if (!isVpaConfigured()) {
                <div class="p-3.5 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                  <div class="flex items-center gap-2 font-black text-xs text-amber-600 dark:text-amber-400">
                    <i class="fa-solid fa-triangle-exclamation text-sm"></i>
                    <span>{{ recipientName }} hasn't added their UPI ID</span>
                  </div>
                  <p class="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    Enter <strong>{{ recipientName }}'s UPI ID</strong> (e.g. mobile&#64;ybl, name&#64;okaxis) so you can pay them directly:
                  </p>
                  <div class="flex items-center gap-2">
                    <input type="text"
                           [ngModel]="editableVpa()"
                           (ngModelChange)="onVpaChange($event)"
                           placeholder="e.g. 9876543210@ybl or username@okaxis"
                           class="flex-1 px-3 py-2 text-xs font-mono font-bold rounded-xl border bg-white dark:bg-slate-800 border-amber-500/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>
              }

              <!-- RECIPIENT & VPA CARD WITH 1-TAP COPY -->
              <div class="p-3.5 rounded-2xl border flex items-center justify-between gap-3 shadow-xs"
                   style="background: var(--bg2); border-color: var(--border);">
                <div class="min-w-0 flex-1">
                  <div class="text-[10px] font-black tracking-wider uppercase" style="color: var(--t3);">
                    PAYING TO
                  </div>
                  <div class="text-xs sm:text-[13px] font-black truncate" style="color: var(--text);">
                    {{ recipientName }}
                  </div>

                  @if (isEditingVpa()) {
                    <div class="mt-1 flex items-center gap-1.5">
                      <input type="text"
                             [ngModel]="editableVpa()"
                             (ngModelChange)="onVpaChange($event)"
                             placeholder="e.g. mobile@ybl or name@okaxis"
                             class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border bg-white dark:bg-slate-800 border-emerald-500 text-slate-900 dark:text-white flex-1 min-w-0" />
                      <button type="button" 
                              (click)="isEditingVpa.set(false)" 
                              class="text-[10px] px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold shrink-0 cursor-pointer">
                        Done
                      </button>
                    </div>
                  } @else {
                    <div class="font-mono text-[11px] font-bold truncate flex items-center gap-1.5 mt-0.5" style="color: var(--p1);">
                      <span>{{ isVpaConfigured() ? effectiveVpa() : 'No UPI ID Set' }}</span>
                      <button type="button" 
                              (click)="isEditingVpa.set(true)" 
                              class="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1 ml-1" 
                              title="Edit UPI ID">
                        <i class="fa-solid fa-pen-to-square text-[9px]"></i>
                        <span>Edit</span>
                      </button>
                    </div>
                  }
                </div>

                <button type="button"
                        (click)="copyVpa()"
                        [disabled]="!isVpaConfigured()"
                        class="px-3 py-2 rounded-xl border text-xs font-black cursor-pointer shadow-xs transition active:scale-95 shrink-0 flex items-center gap-1.5 disabled:opacity-40"
                        [style.background]="copiedVpa() ? 'var(--ok)' : 'var(--card)'"
                        [style.borderColor]="copiedVpa() ? 'var(--ok)' : 'var(--border)'"
                        [style.color]="copiedVpa() ? 'white' : 'var(--text)'"
                        title="Copy Recipient UPI ID">
                  <i class="fa-solid" [ngClass]="copiedVpa() ? 'fa-check' : 'fa-copy'"></i>
                  <span>{{ copiedVpa() ? 'Copied!' : 'Copy UPI' }}</span>
                </button>
              </div>

              <!-- AUTO-REDIRECT / RETURN HELPER NOTE -->
              <div class="p-2.5 rounded-xl border flex items-center gap-2.5 text-[11px] leading-relaxed"
                   style="background: color-mix(in srgb, #1ABC9C 8%, var(--bg2)); border-color: color-mix(in srgb, #1ABC9C 25%, transparent); color: var(--text);">
                <i class="fa-solid fa-arrow-left-rotate text-emerald-500 text-xs shrink-0"></i>
                <div>
                  <strong>Auto-Verify:</strong> After entering your PIN in PhonePe/GPay, <strong>return to this tab</strong> to see your instant verified receipt.
                </div>
              </div>

              <!-- 1-TAP MOBILE UPI APP LAUNCHERS (Targeting App Packages Directly) -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="sl">1-TAP PAY WITH ANY UPI APP</label>
                  <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    Active: {{ selectedApp() }}
                  </span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  
                  <!-- Google Pay -->
                  <a [href]="getAppUri('gpay')"
                     (click)="openApp('gpay', 'Google Pay', $event)"
                     class="p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition transform active:scale-95 no-underline group shadow-xs cursor-pointer relative"
                     [class.opacity-60]="!isVpaConfigured()"
                     [style.background]="selectedApp() === 'Google Pay' ? 'color-mix(in srgb, #1ABC9C 10%, var(--bg2))' : 'var(--bg2)'"
                     [style.borderColor]="selectedApp() === 'Google Pay' ? '#1ABC9C' : 'var(--border)'">
                    @if (selectedApp() === 'Google Pay') {
                      <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
                    }
                    <i class="fa-brands fa-google text-lg text-blue-500 group-hover:scale-110 transition-transform"></i>
                    <span class="text-[11px] font-black" style="color: var(--text);">Google Pay</span>
                  </a>

                  <!-- PhonePe -->
                  <a [href]="getAppUri('phonepe')"
                     (click)="openApp('phonepe', 'PhonePe', $event)"
                     class="p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition transform active:scale-95 no-underline group shadow-xs cursor-pointer relative"
                     [class.opacity-60]="!isVpaConfigured()"
                     [style.background]="selectedApp() === 'PhonePe' ? 'color-mix(in srgb, #1ABC9C 10%, var(--bg2))' : 'var(--bg2)'"
                     [style.borderColor]="selectedApp() === 'PhonePe' ? '#1ABC9C' : 'var(--border)'">
                    @if (selectedApp() === 'PhonePe') {
                      <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
                    }
                    <i class="fa-solid fa-mobile-screen-button text-lg text-purple-600 group-hover:scale-110 transition-transform"></i>
                    <span class="text-[11px] font-black" style="color: var(--text);">PhonePe</span>
                  </a>

                  <!-- Paytm -->
                  <a [href]="getAppUri('paytm')"
                     (click)="openApp('paytm', 'Paytm', $event)"
                     class="p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition transform active:scale-95 no-underline group shadow-xs cursor-pointer relative"
                     [class.opacity-60]="!isVpaConfigured()"
                     [style.background]="selectedApp() === 'Paytm' ? 'color-mix(in srgb, #1ABC9C 10%, var(--bg2))' : 'var(--bg2)'"
                     [style.borderColor]="selectedApp() === 'Paytm' ? '#1ABC9C' : 'var(--border)'">
                    @if (selectedApp() === 'Paytm') {
                      <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
                    }
                    <i class="fa-solid fa-wallet text-lg text-cyan-600 group-hover:scale-110 transition-transform"></i>
                    <span class="text-[11px] font-black" style="color: var(--text);">Paytm</span>
                  </a>

                  <!-- Any UPI / CRED -->
                  <a [href]="getAppUri('generic')"
                     (click)="openApp('generic', 'Other UPI', $event)"
                     class="p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition transform active:scale-95 no-underline group shadow-xs cursor-pointer relative"
                     [class.opacity-60]="!isVpaConfigured()"
                     [style.background]="selectedApp() === 'Other UPI' ? 'color-mix(in srgb, #1ABC9C 10%, var(--bg2))' : 'var(--bg2)'"
                     [style.borderColor]="selectedApp() === 'Other UPI' ? '#1ABC9C' : 'var(--border)'">
                    @if (selectedApp() === 'Other UPI') {
                      <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
                    }
                    <i class="fa-solid fa-qrcode text-lg text-emerald-600 group-hover:scale-110 transition-transform"></i>
                    <span class="text-[11px] font-black" style="color: var(--text);">Other UPI</span>
                  </a>
                </div>
              </div>

              <!-- QR CODE WITH SAVE TO GALLERY OPTION -->
              <div class="border rounded-2xl p-3.5" style="border-color: var(--border); background: var(--bg2);">
                <div class="flex items-center justify-between cursor-pointer"
                     (click)="toggleQr()">
                  <div class="flex items-center gap-2">
                    <i class="fa-solid fa-qrcode text-sm" style="color: #1ABC9C;"></i>
                    <span class="text-xs font-bold" style="color: var(--text);">
                      Scan UPI QR or Save to Gallery
                    </span>
                  </div>
                  <i class="fa-solid fa-chevron-down text-xs transition-transform"
                     [class.rotate-180]="showQr()"
                     style="color: var(--t3);"></i>
                </div>

                @if (showQr()) {
                  <div class="mt-3 pt-3 border-t flex flex-col items-center justify-center gap-2.5"
                       style="border-color: var(--border);">
                    @if (isVpaConfigured()) {
                      <div class="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                        <canvas #qrCanvas class="max-w-[190px] h-auto"></canvas>
                      </div>

                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          Listening for live bank payment…
                        </span>
                      </div>

                      <div class="flex items-center gap-2 flex-wrap justify-center w-full">
                        <button type="button"
                                (click)="saveQrToPhotos()"
                                class="text-[11px] font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer hover:bg-black/5"
                                style="border-color: #1ABC9C; color: #16A085;">
                          <i class="fa-solid fa-download"></i>
                          <span>{{ savedQrToPhotos() ? 'Saved to Gallery!' : 'Save QR to Photos' }}</span>
                        </button>

                        <button type="button"
                                (click)="copyUpiLink()"
                                class="text-[11px] font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer hover:bg-black/5"
                                style="border-color: var(--border); color: var(--p1);">
                          <i class="fa-regular fa-copy"></i>
                          <span>{{ copiedUpi() ? 'Copied Link!' : 'Copy Raw UPI Link' }}</span>
                        </button>
                      </div>

                      <div class="text-[10px] text-center font-medium max-w-xs" style="color: var(--t3);">
                        Tip: If your UPI app blocks web links, tap <strong>Save QR to Photos</strong>, then open PhonePe/Paytm ➔ Scanner ➔ Gallery to pay seamlessly.
                      </div>
                    } @else {
                      <div class="p-4 text-center text-xs font-bold text-amber-600 dark:text-amber-400 space-y-1">
                        <i class="fa-solid fa-triangle-exclamation text-base"></i>
                        <div>Please enter {{ recipientName }}'s UPI ID above to generate the payment QR code.</div>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- LOCALHOST / TESTING BANK WEBHOOK SIMULATOR (Only shown in Development/Localhost) -->
              @if (isDevMode()) {
                <div class="p-3 rounded-2xl border border-dashed flex flex-col items-center gap-2"
                     style="background: color-mix(in srgb, #6366f1 8%, var(--bg2)); border-color: color-mix(in srgb, #6366f1 35%, transparent);">
                  <div class="w-full flex items-center justify-between text-[11px]">
                    <span class="font-black flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <i class="fa-solid fa-flask"></i>
                      <span>Local Test Simulator</span>
                    </span>
                    <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold">
                      Dev Webhook Sim
                    </span>
                  </div>
                  <button type="button"
                          (click)="simulateBankPayment()"
                          [disabled]="isSimulating()"
                          class="w-full py-2.5 px-3 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50">
                    @if (isSimulating()) {
                      <i class="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      <span>Simulating Bank Webhook…</span>
                    } @else {
                      <i class="fa-solid fa-bolt text-xs text-amber-300"></i>
                      <span>Simulate Successful Bank Payment</span>
                    }
                  </button>
                  <div class="text-[10px] text-center" style="color: var(--t3);">
                    Dev test helper &rarr; triggers simulated bank webhook &rarr; auto-verifies
                  </div>
                </div>
              }

              <!-- VERIFY PAYMENT / UTR CONFIRMATION -->
              <div class="pt-2 space-y-2">
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-extrabold uppercase tracking-wider" style="color: var(--t2);">
                      12-Digit Bank Reference (UTR)
                    </span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style="background: var(--bg2); border-color: var(--border); color: var(--t3);">
                      Admin Verified
                    </span>
                  </div>
                  <input class="inp text-xs font-mono w-full"
                         type="text"
                         maxlength="22"
                         [(ngModel)]="inputUtr"
                         placeholder="e.g. 428901234567 (From GPay / PhonePe / Bank app)" />
                  <div class="text-[10px] flex items-center justify-between" style="color: var(--t3);">
                    <span>Paying with: <strong class="text-emerald-600 dark:text-emerald-400 font-bold">{{ selectedApp() }}</strong></span>
                    <span class="text-amber-500 dark:text-amber-400 font-semibold"><i class="fa-solid fa-shield-halved text-[9px] mr-1"></i>Cross-checked by Admin</span>
                  </div>
                </div>

                <button type="button"
                        (click)="triggerVerification()"
                        [disabled]="isVerifying()"
                        class="btn w-full py-3.5 text-sm font-black shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        style="background: linear-gradient(135deg, #1ABC9C 0%, #16A085 100%);">
                  @if (isVerifying()) {
                    <i class="fa-solid fa-circle-notch fa-spin text-base"></i>
                    <span>Submitting Proof…</span>
                  } @else {
                    <i class="fa-solid fa-paper-plane text-base"></i>
                    <span>I've Paid — Submit for Verification</span>
                  }
                </button>
                <div class="text-[11px] text-center font-medium" style="color: var(--t3);">
                  Direct peer-to-peer bank transfer · Zero transaction fees
                </div>
              </div>

            }

            <!-- STEP: SUCCESS CELEBRATION (AUTO-APPROVED / ADMIN) -->
            <!-- STEP: SUCCESS CELEBRATION (MATCHES YOUPI PG CERTIFIED SCREEN) -->
            @else if (step() === 'success') {
              <div class="py-5 text-center flex flex-col items-center justify-center space-y-3.5 fade-up">
                
                <!-- Animated Luminous Checkmark Circle (Matches Screenshot) -->
                <div class="relative flex items-center justify-center">
                  <div class="w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500 text-white text-3xl shadow-xl shadow-emerald-500/35 border-4 border-emerald-400/30 transition transform scale-105">
                    <i class="fa-solid fa-check"></i>
                  </div>
                  <div class="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping -z-10"></div>
                </div>

                <!-- Headline & Subtitle -->
                <div>
                  <h2 class="text-2xl font-black tracking-tight" style="color: var(--text);">
                    Payment Successful!
                  </h2>
                  <p class="text-xs font-medium max-w-xs mx-auto mt-1 leading-relaxed" style="color: var(--t2);">
                    Your transaction has been processed and automatically verified by YOUPI PG banking observers.
                  </p>
                </div>

                <!-- Verified Pill Badge (Matches Image 2) -->
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black border tracking-wider uppercase shadow-xs"
                     style="background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.35); color: #10B981;">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>VERIFIED BY YOUPI PG</span>
                </div>

                <!-- Prominent Amount Display (Matches Image 1) -->
                <div class="text-3xl font-black text-emerald-500 dark:text-emerald-400 tracking-tight">
                  ₹{{ amount | number:'1.2-2' }}
                </div>

                <!-- Structured Transaction Receipt Card (Matches Image 2) -->
                <div class="w-full p-4 rounded-2xl border text-left text-xs space-y-2.5 shadow-sm"
                     style="background: var(--bg2); border-color: var(--border);">
                  <div class="flex justify-between items-center py-0.5">
                    <span style="color: var(--t3);">Order ID</span>
                    <span class="font-mono font-bold text-xs" style="color: var(--text);">
                      {{ activeSession()?.orderId }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center py-0.5 border-t" style="border-color: var(--border);">
                    <span style="color: var(--t3);">Amount Received</span>
                    <span class="font-extrabold text-sm text-emerald-500 dark:text-emerald-400">
                      ₹{{ amount | number:'1.2-2' }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center py-0.5 border-t" style="border-color: var(--border);">
                    <span style="color: var(--t3);">Payment Mode</span>
                    <span class="font-bold flex items-center gap-1.5" style="color: var(--text);">
                      <i class="fa-solid fa-bolt text-emerald-500 text-[10px]"></i>
                      <span>{{ verifiedApp() || selectedApp() || 'UPI' }}</span>
                    </span>
                  </div>
                  <div class="flex justify-between items-center py-0.5 border-t" style="border-color: var(--border);">
                    <span style="color: var(--t3);">Bank Reference (UTR)</span>
                    <span class="font-mono font-bold text-xs" style="color: var(--text);">
                      {{ verifiedUtr() || 'Direct Confirmation' }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center py-0.5 border-t" style="border-color: var(--border);">
                    <span style="color: var(--t3);">Purpose</span>
                    <span class="font-bold" style="color: var(--text);">
                      {{ purposeTitle }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center py-0.5 border-t" style="border-color: var(--border);">
                    <span style="color: var(--t3);">Status</span>
                    <span class="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <i class="fa-solid fa-circle-check text-xs"></i>
                      <span>SUCCESS (Auto-verified)</span>
                    </span>
                  </div>
                </div>

                <!-- Done & Refresh Ledger Action Button -->
                <button type="button"
                        (click)="finishAndClose()"
                        class="btn w-full py-3.5 text-sm font-black shadow-lg cursor-pointer transition active:scale-98"
                        style="background: linear-gradient(135deg, #10B981 0%, #059669 100%);">
                  <i class="fa-solid fa-check mr-1.5"></i>
                  <span>Done &amp; Refresh Ledger</span>
                </button>
              </div>
            }

            <!-- STEP: SUBMITTED FOR ADMIN APPROVAL (MEMBER) -->
            @else if (step() === 'submitted') {
              <div class="py-6 text-center flex flex-col items-center justify-center space-y-4">
                
                <!-- Amber Clock Icon -->
                <div class="w-16 h-16 rounded-full flex items-center justify-center bg-amber-500/20 text-amber-500 text-3xl border border-amber-500/30 shadow-lg shadow-amber-500/20">
                  <i class="fa-solid fa-clock-rotate-left"></i>
                </div>

                <div>
                  <div class="text-xl font-black" style="color: var(--text);">
                    Payment Proof Submitted!
                  </div>
                  <div class="text-xs font-semibold text-amber-500 dark:text-amber-400 mt-1 flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-clock text-xs"></i>
                    <span>Awaiting Group Admin Verification</span>
                  </div>
                </div>

                <div class="w-full p-4 rounded-2xl border text-left text-xs space-y-2.5 shadow-xs"
                     style="background: var(--bg2); border-color: var(--border);">
                  <div class="flex justify-between items-center">
                    <span style="color: var(--t3);">Amount Claimed:</span>
                    <span class="font-extrabold text-sm" style="color: var(--text);">₹{{ amount | number:'1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span style="color: var(--t3);">Payment App:</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">
                      <i class="fa-solid fa-mobile-screen-button mr-1"></i>{{ verifiedApp() || selectedApp() }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span style="color: var(--t3);">Bank Reference (UTR):</span>
                    <span class="font-mono font-bold text-amber-500 dark:text-amber-400">{{ verifiedUtr() || 'Not Provided' }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span style="color: var(--t3);">Purpose:</span>
                    <span class="font-bold" style="color: var(--text);">{{ purposeTitle }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span style="color: var(--t3);">Order ID:</span>
                    <span class="font-mono text-[11px]" style="color: var(--t3);">{{ activeSession()?.orderId }}</span>
                  </div>
                </div>

                <div class="p-3 rounded-xl border text-[11px] leading-relaxed text-amber-600 dark:text-amber-400"
                     style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.25);">
                  <i class="fa-solid fa-circle-info mr-1"></i>
                  The Group Admin has been notified. Once they verify your bank transfer, your share will automatically be marked as Paid.
                </div>

                <button type="button"
                        (click)="finishAndClose()"
                        class="btn w-full py-3.5 text-sm font-black shadow-md"
                        style="background: #1ABC9C;">
                  Done
                </button>
              </div>
            }

            <!-- STEP: ERROR / EXPIRED -->
            @else if (step() === 'error') {
              <div class="py-8 text-center flex flex-col items-center justify-center space-y-3">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-500/10 text-rose-500 text-2xl border border-rose-500/30">
                  <i class="fa-solid fa-circle-exclamation"></i>
                </div>
                <div class="text-sm font-black" style="color: var(--err);">Payment Session Expired or Failed</div>
                <div class="text-xs max-w-xs" style="color: var(--t3);">{{ errorMessage() || 'No bank credit was captured within the session window.' }}</div>
                
                <div class="flex gap-2 w-full pt-3">
                  <button type="button" (click)="closeModal()" class="btns flex-1 py-3 text-xs font-bold">Cancel</button>
                  <button type="button" (click)="initPaymentSession()" class="btn flex-2 py-3 text-xs font-black" style="background:#1ABC9C;">
                    Try Again
                  </button>
                </div>
              </div>
            }

          </div>

        </div>
      </div>
    }
  `
})
export class UpiPaymentModalComponent implements OnInit, OnDestroy {
  private paymentService = inject(YoupiPaymentService);
  private popup = inject(PopupService);

  private _isOpen = signal<boolean>(false);
  @Input()
  set isOpen(val: boolean) {
    const prev = this._isOpen();
    this._isOpen.set(val);
    if (val && !prev) {
      setTimeout(() => {
        if (this._isOpen()) {
          this.initPaymentSession();
        }
      }, 50);
    } else if (!val && prev) {
      this.clearAllTimers();
    }
  }
  get isOpen(): boolean {
    return this._isOpen();
  }

  @Input() groupId!: number | string;
  @Input() amount!: number;
  @Input() purpose: PaymentPurposeType = 'PoolContribution';
  @Input() purposeTitle: string = 'Pool Fund Contribution';
  @Input() referenceId?: number | null;
  @Input() recipientVpa: string = 'roomledger@upi';
  @Input() recipientName: string = 'RoomLedger Pool';

  @Output() paymentSuccess = new EventEmitter<{ orderId: string; utr?: string; amount: number; isApproved?: boolean }>();
  @Output() modalClosed = new EventEmitter<void>();

  @ViewChild('qrCanvas') qrCanvas?: ElementRef<HTMLCanvasElement>;

  // Component State
  step = signal<'creating' | 'active' | 'success' | 'submitted' | 'error'>('creating');
  activeSession = signal<PaymentSessionResponse | null>(null);
  selectedApp = signal<string>('Google Pay');
  verifiedApp = signal<string | null>(null);
  showQr = signal<boolean>(false);
  copiedUpi = signal<boolean>(false);
  copiedVpa = signal<boolean>(false);
  savedQrToPhotos = signal<boolean>(false);
  editableVpa = signal<string>('');
  isEditingVpa = signal<boolean>(false);
  inputUtr: string = '';

  // Timers
  remainingSeconds = signal<number>(300); // 5:00 payment window
  private timerInterval?: any;
  private statusPollingInterval?: any;

  // Verification 30-sec polling & Local Simulator
  isVerifying = signal<boolean>(false);
  isSimulating = signal<boolean>(false);
  isDevMode = signal<boolean>(
    !environment.production || 
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  );
  verificationCountdown = signal<number>(30);
  private verifySub?: Subscription;
  private verifyTimerInterval?: any;

  // Final Results
  verifiedUtr = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    // Session initialization is handled reactively by isOpen setter
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }

  selectApp(appName: string): void {
    this.selectedApp.set(appName);
  }

  toggleQr(): void {
    const next = !this.showQr();
    this.showQr.set(next);
    if (next) {
      this.selectedApp.set('QR Scanner');
      setTimeout(() => this.renderQrCode(), 50);
    }
  }

  initPaymentSession(): void {
    const numAmt = Number(this.amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setTimeout(() => {
        if (this._isOpen() && Number(this.amount) > 0) {
          this.initPaymentSession();
        }
      }, 50);
      return;
    }

    this.clearAllTimers();
    this.step.set('creating');
    this.errorMessage.set(null);
    this.remainingSeconds.set(300);
    const initialVpa = this.recipientVpa && this.recipientVpa.toLowerCase() !== 'roomledger@upi' ? this.recipientVpa.trim() : '';
    this.editableVpa.set(initialVpa);
    this.isEditingVpa.set(!this.isVpaValid(initialVpa));

    const numericGroupId = Number(this.groupId);
    const numericRefId = (this.referenceId != null && (this.referenceId as any) !== '') 
      ? Number(this.referenceId) 
      : null;

    const req = {
      groupId: isNaN(numericGroupId) ? 1 : numericGroupId,
      amount: numAmt,
      purpose: this.purpose,
      referenceId: (numericRefId != null && !isNaN(numericRefId)) ? numericRefId : null,
      description: `${this.purposeTitle} - ₹${numAmt}`
    };

    this.paymentService.createSession(req).subscribe({
      next: (session) => {
        this.activeSession.set(session);
        this.step.set('active');
        this.startSessionTimer();
        this.startStatusPolling(session.orderId);

        // Render QR in next tick once canvas exists
        setTimeout(() => this.renderQrCode(), 100);
      },
      error: (e) => {
        this.step.set('error');
        this.errorMessage.set(e.error?.message || 'Could not initialize payment session.');
      }
    });
  }

  private startSessionTimer(): void {
    this.timerInterval = setInterval(() => {
      this.remainingSeconds.update(s => {
        if (s <= 1) {
          clearInterval(this.timerInterval);
          this.clearAllTimers();
          this.step.set('error');
          this.errorMessage.set('Payment session expired (5:00 min window elapsed).');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  private startStatusPolling(orderId: string): void {
    if (this.statusPollingInterval) clearInterval(this.statusPollingInterval);
    this.statusPollingInterval = setInterval(() => {
      const currentStep = this.step();
      // Poll while in active payment or while submitted awaiting verification
      if (currentStep !== 'active' && currentStep !== 'submitted') {
        if (this.statusPollingInterval) {
          clearInterval(this.statusPollingInterval);
          this.statusPollingInterval = undefined;
        }
        return;
      }

      this.paymentService.getStatus(orderId).subscribe({
        next: (status) => {
          if (status.status === 'Success') {
            this.handlePaymentSuccess(status);
          } else if (status.status === 'Failed') {
            this.clearAllTimers();
            this.step.set('error');
            this.errorMessage.set(status.failureReason || 'Payment rejected or failed.');
          }
        },
        error: () => {
          // Tolerate temporary network hiccups
        }
      });
    }, 2500);
  }

  simulateBankPayment(): void {
    const session = this.activeSession();
    if (!session || this.isSimulating()) return;
    this.isSimulating.set(true);

    const mockUtr = '4289' + Math.floor(10000000 + Math.random() * 90000000).toString();
    this.paymentService.simulateWebhook(session.orderId, mockUtr).subscribe({
      next: (res) => {
        this.isSimulating.set(false);
        this.handlePaymentSuccess(res.transaction);
      },
      error: (err) => {
        this.isSimulating.set(false);
        this.popup.error(err.error?.message || 'Failed to simulate bank webhook callback.');
      }
    });
  }

  formatTimer(totalSecs: number): string {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  isVpaValid(vpa?: string | null): boolean {
    if (!vpa) return false;
    const clean = vpa.trim().toLowerCase();
    return clean !== '' && clean !== 'roomledger@upi' && clean.includes('@') && clean.length >= 4;
  }

  isVpaConfigured(): boolean {
    return this.isVpaValid(this.effectiveVpa());
  }

  private getUpiUri(): string {
    const cleanNote = (this.purposeTitle || 'RoomLedger Payment').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().slice(0, 30);
    return this.paymentService.buildUpiUri({
      vpa: this.effectiveVpa(),
      name: this.recipientName,
      amount: this.amount,
      note: cleanNote
    });
  }

  effectiveVpa(): string {
    const edit = this.editableVpa()?.trim();
    if (edit) return edit;
    const vpa = this.recipientVpa?.trim();
    return vpa && vpa.toLowerCase() !== 'roomledger@upi' ? vpa : '';
  }

  copyVpa(): void {
    const vpa = this.effectiveVpa();
    if (!this.isVpaValid(vpa)) {
      this.isEditingVpa.set(true);
      this.popup.warning(`Please enter ${this.recipientName}'s UPI ID first.`);
      return;
    }
    navigator.clipboard.writeText(vpa).then(() => {
      this.copiedVpa.set(true);
      setTimeout(() => this.copiedVpa.set(false), 2500);
    });
  }

  onVpaChange(newVpa: string): void {
    this.editableVpa.set(newVpa);
    if (this.isVpaValid(newVpa)) {
      setTimeout(() => this.renderQrCode(), 50);
    }
  }

  saveQrToPhotos(): void {
    if (!this.qrCanvas?.nativeElement) return;
    try {
      const dataUrl = this.qrCanvas.nativeElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `UPI-QR-${this.amount}INR.png`;
      a.click();
      this.savedQrToPhotos.set(true);
      setTimeout(() => this.savedQrToPhotos.set(false), 3000);
    } catch {
      this.popup.info('Screenshot the QR code on your screen to upload to PhonePe / Paytm gallery.');
    }
  }

  openApp(appCode: 'gpay' | 'phonepe' | 'paytm' | 'generic', appLabel: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    if (!this.isVpaConfigured()) {
      this.isEditingVpa.set(true);
      this.popup.warning(`Please enter ${this.recipientName}'s UPI ID before opening ${appLabel}.`);
      return;
    }

    this.selectApp(appLabel);
    const uri = this.getAppUri(appCode);
    if (uri && uri !== 'javascript:void(0)') {
      window.location.href = uri;
    }
  }

  getAppUri(app: 'gpay' | 'phonepe' | 'paytm' | 'generic'): string {
    const vpa = this.effectiveVpa();
    if (!this.isVpaValid(vpa)) {
      return 'javascript:void(0)';
    }

    const cleanName = (this.recipientName || 'Flatmate').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().slice(0, 50);
    const cleanNote = (this.purposeTitle || 'RoomLedger Payment').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().slice(0, 30);
    const name = encodeURIComponent(cleanName || 'Flatmate');
    const note = encodeURIComponent(cleanNote || 'RoomLedger Payment');
    const amt = Number(this.amount || 0).toFixed(2);
    const query = `pa=${encodeURIComponent(vpa)}&pn=${name}&am=${amt}&tn=${note}&cu=INR`;

    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
    const isAndroid = /android/i.test(ua);
    const isIos = /iphone|ipad|ipod/i.test(ua);

    if (isAndroid) {
      switch (app) {
        case 'phonepe':
          return `intent://pay?${query}#Intent;scheme=upi;package=com.phonepe.app;end`;
        case 'gpay':
          return `intent://pay?${query}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        case 'paytm':
          return `intent://pay?${query}#Intent;scheme=upi;package=net.one97.paytm;end`;
        default:
          return `upi://pay?${query}`;
      }
    } else if (isIos) {
      switch (app) {
        case 'phonepe':
          return `phonepe://pay?${query}`;
        case 'gpay':
          return `gpay://upi/pay?${query}`;
        case 'paytm':
          return `paytmmp://pay?${query}`;
        default:
          return `upi://pay?${query}`;
      }
    }

    return `upi://pay?${query}`;
  }

  renderQrCode(): void {
    if (!this.qrCanvas?.nativeElement || !this.isVpaConfigured()) return;
    const uri = this.getUpiUri();
    QRCode.toCanvas(this.qrCanvas.nativeElement, uri, {
      width: 190,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' }
    });
  }

  copyUpiLink(): void {
    if (!this.isVpaConfigured()) {
      this.isEditingVpa.set(true);
      this.popup.warning(`Please enter ${this.recipientName}'s UPI ID first.`);
      return;
    }
    const uri = this.getUpiUri();
    navigator.clipboard.writeText(uri).then(() => {
      this.copiedUpi.set(true);
      setTimeout(() => this.copiedUpi.set(false), 2500);
    });
  }

  triggerVerification(): void {
    if (this.isVerifying()) return;
    const session = this.activeSession();
    if (!session) return;

    this.isVerifying.set(true);
    this.verificationCountdown.set(15);

    this.verifyTimerInterval = setInterval(() => {
      this.verificationCountdown.update(c => {
        if (c <= 1) {
          clearInterval(this.verifyTimerInterval);
          this.isVerifying.set(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    // Call native confirm endpoint with optional UTR and selected app
    this.paymentService.confirmPayment(session.orderId, this.inputUtr, this.selectedApp()).subscribe({
      next: (status) => {
        this.isVerifying.set(false);
        if (this.verifyTimerInterval) clearInterval(this.verifyTimerInterval);
        this.verifiedUtr.set(status.bankUtr || (this.inputUtr?.trim() ? this.inputUtr.trim() : null));
        this.verifiedApp.set(status.paymentApp || this.selectedApp());

        if (status.status === 'Success') {
          this.clearAllTimers();
          this.step.set('success');
        } else {
          // Status is 'Processing' -> Awaiting Admin Approval
          // Keep polling running in background so if Admin approves, screen turns to Success!
          this.step.set('submitted');
        }
      },
      error: (e) => {
        this.isVerifying.set(false);
        if (this.verifyTimerInterval) clearInterval(this.verifyTimerInterval);
        this.popup.error(e.error?.message || 'Could not submit payment confirmation.');
      }
    });
  }

  private handlePaymentSuccess(status: PaymentTransactionStatus): void {
    this.clearAllTimers();
    this.verifiedUtr.set(status.bankUtr || (this.inputUtr?.trim() ? this.inputUtr.trim() : 'Bank Verified'));
    this.verifiedApp.set(status.paymentApp || this.selectedApp());
    this.step.set('success');
  }

  finishAndClose(): void {
    const session = this.activeSession();
    const isSuccess = this.step() === 'success';
    if (session && (isSuccess || this.step() === 'submitted')) {
      this.paymentSuccess.emit({
        orderId: session.orderId,
        utr: this.verifiedUtr() || this.inputUtr?.trim(),
        amount: this.amount,
        isApproved: isSuccess
      });
    }
    this.closeModal();
  }

  closeModal(): void {
    this.clearAllTimers();
    this._isOpen.set(false);
    this.modalClosed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  private clearAllTimers(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = undefined;
    }
    if (this.verifyTimerInterval) {
      clearInterval(this.verifyTimerInterval);
      this.verifyTimerInterval = undefined;
    }
    if (this.verifySub) this.verifySub.unsubscribe();
    this.isVerifying.set(false);
    this.isSimulating.set(false);
  }
}
