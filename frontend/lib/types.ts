// API response types — generated from Django serializers

// ── Users ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "reader" | "admin";
  is_blocked: boolean;
  mfa_enabled: boolean;
}

export interface UserProfile extends User {
  phone: string;
  gender: "female" | "male" | "";
  avatar_url: string;
  email_reminders: boolean;
  email_overdue: boolean;
  email_reservation: boolean;
  email_account_alerts: boolean;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
  mfa_required?: boolean;
  mfa_token?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  gender?: "female" | "male";
}

// ── Catalog ───────────────────────────────────────────────────────────────────

export interface Book {
  id: number;
  ol_id: string;
  isbn: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  genres: string[];
  language: string;
}

/** Matches BookListSerializer — returned by GET /api/v1/catalog/books/ */
export interface BookListItem {
  id: number;
  title: string;
  author: string;
  cover_url: string;
  genres: string[];
  language: string;
  year_published: number | null;
  available_copies_count: number;
  average_rating: number | null;
}

/** Matches OpenLibrarySearchResultSerializer */
export interface OpenLibraryBook {
  ol_id: string;
  title: string;
  author: string;
  isbn: string | null;
  year_published: number | null;
  cover_url: string;
}

/** Matches BookCopySerializer */
export interface BookCopy {
  id: number;
  book: number;
  copy_number: number;
  condition: "new" | "good" | "worn";
  is_available: boolean;
  qr_code: string | null;
  created_at: string;
}

/** Matches ReviewSerializer — includes reader ID for "already reviewed" check */
export interface BookReview {
  id: number;
  reader: number;
  reader_name: string;
  rating: number;
  content: string;
  is_approved: boolean;
  created_at: string;
}

/** Matches BookDetailSerializer — returned by GET /api/v1/catalog/books/{id}/ */
export interface BookDetail {
  id: number;
  ol_id: string | null;
  isbn: string | null;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  genres: string[];
  language: string;
  year_published: number | null;
  copies: BookCopy[];
  reviews: BookReview[];
  average_rating: number | null;
  reviews_count: number;
  available_copies_count: number;
  reserved_count: number;
  created_at: string;
  updated_at: string;
}

// ── Loans ─────────────────────────────────────────────────────────────────────

export interface Loan {
  id: number;
  copy: BookCopy & { book: Book };
  reader: number;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  prolongation_count: number;
  status: "active" | "returned" | "overdue";
}

export type LoanActive = Loan & { status: "active" | "overdue" };
export type LoanHistory = Loan & { status: "returned" };

export interface Penalty {
  id: number;
  loan: number;
  amount: string;
  reason: "overdue" | "damage" | "loss";
  paid_at: string | null;
  waived_by: number | null;
}

export interface Reservation {
  id: number;
  book: Book;
  reader: number;
  reserved_at: string;
  expires_at: string;
  status: "pending" | "fulfilled" | "cancelled";
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface Review {
  id: number;
  book: number;
  reader: number;
  rating: number;
  content: string;
  is_approved: boolean;
  created_at: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  user: number;
  type: "reminder" | "overdue" | "reservation_ready" | "account_blocked";
  loan: number | null;
  sent_at: string;
  channel: "email";
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_books: number;
  total_copies: number;
  active_loans: number;
  overdue_loans: number;
  total_users: number;
  penalties_unpaid: number;
}

export interface ReaderStats {
  active_loans_count: number;
  overdue_loans_count: number;
  total_books_read: number;
  pending_reservations_count: number;
  unpaid_penalties_total: string; // DecimalField serialized as string
}

// ── Dashboard response shapes (matching serializers exactly) ─────────────────

export interface LoanBook {
  id: number;
  title: string;
  author: string;
  cover_url: string;
}

export interface LoanCopy {
  id: number;
  copy_number: number;
  condition: "new" | "good" | "worn";
  book: LoanBook;
}

export interface LoanItem {
  id: number;
  copy: LoanCopy;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  prolongation_count: number;
  status: "active" | "returned" | "overdue";
  days_remaining: number | null;
  is_overdue: boolean;
}

export interface PenaltyItem {
  id: number;
  loan: { id: number; borrowed_at: string; due_date: string; status: string; book_title: string };
  amount: string;
  reason: "overdue" | "damage" | "loss";
  paid_at: string | null;
  waived_by: number | null;
  created_at: string;
  is_settled: boolean;
}

export interface ReservationItem {
  id: number;
  book: LoanBook;
  reserved_at: string;
  expires_at: string;
  status: "pending" | "fulfilled" | "cancelled";
}

// ── Shared ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
