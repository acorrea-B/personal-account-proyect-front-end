import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="page-shell">
      <section className="page-main auth-page">
        <article className="auth-shell auth-card">
          <h1 className="auth-heading">Professional Profile</h1>
          <p className="auth-subtitle">
            Build and maintain your professional profile and CV with secure account management,
            email verification, and signed-in sessions.
          </p>
          <ul>
            <li>Register and verify your email to get started.</li>
            <li>Sign in again anytime with your verified credentials.</li>
            <li>Manage your profile and curriculum securely from the app.</li>
          </ul>
          <div>
            <Link className="button button-primary" href="/login/">
              Sign in
            </Link>
            <Link className="button button-ghost" href="/register/">
              Create an account
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
