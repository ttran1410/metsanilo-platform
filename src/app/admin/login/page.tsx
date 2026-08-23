import Link from "next/link";
import { LoginForm } from "./form";

export default function ManagerLoginPage() {
  return (
    <main className="admin-login-page">
      <div className="admin-login-frame">
        <div className="admin-login-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div>
            <strong>METSÄNILO</strong>
            <span>Operations</span>
          </div>
        </div>

        <section className="admin-login-card" aria-labelledby="admin-login-title">
          <p className="eyebrow">SHOP OPERATIONS</p>
          <h1 id="admin-login-title">Welcome back</h1>
          <p className="admin-login-lede">
            Sign in to manage reservations, harvest availability, and customer handovers.
          </p>
          <LoginForm />
        </section>

        <p className="admin-login-footer">
          For METSÄNILO shop staff · <Link href="/fi">View storefront</Link>
        </p>
      </div>
    </main>
  );
}
